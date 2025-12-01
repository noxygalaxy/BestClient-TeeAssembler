/*

	TeeAssembler 2.0 by Aleksandar Blažić
	https://github.com/AlexIsTheGuy/TeeAssembler-2.0
	
	Ported by noxygalaxy for BestClient

*/

const { createCanvas, loadImage } = require('canvas');
const TeeConstants = require('./TeeAssemblerConstants');

async function assembleTee(skinname, colors, format) {
  const skinUrl = `https://ddstats.tw/skins/${skinname}.png`;

  const res = await fetch(skinUrl);
  if (!res.ok) {
    throw new Error(`Skin image not found (${res.status})`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const img = await loadImage(buf);

  const canvas = createCanvas(TeeConstants.CANVAS_WIDTH, TeeConstants.CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  for (const partName of Object.keys(TeeConstants.PARTS)) {
    const partInfo = TeeConstants.PARTS[partName];

    const [sx, sy, sw, sh] = TeeConstants.SKIN_ELEMENTS[partInfo.src];

    const partCanvas = createCanvas(sw, sh);
    const partCtx = partCanvas.getContext('2d');

    partCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    ctx.save();
    const scaleX = partInfo.scaleX ?? 1;
    const scaleY = partInfo.scaleY ?? 1;

    ctx.translate(partInfo.destX, partInfo.destY);
    ctx.scale(scaleX * (partInfo.flipX ? -1 : 1), scaleY);
    ctx.drawImage(partCanvas, 0, 0);
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
}

module.exports = { assembleTee };
