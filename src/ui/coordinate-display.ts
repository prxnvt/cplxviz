import katex from 'katex';
import type { ComplexPoint } from '../types/index.ts';
import { formatComplexLatex, formatPolarLatex, formatEulerLatex } from '../math/complex.ts';
import { parseComplexExpression } from '../math/polynomial.ts';
import { getCoordinateMode, onCoordinateModeChange } from '../state/coordinate-mode.ts';

export interface CoordinateDisplayOptions {
  onCoefficientEdit?: (index: number, value: ComplexPoint) => void;
  onRootEdit?: (index: number, value: ComplexPoint) => void;
}

interface EditState {
  type: 'coeff' | 'root';
  index: number;
  inputValue: string;
  isValid: boolean;
}

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
  private cachedCoefficients: ComplexPoint[] = [];
  private cachedRoots: ComplexPoint[] = [];
  private cachedCursorPoint: ComplexPoint | null = null;
  private cachedCursorLabel = '';
  private editState: EditState | null = null;
  private options: CoordinateDisplayOptions;
  private commitTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentPreviewEl: HTMLDivElement | null = null;
  private currentInputEl: HTMLInputElement | null = null;
  private isProcessingInput = false;

  constructor(container: HTMLElement, options: CoordinateDisplayOptions = {}) {
    this.options = options;
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
  }

  private rerender(): void {
    // Re-render cursor position if we have a cached point
    if (this.cachedCursorPoint) {
      this.update(this.cachedCursorPoint, this.cachedCursorLabel);
    }

    // Re-render polynomial data if we have cached values
    if (this.cachedCoefficients.length > 0 || this.cachedRoots.length > 0) {
      this.renderPolynomialData();
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
    this.renderPolynomialData();
  }

  private renderPolynomialData() {
    const { cachedCoefficients: coefficients, cachedRoots: roots } = this;

    // Render coefficients
    if (coefficients.length === 0) {
      this.coeffLabelEl.style.display = 'none';
      this.coeffListEl.style.display = 'none';
    } else {
      this.coeffLabelEl.style.display = '';
      this.coeffListEl.style.display = '';
      this.renderCoefficients(coefficients);
    }

    // Render roots
    if (roots.length === 0) {
      this.rootsLabelEl.style.display = 'none';
      this.rootsListEl.style.display = 'none';
    } else {
      this.rootsLabelEl.style.display = '';
      this.rootsListEl.style.display = '';
      this.renderRoots(roots);
    }
  }

  private formatPointForMode(z: ComplexPoint): string {
    const mode = getCoordinateMode();
    if (mode === 'cartesian') return formatComplexLatex(z);
    if (mode === 'polar') return formatPolarLatex(z);
    return formatEulerLatex(z);
  }

  private renderCoefficients(coefficients: ComplexPoint[]) {
    this.coeffListEl.innerHTML = '';
    const degree = coefficients.length - 1;

    for (let i = degree; i >= 0; i--) {
      const letter = String.fromCharCode(97 + (degree - i));
      const isEditing = this.editState?.type === 'coeff' && this.editState.index === i;

      const row = this.createRow(
        `${letter} = `,
        coefficients[i],
        isEditing,
        () => this.startEditing('coeff', i, coefficients[i]),
      );
      this.coeffListEl.appendChild(row);
    }
  }

  private renderRoots(roots: ComplexPoint[]) {
    this.rootsListEl.innerHTML = '';

    for (let i = 0; i < roots.length; i++) {
      const isEditing = this.editState?.type === 'root' && this.editState.index === i;

      const row = this.createRow(
        '', // Label will be KaTeX
        roots[i],
        isEditing,
        () => this.startEditing('root', i, roots[i]),
        `z_{${i + 1}} = `
      );
      this.rootsListEl.appendChild(row);
    }
  }

  private createRow(
    labelText: string,
    value: ComplexPoint,
    isEditing: boolean,
    onClickValue: () => void,
    labelLatex?: string
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'coord-row';

    // Label
    const label = document.createElement('span');
    label.className = 'coord-row__label';
    if (labelLatex) {
      katex.render(labelLatex, label, { throwOnError: false });
    } else {
      label.textContent = labelText;
    }
    row.appendChild(label);

    if (isEditing && this.editState) {
      // Edit mode: input + preview
      const editContainer = document.createElement('div');
      editContainer.className = 'coord-row__edit';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'coord-row__input';
      if (!this.editState.isValid && this.editState.inputValue) {
        input.classList.add('coord-row__input--error');
      }
      input.value = this.editState.inputValue;

      input.addEventListener('input', (e) => {
        this.handleInput((e.target as HTMLInputElement).value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.commitEdit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelEdit();
        }
      });
      input.addEventListener('blur', () => {
        // Don't commit if we're in the middle of processing input
        if (this.isProcessingInput) return;

        // Delay to allow click events on other elements to fire first
        this.commitTimeout = setTimeout(() => {
          this.commitEdit();
        }, 150);
      });

      editContainer.appendChild(input);

      // Live preview
      const preview = document.createElement('div');
      preview.className = 'coord-row__preview';

      if (this.editState.inputValue) {
        const parseResult = parseComplexExpression(this.editState.inputValue);
        if (parseResult.ok && parseResult.value) {
          katex.render(this.formatPointForMode(parseResult.value), preview, { throwOnError: false });
        } else {
          preview.classList.add('coord-row__preview--error');
          preview.textContent = parseResult.error || 'Invalid';
        }
      }

      editContainer.appendChild(preview);
      row.appendChild(editContainer);

      // Store references for live updates without re-render
      this.currentInputEl = input;
      this.currentPreviewEl = preview;

      // Focus the input after it's added to DOM
      requestAnimationFrame(() => input.focus());
    } else {
      // Display mode: clickable value
      const valueEl = document.createElement('span');
      valueEl.className = 'coord-row__value';
      katex.render(this.formatPointForMode(value), valueEl, { throwOnError: false });
      valueEl.addEventListener('click', (e) => {
        e.stopPropagation();
        onClickValue();
      });
      row.appendChild(valueEl);
    }

    return row;
  }

  private startEditing(type: 'coeff' | 'root', index: number, currentValue: ComplexPoint) {
    // Cancel any pending commit
    if (this.commitTimeout) {
      clearTimeout(this.commitTimeout);
      this.commitTimeout = null;
    }

    this.editState = {
      type,
      index,
      inputValue: this.formatForInput(currentValue),
      isValid: true,
    };
    this.renderPolynomialData();
  }

  private handleInput(value: string) {
    if (!this.editState) return;

    this.isProcessingInput = true;
    try {
      const parseResult = parseComplexExpression(value);
      this.editState.inputValue = value;
      this.editState.isValid = parseResult.ok;

      // Update input error state
      if (this.currentInputEl) {
        if (!parseResult.ok && value) {
          this.currentInputEl.classList.add('coord-row__input--error');
        } else {
          this.currentInputEl.classList.remove('coord-row__input--error');
        }
      }

      // Update preview only, don't re-render everything
      if (this.currentPreviewEl) {
        // Clear previous content
        while (this.currentPreviewEl.firstChild) {
          this.currentPreviewEl.removeChild(this.currentPreviewEl.firstChild);
        }
        this.currentPreviewEl.classList.remove('coord-row__preview--error');

        if (value) {
          if (parseResult.ok && parseResult.value) {
            katex.render(this.formatPointForMode(parseResult.value), this.currentPreviewEl, { throwOnError: false });
          } else {
            this.currentPreviewEl.classList.add('coord-row__preview--error');
            this.currentPreviewEl.textContent = parseResult.error || 'Invalid';
          }
        }
      }
    } catch (e) {
      // Silently handle any errors to prevent edit mode from breaking
      console.error('Error in handleInput:', e);
    } finally {
      this.isProcessingInput = false;
    }
  }

  private commitEdit() {
    if (this.commitTimeout) {
      clearTimeout(this.commitTimeout);
      this.commitTimeout = null;
    }

    if (!this.editState) return;

    const { type, index, inputValue } = this.editState;
    const parseResult = parseComplexExpression(inputValue);

    if (parseResult.ok && parseResult.value) {
      if (type === 'coeff' && this.options.onCoefficientEdit) {
        this.options.onCoefficientEdit(index, parseResult.value);
      } else if (type === 'root' && this.options.onRootEdit) {
        this.options.onRootEdit(index, parseResult.value);
      }
    }

    this.editState = null;
    this.currentInputEl = null;
    this.currentPreviewEl = null;
    this.renderPolynomialData();
  }

  private cancelEdit() {
    if (this.commitTimeout) {
      clearTimeout(this.commitTimeout);
      this.commitTimeout = null;
    }

    this.editState = null;
    this.currentInputEl = null;
    this.currentPreviewEl = null;
    this.renderPolynomialData();
  }

  private formatForInput(z: ComplexPoint): string {
    const re = z.re;
    const im = z.im;

    // Clean near-zero
    const cleanRe = Math.abs(re) < 1e-10 ? 0 : re;
    const cleanIm = Math.abs(im) < 1e-10 ? 0 : im;

    if (cleanIm === 0) {
      return this.formatNumber(cleanRe);
    }
    if (cleanRe === 0) {
      if (cleanIm === 1) return 'i';
      if (cleanIm === -1) return '-i';
      return `${this.formatNumber(cleanIm)}i`;
    }

    // Both parts non-zero
    const sign = cleanIm > 0 ? '+' : '-';
    const absIm = Math.abs(cleanIm);
    const imPart = absIm === 1 ? 'i' : `${this.formatNumber(absIm)}i`;
    return `${this.formatNumber(cleanRe)}${sign}${imPart}`;
  }

  private formatNumber(n: number): string {
    // Check for integer
    if (Number.isInteger(n)) return String(n);
    // Round to reasonable precision
    const rounded = parseFloat(n.toPrecision(6));
    return String(rounded);
  }

  hide() {
    this.el.style.display = 'none';
  }

  show() {
    this.el.style.display = '';
  }
}
