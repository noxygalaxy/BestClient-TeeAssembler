const express = require('express');
const { assembleTee } = require('./TeeAssemblerBackend');

const app = express();

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

app.listen(3000, () => console.log('Server running'));
