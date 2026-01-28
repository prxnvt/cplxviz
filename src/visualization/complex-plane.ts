import katex from 'katex';
import type { ComplexPoint, Viewport } from '../types/index.ts';
import { DomainColoringRenderer } from './domain-coloring.ts';
import { getCoordinateMode, onCoordinateModeChange } from '../state/coordinate-mode.ts';

const BG_COLOR = '#000000';
const MINOR_GRID_COLOR = 'rgba(255, 255, 255, 0.04)';
const MAJOR_GRID_COLOR = 'rgba(255, 255, 255, 0.10)';
const POLAR_CIRCLE_COLOR = 'rgba(255, 255, 255, 0.5)';
const AXIS_COLOR = 'rgba(255, 255, 255, 1)';
const ROOT_COLOR_R = 255;
const ROOT_COLOR_G = 255;
const ROOT_COLOR_B = 255;
const ROOT_ORB_RADIUS = 15;
const ROOT_GLOW_RADIUS = 38;
const COEFF_RADIUS = 16;
const TARGET_GRID_PX = 80;
const LABEL_SIZE_PX = 22;

export class ComplexPlane {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private width = 0;  // CSS pixels
  private height = 0;
  viewport: Viewport;
  private roots: ComplexPoint[] = [];
  private coefficients: ComplexPoint[] = []; // ascending order (same as Polynomial)
  private dirty = true;
  private rafId = 0;
  private domainColoring = new DomainColoringRenderer();

  // HTML label overlay
  private overlay: HTMLDivElement;
  private labelPool: Map<string, HTMLDivElement> = new Map();
  private usedLabels: Set<string> = new Set();

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    container.appendChild(this.canvas);

    this.overlay = document.createElement('div');
    this.overlay.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;';
    container.appendChild(this.overlay);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;

    this.dpr = window.devicePixelRatio || 1;
    this.viewport = { center: { re: 0, im: 0 }, scale: 5 / 800 };

    this.resize();
    this.scheduleRender();

