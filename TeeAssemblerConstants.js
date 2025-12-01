// Skin sheet
const SKIN_WIDTH = 256;
const SKIN_HEIGHT = 128;

// Rendered size
const CANVAS_WIDTH = 86;
const CANVAS_HEIGHT = 80;

// from TeeAssembler.skin.elements
const SKIN_ELEMENTS = {
  body:          [0,   0,  96, 96],
  body_shadow:   [96,  0,  96, 96],
  hand:          [192, 0,  32, 32],
  hand_shadow:   [224, 0,  32, 32],
  foot:          [192, 32, 64, 32],
  foot_shadow:   [192, 64, 64, 32],
  credits:       [0,  96,  64, 32],
  default_eye:   [64, 96,  32, 32],
  angry_eye:     [96, 96,  32, 32],
  blink_eye:     [128,96,  32, 32],
  happy_eye:     [160,96,  32, 32],
  cross_eye:     [192,96,  32, 32],
  surprised_eye: [224,96,  32, 32]
};

// Drawing area
const ICON_SIZE = 96;

const PARTS = {
  body_shadow: {
    src: 'body_shadow',
    layer: 0,
    colorType: 'body',
    destX: 0,
    destY: -4 + 5,
    destW: ICON_SIZE,
    destH: ICON_SIZE,
    scaleX: 0.9,
    scaleY: 0.9
  },
  body: {
    src: 'body',
    layer: 1,
    colorType: 'body',
    destX: 0,
    destY: -4 + 5,
    destW: ICON_SIZE,
    destH: ICON_SIZE,
    scaleX: 0.9,
    scaleY: 0.9
  },
  left_eye: {
    src: 'default_eye',
    layer: 6,
    colorType: null,
    destX: 30,
    destY: 18 + 5,
    destW: 32,
    destH: 32,
    scaleX: 1.08,
    scaleY: 1.08
  },
  right_eye: {
    src: 'default_eye',
    layer: 7,
    colorType: null,
    destX: 76,
    destY: 18 + 5,
    destW: 32,
    destH: 32,
    scaleX: 1.08,
    scaleY: 1.08,
    flipX: true
  }
};

module.exports = {
  SKIN_WIDTH,
  SKIN_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SKIN_ELEMENTS,
  PARTS
};
