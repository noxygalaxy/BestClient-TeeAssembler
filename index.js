const express = require('express');
const axios = require('axios');
const { assembleTee } = require('./TeeAssemblerBackend');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

app.use(cookieParser());

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  CLIENT_ID: process.env.CLIENT_ID, // Discord Application ID
  CLIENT_SECRET: process.env.CLIENT_SECRET, // Discord Client Secret
  REDIRECT_URI: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000/api/auth/discord/callback' 
    : 'https://best-client-api.vercel.app/api/auth/discord/callback',
  GUILD_ID: '1444352315539591181', // Your server ID
  REQUIRED_ROLE_ID: '1450443703112962171', // Required role ID
  DISCORD_API: 'https://discord.com/api/v10',
  OAUTH2_TOKEN_URL: 'https://discord.com/oauth2/authorize'
};

// ============================================
// DISCORD OAUTH2 UTILITIES
// ============================================

// Build OAuth2 URL for Discord login
function getDiscordAuthURL() {
  const scope = ['identify', 'guilds.members.read'].join(' ');
  const params = new URLSearchParams({
    client_id: CONFIG.CLIENT_ID,
    redirect_uri: CONFIG.REDIRECT_URI,
    response_type: 'code',
    scope: scope
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

// Exchange authorization code for access token
async function exchangeCode(code) {
  const data = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: CONFIG.REDIRECT_URI
  });

  const response = await axios.post(CONFIG.OAUTH2_TOKEN_URL, data, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    auth: {
      username: CONFIG.CLIENT_ID,
      password: CONFIG.CLIENT_SECRET
    }
  });

  return response.data;
}

// Get user details from Discord
async function getUserDetails(accessToken) {
  const response = await axios.get(`${CONFIG.DISCORD_API}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  return response.data;
}

// Check if user has required role in guild
async function checkUserRole(accessToken, guildId, roleId) {
  try {
    const response = await axios.get(
      `${CONFIG.DISCORD_API}/users/@me/guilds/${guildId}/member`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    
    const member = response.data;
    return member.roles.includes(roleId);
  } catch (error) {
    console.error('Error checking user role:', error.response?.data || error.message);
    return false;
  }
}

// ============================================
// DISCORD AUTH ROUTES
// ============================================

// Redirect user to Discord OAuth2
app.get('/api/auth/discord', (req, res) => {
  res.redirect(getDiscordAuthURL());
});

// Discord OAuth2 callback - handles the redirect after user authorizes
app.get('/api/auth/discord/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    const tokenData = await exchangeCode(code);
    const { access_token } = tokenData;

    const user = await getUserDetails(access_token);
    const hasRole = await checkUserRole(
      access_token,
      CONFIG.GUILD_ID,
      CONFIG.REQUIRED_ROLE_ID
    );

    // Create JWT token with user info
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        hasRequiredRole: hasRole
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Set cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.redirect('/');
  } catch (error) {
    console.error('OAuth callback error:', error.response?.data || error.message);
    res.redirect('/?error=auth_failed');
  }
});

// Check role status (for already authenticated users)
app.get('/api/auth/check-role', async (req, res) => {
  const accessToken = req.headers.authorization?.replace('Bearer ', '');

  if (!accessToken) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  try {
    const hasRole = await checkUserRole(
      accessToken,
      CONFIG.GUILD_ID,
      CONFIG.REQUIRED_ROLE_ID
    );

    res.json({ 
      hasRequiredRole: hasRole,
      canDownload: hasRole
    });
  } catch (error) {
    console.error('Role check error:', error);
    res.status(500).json({ error: 'Failed to check role' });
  }
});

app.get('/api/auth/status', (req, res) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.json({ isAuthenticated: false, hasRequiredRole: false, user: null });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    res.json({
      isAuthenticated: true,
      hasRequiredRole: decoded.hasRequiredRole,
      user: {
        id: decoded.userId,
        username: decoded.username,
        discriminator: decoded.discriminator,
        avatar: decoded.avatar
      }
    });
  } catch (error) {
    res.json({ isAuthenticated: false, hasRequiredRole: false, user: null });
  }
});

// ============================================
// ADD LOGOUT ROUTE
// ============================================

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

// ============================================
// TEE ASSEMBLER ROUTES (Your existing functionality)
// ============================================

app.get('/api/assemble/:skinname.png', async (req, res) => {
  try {
    const skinname = req.params.skinname;

    const colors = {
      body: req.query.body || 'default',
      feet: req.query.feet || 'default'
    };

    const format = req.query.format || 'rgb';

    const teePng = await assembleTee(skinname, colors, format);

    res.set('Content-Type', 'image/png');
    res.send(teePng);
  } catch (err) {
    console.error('assembleTee failed:', err);

    res
      .status(500)
      .send(err && err.message ? `Skin render error: ${err.message}` : 'Skin render error');
  }
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
