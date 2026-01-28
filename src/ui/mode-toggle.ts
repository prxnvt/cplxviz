import {
  getCoordinateMode,
  setCoordinateMode,
  onCoordinateModeChange,
  type CoordinateMode,
} from '../state/coordinate-mode.ts';

const MODES: CoordinateMode[] = ['cartesian', 'polar', 'euler'];
const MODE_LABELS: Record<CoordinateMode, string> = {
  cartesian: 'Cartesian',
  polar: 'Polar',
  euler: 'Euler',
};

export class ModeToggle {
  private container: HTMLDivElement;
  private items: Map<CoordinateMode, HTMLSpanElement> = new Map();

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'mode-toggle';

    MODES.forEach((mode, index) => {
      if (index > 0) {
        const separator = document.createElement('span');
        separator.className = 'mode-toggle__separator';
        separator.textContent = '|';
        this.container.appendChild(separator);
      }

      const item = document.createElement('span');
      item.className = 'mode-toggle__item';
      item.textContent = MODE_LABELS[mode];
      item.addEventListener('click', () => setCoordinateMode(mode));
      this.container.appendChild(item);
      this.items.set(mode, item);
    });

    this.updateSelection(getCoordinateMode());

    onCoordinateModeChange((mode) => {
      this.updateSelection(mode);
    });

    parent.appendChild(this.container);
  }

  private updateSelection(activeMode: CoordinateMode): void {
    for (const [mode, item] of this.items) {
      if (mode === activeMode) {
        item.classList.add('mode-toggle__item--active');
      } else {
        item.classList.remove('mode-toggle__item--active');
      }
    }
  }
}
