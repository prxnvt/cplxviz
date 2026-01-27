import type { ComplexPoint } from '../types/index.ts';

export function add(a: ComplexPoint, b: ComplexPoint): ComplexPoint {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function subtract(a: ComplexPoint, b: ComplexPoint): ComplexPoint {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function multiply(a: ComplexPoint, b: ComplexPoint): ComplexPoint {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function divide(a: ComplexPoint, b: ComplexPoint): ComplexPoint {
  const denom = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

export function magnitude(z: ComplexPoint): number {
  return Math.sqrt(z.re * z.re + z.im * z.im);
}

/** Evaluate polynomial using Horner's method. Coefficients in ascending order. */
export function evaluatePolynomial(coeffs: ComplexPoint[], z: ComplexPoint): ComplexPoint {
  // coeffs = [a0, a1, ..., an] -> a0 + a1*z + a2*z^2 + ... + an*z^n
  // Horner's: rewrite as a0 + z*(a1 + z*(a2 + ... + z*an))
  let result: ComplexPoint = { re: 0, im: 0 };
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = multiply(result, z);
    result = add(result, coeffs[i]);
  }
  return result;
}

export function approxEqual(a: ComplexPoint, b: ComplexPoint, eps = 1e-10): boolean {
  return Math.abs(a.re - b.re) < eps && Math.abs(a.im - b.im) < eps;
}

export function formatComplex(z: ComplexPoint, precision = 3): string {
  const re = cleanFloat(z.re, precision);
  const im = cleanFloat(z.im, precision);

  if (im === 0) return `${re}`;
  if (re === 0) {
    if (im === 1) return 'i';
    if (im === -1) return '−i';
    return `${formatSignedIm(im)}i`;
  }
  const sign = im > 0 ? ' + ' : ' − ';
  const absIm = Math.abs(im);
  const imPart = absIm === 1 ? 'i' : `${absIm}i`;
  return `${re}${sign}${imPart}`;
}

function cleanFloat(x: number, precision: number): number {
  return parseFloat(x.toFixed(precision));
}

function formatSignedIm(im: number): string {
  if (im === 1) return '';
  if (im === -1) return '−';
  return im < 0 ? `−${Math.abs(im)}` : `${im}`;
}

export function argument(z: ComplexPoint): number {
  return Math.atan2(z.im, z.re);
}

/** Format a complex number in standard LaTeX form, e.g. "1 + 2i", "-3 - i" */
export function formatComplexLatex(z: ComplexPoint, precision = 3): string {
  const re = cleanFloat(z.re, precision);
  const im = cleanFloat(z.im, precision);

  if (re === 0 && im === 0) return '0';
  if (im === 0) return formatLatexNum(re);
  if (re === 0) {
    if (im === 1) return 'i';
    if (im === -1) return '-i';
    return `${formatLatexNum(im)}i`;
  }
  const sign = im > 0 ? ' + ' : ' - ';
  const absIm = Math.abs(im);
  const imPart = absIm === 1 ? 'i' : `${formatLatexNum(absIm)}i`;
  return `${formatLatexNum(re)}${sign}${imPart}`;
}

function formatLatexNum(n: number): string {
  // Avoid "-0"
  if (Object.is(n, -0)) return '0';
  return String(n);
}

/**
 * Express an angle as a LaTeX fraction of pi.
 * Checks common fractions (halves, thirds, quarters, sixths, eighths, twelfths).
 */
function formatAngleLatex(phi: number): string {
  if (Math.abs(phi) < 1e-10) return '0';
  if (Math.abs(phi - Math.PI) < 1e-10) return '\\pi';
  if (Math.abs(phi + Math.PI) < 1e-10) return '-\\pi';

  const ratio = phi / Math.PI;

  // Check common fractions: denominator -> [numerators to check]
  const denoms = [2, 3, 4, 6, 8, 12];
  for (const d of denoms) {
    const n = ratio * d;
    const nRound = Math.round(n);
    if (Math.abs(n - nRound) < 1e-6 && nRound !== 0) {
      const num = nRound;
      const den = d;
      // Simplify fraction
      const g = gcd(Math.abs(num), den);
      const sn = num / g;
      const sd = den / g;

      if (sd === 1) {
        // Integer multiple of pi
        if (sn === 1) return '\\pi';
        if (sn === -1) return '-\\pi';
        return `${sn}\\pi`;
      }
      const sign = sn < 0 ? '-' : '';
      const absN = Math.abs(sn);
      const piPart = absN === 1 ? '\\pi' : `${absN}\\pi`;
      return `${sign}\\frac{${piPart}}{${sd}}`;
    }
  }

  // Fallback: decimal multiple
  const rounded = parseFloat(ratio.toFixed(3));
  return `${rounded}\\pi`;
}

function gcd(a: number, b: number): number {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Format a magnitude for polar form display.
 * Uses sqrt notation for common values.
 */
function formatMagnitudeLatex(r: number): string {
  if (Math.abs(r) < 1e-10) return '0';
  if (Math.abs(r - 1) < 1e-10) return '1';

  // Check if r^2 is a small integer (for sqrt display)
  const r2 = r * r;
  const r2Round = Math.round(r2);
  if (r2Round >= 2 && r2Round <= 100 && Math.abs(r2 - r2Round) < 1e-6) {
    // Check if it's a perfect square
    const sqrtInt = Math.round(Math.sqrt(r2Round));
    if (sqrtInt * sqrtInt === r2Round) {
      return String(sqrtInt);
    }
    return `\\sqrt{${r2Round}}`;
  }

  return parseFloat(r.toFixed(3)).toString();
}

/** Full polar LaTeX string, e.g. "\\sqrt{2}\\left(\\cos\\frac{\\pi}{4} + i\\sin\\frac{\\pi}{4}\\right)" */
export function formatPolarLatex(z: ComplexPoint, precision = 3): string {
  const re = cleanFloat(z.re, precision);
  const im = cleanFloat(z.im, precision);

  if (re === 0 && im === 0) return '0';

  const r = magnitude(z);
  const phi = argument(z);
  const rStr = formatMagnitudeLatex(r);
  const phiStr = formatAngleLatex(phi);

  // Simplified forms for real/imaginary axis
  if (Math.abs(phi) < 1e-10) {
    // Positive real: just show r
    return rStr;
  }
  if (Math.abs(Math.abs(phi) - Math.PI) < 1e-10) {
    // Negative real: -r
    return `-${rStr}`;
  }

  if (rStr === '1') {
    return `\\cos ${phiStr} + i\\sin ${phiStr}`;
  }

  return `${rStr}\\!\\left(\\cos ${phiStr} + i\\sin ${phiStr}\\right)`;
}
