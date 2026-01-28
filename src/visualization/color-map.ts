export const LUT_SIZE = 1024;
export const PHASE_COLOR_LUT = new Uint8Array(LUT_SIZE * 3);

/** Standard HSL-to-RGB conversion (h, s, l all in [0,1]). */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const hueToChannel = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return [
    (hueToChannel(h + 1 / 3) * 255 + 0.5) | 0,
    (hueToChannel(h)         * 255 + 0.5) | 0,
    (hueToChannel(h - 1 / 3) * 255 + 0.5) | 0,
  ];
}

/** Circular distance between two hues in [0,1]. */
function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b);
  return d < 0.5 ? d : 1 - d;
}

/** Smooth cosine bump: 1 at center, 0 at ±radius. */
function bump(hue: number, center: number, radius: number): number {
  const d = hueDist(hue, center);
  return d < radius ? (1 + Math.cos(Math.PI * d / radius)) / 2 : 0;
}

function buildLUT() {
  const sat = 0.5;
  const baseLit = 0.30;
  const warmBias = -0.03; // shift all hues ~11° toward red for warmer tones
  // Hue warp: shift secondaries toward their neighboring primary.
  // (1 - cos(6πh))/2 is 0 at primaries (R/G/B), 1 at secondaries (Y/C/M).
  // A positive offset pulls each secondary toward the next primary clockwise:
  //   Pink → Red, Yellow → Green, Cyan → Blue.
  const warpAmt = 0.07; // ~25° of hue shift at secondaries
  for (let i = 0; i < LUT_SIZE; i++) {
    const rawHue = i / LUT_SIZE;
    const warp = warpAmt * (1 - Math.cos(6 * Math.PI * rawHue)) / 2;
    const hue = ((rawHue + warp + warmBias) % 1 + 1) % 1;

    // Per-hue lightness: brighter red, slightly brighter blue, dimmer green/yellow
    const redBoost  = 0.12 * bump(rawHue, 0, 0.15);
    const blueBoost = 0.05 * bump(rawHue, 0.667, 0.12);
    const gyDim     = -0.08 * bump(rawHue, 0.25, 0.15);
    const lit = baseLit + redBoost + blueBoost + gyDim;

    const [r, g, b] = hslToRgb(hue, sat, lit);
    const off = i * 3;
    PHASE_COLOR_LUT[off]     = r;
    PHASE_COLOR_LUT[off + 1] = g;
    PHASE_COLOR_LUT[off + 2] = b;
  }
}

buildLUT();
