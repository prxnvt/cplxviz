import katex from 'katex';
import type { ComplexPoint } from '../types/index.ts';
import { formatComplexLatex, formatPolarLatex, formatEulerLatex } from '../math/complex.ts';
import { getCoordinateMode, onCoordinateModeChange } from '../state/coordinate-mode.ts';

export class CoordinateDisplay {
  private el: HTMLDivElement;
  private labelEl: HTMLDivElement;
  private standardEl: HTMLDivElement;
  private polarEl: HTMLDivElement;
  private coeffLabelEl: HTMLDivElement;
  private coeffListEl: HTMLDivElement;
  private rootsLabelEl: HTMLDivElement;
  private rootsListEl: HTMLDivElement;
  private lastStandard = '';
  private lastPolar = '';
  private lastLabel = '';
  private lastCoeffLatex = '';
  private lastRootsLatex = '';
  private cachedCoefficients: ComplexPoint[] = [];
  private cachedRoots: ComplexPoint[] = [];
  private cachedCursorPoint: ComplexPoint | null = null;
  private cachedCursorLabel = '';

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'coord-display';

    this.labelEl = document.createElement('div');
    this.labelEl.className = 'coord-display__label';

    this.standardEl = document.createElement('div');
    this.standardEl.className = 'coord-display__standard';

    this.polarEl = document.createElement('div');
    this.polarEl.className = 'coord-display__polar';

    this.coeffLabelEl = document.createElement('div');
    this.coeffLabelEl.className = 'coord-display__section-label';
    this.coeffLabelEl.textContent = 'Coefficients';

    this.coeffListEl = document.createElement('div');
    this.coeffListEl.className = 'coord-display__list';

    this.rootsLabelEl = document.createElement('div');
    this.rootsLabelEl.className = 'coord-display__section-label';
    this.rootsLabelEl.textContent = 'Roots';

    this.rootsListEl = document.createElement('div');
    this.rootsListEl.className = 'coord-display__list';

    this.el.appendChild(this.labelEl);
    this.el.appendChild(this.standardEl);
    this.el.appendChild(this.polarEl);
    this.el.appendChild(this.coeffLabelEl);
    this.el.appendChild(this.coeffListEl);
    this.el.appendChild(this.rootsLabelEl);
    this.el.appendChild(this.rootsListEl);
    container.appendChild(this.el);

    onCoordinateModeChange(() => {
      this.invalidateCache();
      this.rerender();
    });
  }

  private invalidateCache(): void {
    this.lastStandard = '';
    this.lastPolar = '';
    this.lastCoeffLatex = '';
    this.lastRootsLatex = '';
  }

  private rerender(): void {
    // Re-render cursor position if we have a cached point
    if (this.cachedCursorPoint) {
      this.update(this.cachedCursorPoint, this.cachedCursorLabel);
    }

    // Re-render polynomial data if we have cached values
    if (this.cachedCoefficients.length > 0 || this.cachedRoots.length > 0) {
      this.setPolynomialData(this.cachedCoefficients, this.cachedRoots);
    }
  }

  update(point: ComplexPoint, label: string) {
    this.cachedCursorPoint = point;
    this.cachedCursorLabel = label;

    const mode = getCoordinateMode();

    if (label !== this.lastLabel) {
      this.labelEl.textContent = label;
      this.lastLabel = label;
    }

    if (mode === 'cartesian') {
      const standardLatex = formatComplexLatex(point);
      if (standardLatex !== this.lastStandard) {
        katex.render(standardLatex, this.standardEl, { throwOnError: false });
        this.lastStandard = standardLatex;
      }
      this.standardEl.style.display = 'block';
      this.polarEl.style.display = 'none';
    } else {
      const polarLatex = mode === 'polar' ? formatPolarLatex(point) : formatEulerLatex(point);
      if (polarLatex !== this.lastPolar) {
        katex.render(polarLatex, this.polarEl, { throwOnError: false });
        this.lastPolar = polarLatex;
      }
      this.standardEl.style.display = 'none';
      this.polarEl.style.display = 'block';
    }
  }

  setPolynomialData(coefficients: ComplexPoint[], roots: ComplexPoint[]) {
    this.cachedCoefficients = coefficients;
    this.cachedRoots = roots;

    const coeffLatex = this.buildCoeffLatex(coefficients);
    if (coeffLatex !== this.lastCoeffLatex) {
      this.lastCoeffLatex = coeffLatex;
      if (coeffLatex) {
        this.coeffLabelEl.style.display = '';
        this.coeffListEl.style.display = '';
        katex.render(coeffLatex, this.coeffListEl, { throwOnError: false });
      } else {
        this.coeffLabelEl.style.display = 'none';
        this.coeffListEl.style.display = 'none';
      }
    }

    const rootsLatex = this.buildRootsLatex(roots);
    if (rootsLatex !== this.lastRootsLatex) {
      this.lastRootsLatex = rootsLatex;
      if (rootsLatex) {
        this.rootsLabelEl.style.display = '';
        this.rootsListEl.style.display = '';
        katex.render(rootsLatex, this.rootsListEl, { throwOnError: false });
      } else {
        this.rootsLabelEl.style.display = 'none';
        this.rootsListEl.style.display = 'none';
      }
    }
  }

  private formatPointForMode(z: ComplexPoint): string {
    const mode = getCoordinateMode();
    if (mode === 'cartesian') return formatComplexLatex(z);
    if (mode === 'polar') return formatPolarLatex(z);
    return formatEulerLatex(z);
  }

  private buildCoeffLatex(coefficients: ComplexPoint[]): string {
    if (coefficients.length === 0) return '';
    const degree = coefficients.length - 1;
    const lines: string[] = [];
    for (let i = degree; i >= 0; i--) {
      const letter = String.fromCharCode(97 + (degree - i));
      lines.push(`${letter} = ${this.formatPointForMode(coefficients[i])}`);
    }
    return `\\begin{array}{l}${lines.join(' \\\\ ')}\\end{array}`;
  }

  private buildRootsLatex(roots: ComplexPoint[]): string {
    if (roots.length === 0) return '';
    const lines: string[] = [];
    for (let i = 0; i < roots.length; i++) {
      lines.push(`z_{${i + 1}} = ${this.formatPointForMode(roots[i])}`);
    }
    return `\\begin{array}{l}${lines.join(' \\\\ ')}\\end{array}`;
  }

  hide() {
    this.el.style.display = 'none';
  }

  show() {
    this.el.style.display = '';
  }
}
