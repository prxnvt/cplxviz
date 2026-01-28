import katex from 'katex';
import {
  getCoordinateMode,
  setCoordinateMode,
  onCoordinateModeChange,
  type CoordinateMode,
} from '../state/coordinate-mode.ts';
import { getLightFalloff, setLightFalloff, onLightFalloffChange } from '../state/light-falloff.ts';

const MODES: CoordinateMode[] = ['cartesian', 'polar', 'euler'];
const MODE_LABELS: Record<CoordinateMode, string> = {
  cartesian: 'Cartesian',
  polar: 'Polar',
  euler: 'Euler',
};

export class ModeToggle {
  private container: HTMLDivElement;
  private items: Map<CoordinateMode, HTMLSpanElement> = new Map();
  private infoPopup: HTMLDivElement | null = null;
  private settingsPopup: HTMLDivElement | null = null;

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

    // Add Info button
    const infoSeparator = document.createElement('span');
    infoSeparator.className = 'mode-toggle__separator';
    infoSeparator.textContent = '|';
    this.container.appendChild(infoSeparator);

    const infoItem = document.createElement('span');
    infoItem.className = 'mode-toggle__item';
    infoItem.textContent = 'Info';
    infoItem.addEventListener('click', () => this.toggleInfoPopup());
    this.container.appendChild(infoItem);

    // Add Settings button
    const settingsSeparator = document.createElement('span');
    settingsSeparator.className = 'mode-toggle__separator';
    settingsSeparator.textContent = '|';
    this.container.appendChild(settingsSeparator);

    const settingsItem = document.createElement('span');
    settingsItem.className = 'mode-toggle__item';
    settingsItem.textContent = 'Settings';
    settingsItem.addEventListener('click', () => this.toggleSettingsPopup());
    this.container.appendChild(settingsItem);

    this.updateSelection(getCoordinateMode());

    onCoordinateModeChange((mode) => {
      this.updateSelection(mode);
    });

    parent.appendChild(this.container);
    this.createInfoPopup(parent);
    this.createSettingsPopup(parent);
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

  private createInfoPopup(parent: HTMLElement): void {
    this.infoPopup = document.createElement('div');
    this.infoPopup.className = 'popup popup--hidden';
    this.infoPopup.innerHTML = `
      <div class="popup__header">
        <span class="popup__title">Info</span>
        <span class="popup__close">&times;</span>
      </div>
      <div class="popup__content">
        <div class="popup__text">
          <p>This is a <strong>Complex Polynomial Visualizer</strong>.</p>
          <p class="popup__math"></p>
          <p>The colored region shows the <em>phase plot</em> (domain coloring) of the polynomial, where each color represents the argument (angle) of the output value.</p>
          <p>Roots of the polynomial are shown as glowing white orbs.</p>
          <p class="popup__hint">Move the circles and orbs around, or try editing the coefficient, root, or polynomial fields to see the graph change.</p>
        </div>
      </div>
    `;

    // Render KaTeX for polynomial formula
    const mathEl = this.infoPopup.querySelector('.popup__math') as HTMLElement;
    katex.render('P(z) = a_n z^n + a_{n-1} z^{n-1} + \\cdots + a_1 z + a_0', mathEl, { throwOnError: false });

    const closeBtn = this.infoPopup.querySelector('.popup__close') as HTMLElement;
    closeBtn.addEventListener('click', () => this.hideInfoPopup());

    parent.appendChild(this.infoPopup);
  }

  private createSettingsPopup(parent: HTMLElement): void {
    this.settingsPopup = document.createElement('div');
    this.settingsPopup.className = 'popup popup--hidden';
    this.settingsPopup.innerHTML = `
      <div class="popup__header">
        <span class="popup__title">Settings</span>
        <span class="popup__close">&times;</span>
      </div>
      <div class="popup__content">
        <div class="popup__setting">
          <label class="popup__label">Light</label>
          <div class="popup__slider-container">
            <span class="popup__slider-label">Min</span>
            <input type="range" class="popup__slider" id="light-slider" min="0" max="100" value="${getLightFalloff()}">
            <span class="popup__slider-label">Max</span>
          </div>
          <p class="popup__description">Controls light falloff. Max = no falloff, Min = near-immediate falloff.</p>
        </div>
      </div>
    `;

    const closeBtn = this.settingsPopup.querySelector('.popup__close') as HTMLElement;
    closeBtn.addEventListener('click', () => this.hideSettingsPopup());

    const slider = this.settingsPopup.querySelector('#light-slider') as HTMLInputElement;
    slider.addEventListener('input', () => {
      setLightFalloff(parseInt(slider.value, 10));
    });

    onLightFalloffChange((value) => {
      slider.value = String(value);
    });

    parent.appendChild(this.settingsPopup);
  }

  private toggleInfoPopup(): void {
    if (this.infoPopup?.classList.contains('popup--hidden')) {
      this.hideSettingsPopup();
      this.infoPopup.classList.remove('popup--hidden');
    } else {
      this.hideInfoPopup();
    }
  }

  private hideInfoPopup(): void {
    this.infoPopup?.classList.add('popup--hidden');
  }

  private toggleSettingsPopup(): void {
    if (this.settingsPopup?.classList.contains('popup--hidden')) {
      this.hideInfoPopup();
      this.settingsPopup.classList.remove('popup--hidden');
    } else {
      this.hideSettingsPopup();
    }
  }

  private hideSettingsPopup(): void {
    this.settingsPopup?.classList.add('popup--hidden');
  }
}
