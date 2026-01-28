import { PHASE_COLOR_LUT, LUT_SIZE } from './color-map.ts';
import type { ComplexPoint, Viewport } from '../types/index.ts';
import { getLightFalloff } from '../state/light-falloff.ts';

const PI = Math.PI;
const TWO_PI = PI * 2;
const DS = 8;               // downsample factor (higher = more blur)
const MAX_ALPHA = 1.0;      // full intensity at root centers

export class DomainColoringRenderer {
  private offCanvas: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private imgData: ImageData | null = null;
  private prevBW = 0;
  private prevBH = 0;

  constructor() {
    this.offCanvas = document.createElement('canvas');
    const ctx = this.offCanvas.getContext('2d');
    if (!ctx) throw new Error('Offscreen canvas 2D context unavailable');
    this.offCtx = ctx;
  }

  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    viewport: Viewport,
    coefficients: ComplexPoint[],
    _roots: ComplexPoint[],
  ): void {
    const n = coefficients.length - 1; // degree
    if (n < 1) return;

    // Precompute coefficient arrays for inline Horner
    const coeffRe = new Float64Array(n + 1);
    const coeffIm = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) {
      coeffRe[i] = coefficients[i].re;
      coeffIm[i] = coefficients[i].im;
    }

    // Downsampled dimensions
    const bw = Math.ceil(width / DS);
    const bh = Math.ceil(height / DS);

    // Reuse ImageData if size unchanged
    if (bw !== this.prevBW || bh !== this.prevBH) {
      this.offCanvas.width = bw;
      this.offCanvas.height = bh;
      this.imgData = this.offCtx.createImageData(bw, bh);
      this.prevBW = bw;
      this.prevBH = bh;
    }
    const img = this.imgData!;
    const data = img.data;

    // Viewport mapping (in downsampled pixel space)
    const scaledScale = viewport.scale * DS;
    const originRe = viewport.center.re - (bw / 2) * scaledScale;
    const originIm = viewport.center.im + (bh / 2) * scaledScale;

    // Circular fade: radius controlled by light falloff setting
    // 100 = no falloff (full brightness), 0 = near-immediate falloff
    const centerX = bw / 2;
    const centerY = bh / 2;
    const lightFalloff = getLightFalloff();
    // Base radius from viewport area
    const baseRadius = Math.sqrt((bw * bh) / (2 * PI));
    // Scale radius based on falloff: at 100, radius is huge (no fade); at 0, radius is very small
    const falloffMultiplier = 0.1 + (lightFalloff / 100) * 9.9; // Range: 0.1 to 10
    const fadeRadius = baseRadius * falloffMultiplier;
    const invFadeRadius = 1 / fadeRadius;

    for (let py = 0; py < bh; py++) {
      const zIm = originIm - py * scaledScale;
      const dy = py - centerY;

      const rowOff = py * bw * 4;

      for (let px = 0; px < bw; px++) {
        const zRe = originRe + px * scaledScale;

        // Inline Horner evaluation: P(z) = c[n]*z^n + ... + c[0]
        let wRe = coeffRe[n];
        let wIm = coeffIm[n];
        for (let k = n - 1; k >= 0; k--) {
          const newRe = wRe * zRe - wIm * zIm + coeffRe[k];
          const newIm = wRe * zIm + wIm * zRe + coeffIm[k];
          wRe = newRe;
          wIm = newIm;
        }

        // Phase -> LUT index
        const theta = Math.atan2(wIm, wRe);
        let idx = ((theta + PI) * (LUT_SIZE / TWO_PI)) | 0;
        if (idx >= LUT_SIZE) idx = LUT_SIZE - 1;
        if (idx < 0) idx = 0;
        const lutOff = idx * 3;

        // Circular fade from center
        const dx = px - centerX;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radialFade = Math.max(0, 1 - dist * invFadeRadius);

        const alpha = radialFade * MAX_ALPHA;

        const off = rowOff + px * 4;
        data[off]     = PHASE_COLOR_LUT[lutOff];
        data[off + 1] = PHASE_COLOR_LUT[lutOff + 1];
        data[off + 2] = PHASE_COLOR_LUT[lutOff + 2];
        data[off + 3] = (alpha * 255 + 0.5) | 0;
      }
    }

    this.offCtx.putImageData(img, 0, 0);
    ctx.drawImage(this.offCanvas, 0, 0, bw, bh, 0, 0, width, height);
  }
}
