// Light falloff state: 0 = near-immediate falloff (min), 100 = no falloff (max)
let currentFalloff = 50; // Default to middle value
const listeners: Set<(value: number) => void> = new Set();

export function getLightFalloff(): number {
  return currentFalloff;
}

export function setLightFalloff(value: number): void {
  const clamped = Math.max(0, Math.min(100, value));
  if (currentFalloff !== clamped) {
    currentFalloff = clamped;
    for (const listener of listeners) {
      listener(clamped);
    }
  }
}

export function onLightFalloffChange(listener: (value: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
