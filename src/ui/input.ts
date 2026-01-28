import katex from 'katex';

export class PolynomialInput {
  private input: HTMLInputElement;
  private display: HTMLElement;
  private labelEl: HTMLElement;
  private debounceTimer = 0;
  private editing = true;

  constructor(
    container: HTMLElement,
    onChange: (value: string) => void,
    onSubmit?: (value: string) => void,
  ) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-container';

    const header = document.createElement('div');
    header.className = 'input-header';
    header.textContent = 'Input';

    const row = document.createElement('div');
    row.className = 'input-row';

    this.labelEl = document.createElement('span');
    this.labelEl.className = 'input-label';
    katex.render('f(z) =', this.labelEl, { throwOnError: false });

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'poly-input';
    this.input.placeholder = 'z^3 - 1';
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';

    this.display = document.createElement('div');
    this.display.className = 'poly-display';
    this.display.style.display = 'none';

    row.appendChild(this.labelEl);
    row.appendChild(this.input);
    row.appendChild(this.display);

    wrapper.appendChild(header);
    wrapper.appendChild(row);
    container.appendChild(wrapper);

    this.input.addEventListener('input', () => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = window.setTimeout(() => {
        onChange(this.input.value);
      }, 300);
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(this.debounceTimer);
        onChange(this.input.value);
        onSubmit?.(this.input.value);
        this.input.blur();
      }
    });

    this.input.addEventListener('blur', () => {
      // If we have rendered LaTeX content, switch to display mode
      if (this.display.childNodes.length > 0 && this.input.value.trim()) {
        this.editing = false;
        this.input.style.display = 'none';
        this.display.style.display = '';
      }
    });

    this.display.addEventListener('click', () => {
      this.editing = true;
      this.display.style.display = 'none';
      this.input.style.display = '';
      this.input.focus();
    });
  }

  setError(hasError: boolean) {
    if (hasError) {
      this.input.classList.add('poly-input--error');
      this.display.classList.add('poly-input--error');
    } else {
      this.input.classList.remove('poly-input--error');
      this.display.classList.remove('poly-input--error');
    }
  }

  getValue(): string {
    return this.input.value;
  }

  setValue(value: string) {
    this.input.value = value;
  }

  /** Render LaTeX in the display element. Call after setValue with standard form. */
  setLatex(latex: string) {
    katex.render(latex, this.display, { throwOnError: false, displayMode: false });
    // If not actively editing, switch to display mode
    if (!this.editing || document.activeElement !== this.input) {
      this.editing = false;
      this.input.style.display = 'none';
      this.display.style.display = '';
    }
  }
}