    onCoordinateModeChange(() => {
      this.markDirty();
    });
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.parentElement!.clientWidth;
    this.height = this.canvas.parentElement!.clientHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.markDirty();
  }

  setRoots(roots: ComplexPoint[]) {
    this.roots = roots;
    this.markDirty();
  }

  setCoefficients(coefficients: ComplexPoint[]) {
    this.coefficients = coefficients;
    this.markDirty();
  }

  getCoefficients(): ComplexPoint[] {
    return this.coefficients;
  }

  getRoots(): ComplexPoint[] {
    return this.roots;
  }

  /**
   * Hit-test root orbs. Returns the root index if (sx, sy) in CSS pixels
   * is within the orb, or -1 if none hit.
   */
  hitTestRoot(sx: number, sy: number): number {
    for (let i = 0; i < this.roots.length; i++) {
      const root = this.roots[i];
      const { x, y } = this.complexToScreen(root);
      const dx = sx - x;
      const dy = sy - y;
      if (dx * dx + dy * dy <= ROOT_ORB_RADIUS * ROOT_ORB_RADIUS) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Hit-test coefficient circles. Returns the coefficient index (ascending order)
   * if (sx, sy) in CSS pixels is within the circle, or -1 if none hit.
   */
  hitTestCoefficient(sx: number, sy: number): number {
    if (this.coefficients.length === 0) return -1;
    const degree = this.coefficients.length - 1;

    for (let i = degree; i >= 0; i--) {
      const coeff = this.coefficients[i];
      const { x, y } = this.complexToScreen(coeff);
      const dx = sx - x;
      const dy = sy - y;
      if (dx * dx + dy * dy <= COEFF_RADIUS * COEFF_RADIUS) {
        return i;
      }
    }
    return -1;
  }

  complexToScreen(z: ComplexPoint): { x: number; y: number } {
    const x = (z.re - this.viewport.center.re) / this.viewport.scale + this.width / 2;
    const y = -(z.im - this.viewport.center.im) / this.viewport.scale + this.height / 2;
    return { x, y };
  }

  screenToComplex(sx: number, sy: number): ComplexPoint {
    const re = (sx - this.width / 2) * this.viewport.scale + this.viewport.center.re;
    const im = -(sy - this.height / 2) * this.viewport.scale + this.viewport.center.im;
    return { re, im };
  }

  /** Request a redraw on the next animation frame. */
  markDirty() {
    if (!this.dirty) {
      this.dirty = true;
      this.scheduleRender();
    }
  }

  private scheduleRender() {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      if (this.dirty) {
        this.dirty = false;
        this.draw();
      }
    });
  }

  private draw() {
    const { ctx, dpr } = this;
    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, this.width, this.height);

    // Domain coloring (phase plot)
    if (this.coefficients.length > 1) {
      this.domainColoring.render(
        ctx, this.width, this.height,
        this.viewport, this.coefficients, this.roots,
      );
    }

    const gridSpacing = this.computeGridSpacing();
    const mode = getCoordinateMode();

    if (mode === 'cartesian') {
      this.drawGrid(gridSpacing);
    } else {
      this.drawPolarGrid(gridSpacing);
    }
    this.drawAxes();
    this.drawCoefficientCircles();
    this.drawRootGlows();

    ctx.restore();

    // HTML overlay labels (after canvas drawing)
    this.usedLabels.clear();
    if (mode === 'cartesian') {
      this.placeTickLabels(gridSpacing);
    } else {
      this.placePolarTickLabels(gridSpacing);
    }
    this.placeCoefficientLetters();
    this.cleanupLabels();
  }

  // ── Label overlay ────────────────────────────────────────────────

  private placeLabel(
    key: string,
    latex: string,
    x: number,
    y: number,
    align: 'left' | 'center' | 'right',
    baseline: 'top' | 'middle' | 'bottom',
    fontSize: number = LABEL_SIZE_PX,
  ) {
    this.usedLabels.add(key);
    let el = this.labelPool.get(key);
    if (!el) {
      el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.color = '#fff';
      el.style.whiteSpace = 'nowrap';
      this.overlay.appendChild(el);
      this.labelPool.set(key, el);
    }

    const sizeKey = `${latex}:${fontSize}`;
    if (el.dataset.sizeKey !== sizeKey) {
      katex.render(latex, el, { throwOnError: false });
      el.dataset.sizeKey = sizeKey;
      const k = el.querySelector('.katex') as HTMLElement | null;
      if (k) k.style.fontSize = `${fontSize}px`;
    }

    let tx = '0%';
    let ty = '0%';
    if (align === 'center') tx = '-50%';
    else if (align === 'right') tx = '-100%';
    if (baseline === 'middle') ty = '-50%';
    else if (baseline === 'bottom') ty = '-100%';

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transform = `translate(${tx}, ${ty})`;
    el.style.display = '';
  }

  private cleanupLabels() {
    for (const [key, el] of this.labelPool) {
      if (!this.usedLabels.has(key)) {
        el.style.display = 'none';
      }
    }
  }

  private placeTickLabels(spacing: number) {
    const topLeft = this.screenToComplex(0, 0);
    const bottomRight = this.screenToComplex(this.width, this.height);
    const origin = this.complexToScreen({ re: 0, im: 0 });

    const minRe = Math.floor(topLeft.re / spacing) * spacing;
    const maxRe = Math.ceil(bottomRight.re / spacing) * spacing;
    const minIm = Math.floor(bottomRight.im / spacing) * spacing;
    const maxIm = Math.ceil(topLeft.im / spacing) * spacing;

    const precision = Math.max(0, -Math.floor(Math.log10(spacing)) + 1);

    // Real axis labels
    for (let re = minRe; re <= maxRe; re += spacing) {
      if (Math.abs(re) < spacing * 0.01) continue;
      const { x } = this.complexToScreen({ re, im: 0 });
      const labelY = Math.min(Math.max(origin.y + 6, 6), this.height - 16);
      const latex = formatNumber(re, precision);
      this.placeLabel(`tick-re-${re.toFixed(6)}`, latex, x, labelY, 'center', 'top');
    }

    // Imaginary axis labels
    for (let im = minIm; im <= maxIm; im += spacing) {
      if (Math.abs(im) < spacing * 0.01) continue;
      const { y } = this.complexToScreen({ re: 0, im });
      const labelX = Math.min(Math.max(origin.x + 6, 6), this.width - 40);
      const latex = formatImTick(im, precision);
      this.placeLabel(`tick-im-${im.toFixed(6)}`, latex, labelX, y, 'left', 'middle');
    }
  }

  private placePolarTickLabels(spacing: number) {
    const origin = this.complexToScreen({ re: 0, im: 0 });
    const topLeft = this.screenToComplex(0, 0);
    const bottomRight = this.screenToComplex(this.width, this.height);

    // Calculate max radius needed
    const corners = [
      { re: topLeft.re, im: topLeft.im },
      { re: bottomRight.re, im: topLeft.im },
      { re: topLeft.re, im: bottomRight.im },
      { re: bottomRight.re, im: bottomRight.im },
    ];
    let maxRadius = 0;
    for (const corner of corners) {
      const dist = Math.sqrt(corner.re * corner.re + corner.im * corner.im);
      if (dist > maxRadius) maxRadius = dist;
    }
    maxRadius = Math.ceil(maxRadius / spacing) * spacing;

    const precision = Math.max(0, -Math.floor(Math.log10(spacing)) + 1);

    // Radius labels along positive real axis
    for (let r = spacing; r <= maxRadius; r += spacing) {
      const { x } = this.complexToScreen({ re: r, im: 0 });
      // Only place if within viewport
      if (x > 0 && x < this.width) {
        const labelY = Math.min(Math.max(origin.y + 6, 6), this.height - 16);
        const latex = formatNumber(r, precision);
        this.placeLabel(`tick-r-${r.toFixed(6)}`, latex, x, labelY, 'center', 'top');
      }
    }

    // Angle labels at π/6 intervals, placed along radial lines
    const angleLabels: Array<{ angle: number; latex: string }> = [
      { angle: Math.PI / 6, latex: '\\frac{\\pi}{6}' },
      { angle: Math.PI / 3, latex: '\\frac{\\pi}{3}' },
      { angle: Math.PI / 2, latex: '\\frac{\\pi}{2}' },
      { angle: (2 * Math.PI) / 3, latex: '\\frac{2\\pi}{3}' },
      { angle: (5 * Math.PI) / 6, latex: '\\frac{5\\pi}{6}' },
      { angle: Math.PI, latex: '\\pi' },
      { angle: (-5 * Math.PI) / 6, latex: '-\\frac{5\\pi}{6}' },
      { angle: (-2 * Math.PI) / 3, latex: '-\\frac{2\\pi}{3}' },
      { angle: -Math.PI / 2, latex: '-\\frac{\\pi}{2}' },
      { angle: -Math.PI / 3, latex: '-\\frac{\\pi}{3}' },
      { angle: -Math.PI / 6, latex: '-\\frac{\\pi}{6}' },
    ];

    // Adaptive radius: start at r=3, double when zoomed out (r=6, r=12, etc.)
    // Fall back to 2/3 screen height when zoomed in past r=3
    const minScreenFraction = 0.25; // Labels should be at least this fraction from origin
    const maxScreenFraction = 0.8;  // Labels shouldn't exceed this fraction of screen
    const screenSize = Math.min(this.width, this.height);

    let labelRadius = 3;
    let labelRadiusPx = labelRadius / this.viewport.scale;

    // If too small (zoomed out), double the radius until it's visible enough
    while (labelRadiusPx < screenSize * minScreenFraction && labelRadius < 1000) {
      labelRadius *= 2;
      labelRadiusPx = labelRadius / this.viewport.scale;
    }

    // If too large (zoomed in), use screen-based fallback
    if (labelRadiusPx > screenSize * maxScreenFraction) {
      labelRadiusPx = (this.height * 2) / 3;
    }

    for (const { angle, latex } of angleLabels) {
      const x = origin.x + labelRadiusPx * Math.cos(angle);
      const y = origin.y - labelRadiusPx * Math.sin(angle);

      // Only place if within viewport with some margin
      if (x > 20 && x < this.width - 20 && y > 20 && y < this.height - 20) {
        this.placeLabel(`tick-angle-${angle.toFixed(4)}`, latex, x, y, 'center', 'middle', 32);
      }
    }
  }

  private placeCoefficientLetters() {
    if (this.coefficients.length === 0) return;
    const degree = this.coefficients.length - 1;

    for (let i = degree; i >= 0; i--) {
      const coeff = this.coefficients[i];
      const letter = String.fromCharCode(97 + (degree - i));
      const { x, y } = this.complexToScreen(coeff);
      this.placeLabel(`coeff-letter-${i}`, letter, x, y, 'center', 'middle');
    }
  }

  // ── Canvas drawing (grid, axes, glow) ────────────────────────────

  /**
   * Adaptive 1-2-5 grid spacing: find the spacing in complex units such that
   * the pixel spacing is close to TARGET_GRID_PX.
   */
  private computeGridSpacing(): number {
    const idealSpacing = TARGET_GRID_PX * this.viewport.scale;
    const exponent = Math.floor(Math.log10(idealSpacing));
    const base = Math.pow(10, exponent);
    const normalized = idealSpacing / base;

    // Pick from 1-2-5 sequence
    if (normalized < 1.5) return base;
    if (normalized < 3.5) return 2 * base;
    if (normalized < 7.5) return 5 * base;
    return 10 * base;
  }

  private drawGrid(spacing: number) {
    const { ctx } = this;
    const topLeft = this.screenToComplex(0, 0);
    const bottomRight = this.screenToComplex(this.width, this.height);

    const minRe = Math.floor(topLeft.re / spacing) * spacing;
    const maxRe = Math.ceil(bottomRight.re / spacing) * spacing;
    const minIm = Math.floor(bottomRight.im / spacing) * spacing;
    const maxIm = Math.ceil(topLeft.im / spacing) * spacing;

    // Minor grid (half spacing)
    const minorSpacing = spacing / 5;
    ctx.strokeStyle = MINOR_GRID_COLOR;
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    for (let re = Math.floor(topLeft.re / minorSpacing) * minorSpacing; re <= bottomRight.re; re += minorSpacing) {
      const { x } = this.complexToScreen({ re, im: 0 });
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let im = Math.floor(bottomRight.im / minorSpacing) * minorSpacing; im <= topLeft.im; im += minorSpacing) {
      const { y } = this.complexToScreen({ re: 0, im });
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();

    // Major grid
    ctx.strokeStyle = MAJOR_GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let re = minRe; re <= maxRe; re += spacing) {
      const { x } = this.complexToScreen({ re, im: 0 });
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let im = minIm; im <= maxIm; im += spacing) {
      const { y } = this.complexToScreen({ re: 0, im });
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
  }

  private drawPolarGrid(spacing: number) {
    const { ctx } = this;
    const origin = this.complexToScreen({ re: 0, im: 0 });
    const topLeft = this.screenToComplex(0, 0);
    const bottomRight = this.screenToComplex(this.width, this.height);

    // Calculate max radius needed to cover the viewport
    const corners = [
      { re: topLeft.re, im: topLeft.im },
      { re: bottomRight.re, im: topLeft.im },
      { re: topLeft.re, im: bottomRight.im },
      { re: bottomRight.re, im: bottomRight.im },
    ];
    let maxRadius = 0;
    for (const corner of corners) {
      const dist = Math.sqrt(corner.re * corner.re + corner.im * corner.im);
      if (dist > maxRadius) maxRadius = dist;
    }
    maxRadius = Math.ceil(maxRadius / spacing) * spacing;

    // Minor circles (spacing / 5)
    const minorSpacing = spacing / 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let r = minorSpacing; r <= maxRadius; r += minorSpacing) {
      const rPx = r / this.viewport.scale;
      ctx.moveTo(origin.x + rPx, origin.y);
      ctx.arc(origin.x, origin.y, rPx, 0, Math.PI * 2);
    }
    ctx.stroke();

    // Major circles - white for polar grid
    ctx.strokeStyle = POLAR_CIRCLE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let r = spacing; r <= maxRadius; r += spacing) {
      const rPx = r / this.viewport.scale;
      ctx.moveTo(origin.x + rPx, origin.y);
      ctx.arc(origin.x, origin.y, rPx, 0, Math.PI * 2);
    }
    ctx.stroke();

    // Radial lines at π/6 intervals (12 lines)
    const maxRadiusPx = maxRadius / this.viewport.scale;
    ctx.strokeStyle = MAJOR_GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const endX = origin.x + maxRadiusPx * Math.cos(angle);
      const endY = origin.y - maxRadiusPx * Math.sin(angle);
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(endX, endY);
    }
    ctx.stroke();
  }

  private drawAxes() {
    const { ctx } = this;
    const origin = this.complexToScreen({ re: 0, im: 0 });

    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    // Real axis (horizontal)
    ctx.moveTo(0, origin.y);
    ctx.lineTo(this.width, origin.y);

    // Imaginary axis (vertical)
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, this.height);

    ctx.stroke();
  }

  private drawCoefficientCircles() {
    if (this.coefficients.length === 0) return;
    const { ctx } = this;
    const degree = this.coefficients.length - 1;

    for (let i = degree; i >= 0; i--) {
      const coeff = this.coefficients[i];
      const { x, y } = this.complexToScreen(coeff);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, COEFF_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawRootGlows() {
    const { ctx } = this;
    const r = ROOT_COLOR_R;
    const g = ROOT_COLOR_G;
    const b = ROOT_COLOR_B;

    for (const root of this.roots) {
      const { x, y } = this.complexToScreen(root);

      // Tight white core — domain coloring provides the colored glow
      // Inner glow
      const glowRadius = ROOT_GLOW_RADIUS;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.25)`);
      glow.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.12)`);
      glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core halo
      const haloRadius = ROOT_ORB_RADIUS * 1.5;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
      halo.addColorStop(0, `rgba(255, 255, 255, 0.55)`);
      halo.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.25)`);
      halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core orb — bright center
      const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, ROOT_ORB_RADIUS * 0.6);
      coreGrad.addColorStop(0, `rgba(255, 255, 255, 0.95)`);
      coreGrad.addColorStop(0.5, `rgba(255, 255, 255, 0.7)`);
      coreGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(x, y, ROOT_ORB_RADIUS * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function formatNumber(n: number, precision: number): string {
  const rounded = parseFloat(n.toFixed(precision));
  return String(rounded);
}

function formatImTick(im: number, precision: number): string {
  const rounded = parseFloat(im.toFixed(precision));
  const abs = Math.abs(rounded);
  if (abs === 1) return rounded > 0 ? 'i' : '-i';
  return `${rounded}i`;
}
