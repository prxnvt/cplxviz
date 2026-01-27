export interface ComplexPoint {
  re: number;
  im: number;
}

export interface Polynomial {
  coefficients: ComplexPoint[]; // ascending order: [a0, a1, ..., an] => a0 + a1*z + ... + an*z^n
  degree: number;
  variable: string;
}

export interface Viewport {
  center: ComplexPoint;
  scale: number; // complex units per pixel
}

export type ParseResult =
  | { ok: true; polynomial: Polynomial }
  | { ok: false; error: string };

export interface RootFindingResult {
  roots: ComplexPoint[];
  converged: boolean;
}
