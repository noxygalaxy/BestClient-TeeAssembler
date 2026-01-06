const express = require('express');
const axios = require('axios');
const { assembleTee } = require('./TeeAssemblerBackend');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();

const cors = require('cors');

app.use(cors({
  origin: 'https://bestddnet.vercel.app',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  CLIENT_ID: process.env.CLIENT_ID, // Discord Application ID
  CLIENT_SECRET: process.env.CLIENT_SECRET, // Discord Client Secret
  REDIRECT_URI: 'https://best-client-api.vercel.app/api/auth/discord/callback',
  GUILD_ID: '1444352315539591181', // Your server ID
  REQUIRED_ROLE_ID: '1450443703112962171', // Required role ID
  DISCORD_API: 'https://discord.com/api/v10',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://bestddnet.vercel.app/download'
};

// ============================================
// DISCORD OAUTH2 UTILITIES
// ============================================

// Build OAuth2 URL for Discord login
function getDiscordAuthURL() {
  const scope = ['identify', 'guilds.members.read'].join('+');
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
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: CONFIG.REDIRECT_URI
    });

    // FIXED: Proper Basic Auth header
    const credentials = Buffer.from(`${CONFIG.CLIENT_ID}:${CONFIG.CLIENT_SECRET}`).toString('base64');

    const response = await axios.post(
      `${CONFIG.DISCORD_API}/oauth2/token`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    throw error;
  }
}

// Get user details from Discord
async function getUserDetails(accessToken) {
  try {
    const response = await axios.get(`${CONFIG.DISCORD_API}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Get user error:', error.response?.data || error.message);
    throw error;
  }
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
    console.log('User roles:', member.roles); // Debug log
    return member.roles.includes(roleId);
  } catch (error) {
    console.error('Error checking user role:', error.response?.status, error.response?.data || error.message);
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
    console.error('No code provided');
    return res.redirect(`${CONFIG.FRONTEND_URL}?error=no_code`);
  }

  try {
    console.log('Exchanging code for token...');
    const tokenData = await exchangeCode(code);
    const { access_token } = tokenData;

    console.log('Getting user details...');
    const user = await getUserDetails(access_token);
    console.log('User:', user.username);

    console.log('Checking user role...');
    const hasRole = await checkUserRole(
      access_token,
      CONFIG.GUILD_ID,
      CONFIG.REQUIRED_ROLE_ID
    );
    console.log('Has required role:', hasRole);

    // Create JWT token with user info
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        discriminator: user.discriminator || '0',
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
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.redirect(CONFIG.FRONTEND_URL);
  } catch (error) {
    console.error('OAuth callback error:', error.response?.data || error.message);
    res.redirect(`${CONFIG.FRONTEND_URL}?error=auth_failed`);
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

// Get auth status from JWT cookie
app.get('/api/auth/status', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
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
// LOGOUT ROUTE
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
