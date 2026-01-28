export type CoordinateMode = 'cartesian' | 'polar' | 'euler';

let currentMode: CoordinateMode = 'cartesian';
const listeners: Set<(mode: CoordinateMode) => void> = new Set();

export function getCoordinateMode(): CoordinateMode {
  return currentMode;
}

export function setCoordinateMode(mode: CoordinateMode): void {
  if (currentMode !== mode) {
    currentMode = mode;
    for (const listener of listeners) {
      listener(mode);
    }
  }
}

export function cycleCoordinateMode(): void {
  const next: CoordinateMode =
    currentMode === 'cartesian' ? 'polar' :
    currentMode === 'polar' ? 'euler' : 'cartesian';
  setCoordinateMode(next);
}

export function onCoordinateModeChange(listener: (mode: CoordinateMode) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
