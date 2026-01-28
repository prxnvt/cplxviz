import type { ComplexPlane } from '../visualization/complex-plane.ts';
import type { ComplexPoint } from '../types/index.ts';

const SNAP = 0.25;
const SUBSCRIPT_DIGITS = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';

function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

function subscriptDigit(n: number): string {
  return String(n).split('').map(d => SUBSCRIPT_DIGITS[parseInt(d)]).join('');
}

export interface ViewControlsOptions {
  onCoefficientDrag?: (index: number, value: ComplexPoint) => void;
  onRootDrag?: (index: number, value: ComplexPoint) => void;
  onPointHover?: (point: ComplexPoint, label: string) => void;
}

export class ViewControls {
  private plane: ComplexPlane;
  private dragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragCenterStart = { re: 0, im: 0 };

  // Coefficient dragging state
  private draggingCoeff = -1; // index into ascending coefficients, or -1
  // Root dragging state
  private draggingRoot = -1; // index into roots array, or -1
  private onCoefficientDrag: ((index: number, value: ComplexPoint) => void) | null = null;
  private onRootDrag: ((index: number, value: ComplexPoint) => void) | null = null;
  private onPointHover: ((point: ComplexPoint, label: string) => void) | null = null;

  constructor(plane: ComplexPlane, opts?: ViewControlsOptions);
  /** @deprecated Use options object instead */
  constructor(plane: ComplexPlane, onCoefficientDrag?: (index: number, value: ComplexPoint) => void);
  constructor(
    plane: ComplexPlane,
    optsOrCallback?: ViewControlsOptions | ((index: number, value: ComplexPoint) => void),
  ) {
    this.plane = plane;

    if (typeof optsOrCallback === 'function') {
      this.onCoefficientDrag = optsOrCallback;
    } else if (optsOrCallback) {
      this.onCoefficientDrag = optsOrCallback.onCoefficientDrag ?? null;
      this.onRootDrag = optsOrCallback.onRootDrag ?? null;
      this.onPointHover = optsOrCallback.onPointHover ?? null;
    }

    const canvas = plane.canvas;

    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mouseleave', this.onMouseLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });

    window.addEventListener('resize', () => {
      plane.resize();
    });
  }

  private onMouseDown = (e: MouseEvent) => {
    const rect = this.plane.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Check root hit first (roots rendered on top)
    const rootIdx = this.plane.hitTestRoot(sx, sy);
    if (rootIdx >= 0) {
      this.draggingRoot = rootIdx;
      this.plane.canvas.classList.add('dragging');
      return;
    }

    // Check coefficient hit
    const coeffIdx = this.plane.hitTestCoefficient(sx, sy);
    if (coeffIdx >= 0) {
      this.draggingCoeff = coeffIdx;
      this.plane.canvas.classList.add('dragging');
      return;
    }

    // Otherwise, pan drag
    this.dragging = true;
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.dragCenterStart = { ...this.plane.viewport.center };
    this.plane.canvas.classList.add('dragging');
  };

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.plane.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (this.draggingRoot >= 0) {
      const complexPos = this.plane.screenToComplex(sx, sy);
      const snapped: ComplexPoint = { re: snap(complexPos.re), im: snap(complexPos.im) };
      this.onRootDrag?.(this.draggingRoot, snapped);
      this.emitPointHover(sx, sy, snapped, 'root');
      return;
    }

    if (this.draggingCoeff >= 0) {
      const complexPos = this.plane.screenToComplex(sx, sy);
      const snapped: ComplexPoint = { re: snap(complexPos.re), im: snap(complexPos.im) };
      this.onCoefficientDrag?.(this.draggingCoeff, snapped);
      this.emitPointHover(sx, sy, snapped, 'coeff');
      return;
    }

    if (this.dragging) {
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      this.plane.viewport.center = {
        re: this.dragCenterStart.re - dx * this.plane.viewport.scale,
        im: this.dragCenterStart.im + dy * this.plane.viewport.scale,
      };
      this.plane.markDirty();
    }

    // Always emit hover (even during pan drag, show cursor position)
    this.emitPointHover(sx, sy);
  };

  private emitPointHover(sx: number, sy: number, draggedPoint?: ComplexPoint, dragType?: 'root' | 'coeff') {
    if (!this.onPointHover) return;

    // If dragging a root, show the dragged value
    if (draggedPoint && dragType === 'root' && this.draggingRoot >= 0) {
      this.onPointHover(draggedPoint, `Root z${subscriptDigit(this.draggingRoot + 1)}`);
      return;
    }

    // If dragging a coefficient, show the dragged value
    if (draggedPoint && dragType === 'coeff' && this.draggingCoeff >= 0) {
      const coefficients = this.plane.getCoefficients();
      const degree = coefficients.length - 1;
      const letter = String.fromCharCode(97 + (degree - this.draggingCoeff));
      this.onPointHover(draggedPoint, `Coeff ${letter}`);
      return;
    }

    // Hit-test roots first (interactive, take priority since rendered on top)
    const rootIdx = this.plane.hitTestRoot(sx, sy);
    if (rootIdx >= 0) {
      const roots = this.plane.getRoots();
      this.onPointHover(roots[rootIdx], `Root z${subscriptDigit(rootIdx + 1)}`);
      return;
    }

    // Hit-test coefficients
    const coeffIdx = this.plane.hitTestCoefficient(sx, sy);
    if (coeffIdx >= 0) {
      const coefficients = this.plane.getCoefficients();
      const degree = coefficients.length - 1;
      const letter = String.fromCharCode(97 + (degree - coeffIdx));
      this.onPointHover(coefficients[coeffIdx], `Coeff ${letter}`);
      return;
    }

    // Default: cursor position
    const cursorPoint = this.plane.screenToComplex(sx, sy);
    this.onPointHover(cursorPoint, 'Cursor');
  }

  private onMouseUp = () => {
    if (this.draggingRoot >= 0) {
      this.draggingRoot = -1;
      this.plane.canvas.classList.remove('dragging');
      return;
    }
    if (this.draggingCoeff >= 0) {
      this.draggingCoeff = -1;
      this.plane.canvas.classList.remove('dragging');
      return;
    }
    if (!this.dragging) return;
    this.dragging = false;
    this.plane.canvas.classList.remove('dragging');
  };

  private onMouseLeave = () => {
    this.onMouseUp();
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();

    const rect = this.plane.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Complex point under cursor before zoom
    const zBefore = this.plane.screenToComplex(sx, sy);

    // Apply zoom factor
    const factor = Math.pow(1.1, e.deltaY / 25);
    this.plane.viewport.scale *= factor;

    // Clamp scale to prevent extreme zoom
    this.plane.viewport.scale = Math.max(1e-10, Math.min(1e6, this.plane.viewport.scale));

    // Adjust center so the complex point stays under the cursor
    const zAfter = this.plane.screenToComplex(sx, sy);
    this.plane.viewport.center = {
      re: this.plane.viewport.center.re + (zBefore.re - zAfter.re),
      im: this.plane.viewport.center.im + (zBefore.im - zAfter.im),
    };

    this.plane.markDirty();
  };
}
