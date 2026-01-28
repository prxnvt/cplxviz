import { parse, derivative, isComplex, polynomialRoot } from 'mathjs';
import type { MathNode } from 'mathjs';
import type { ComplexPoint, Polynomial, ParseResult, RootFindingResult } from '../types/index.ts';
import { add, multiply, subtract, divide, evaluatePolynomial, magnitude, formatComplex, formatPolarLatex, formatEulerLatex } from './complex.ts';
import type { CoordinateMode } from '../state/coordinate-mode.ts';

export interface ComplexParseResult {
  ok: boolean;
  value?: ComplexPoint;
  error?: string;
}

/**
 * Parse an expression that evaluates to a single complex number.
 * Accepts: sqrt(2), pi, e, i, 2i, 1+i, 2^3, cos(pi/4), sin(pi/3), sqrt(2)/2
 */
export function parseComplexExpression(input: string): ComplexParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: '' }; // empty input, silent
  }

  try {
    let processed = trimmed;

    // Pre-process trig functions with non-parenthesized arguments:
    // sinpi → sin(pi), cos2 → cos(2), etc.
    processed = processed.replace(
      /\b(sin|cos|tan|cot|sec|csc)([a-zA-Z0-9]+)(?!\s*\()/g,
      (_, fn, arg) => {
        const expanded = arg.replace(/^(\d+)([a-zA-Z])/, '$1*$2');
        return `${fn}(${expanded})`;
      }
    );

    // Pre-process `i` into mathjs complex literals:
    // 1. `2i` at word boundary → `2*(1i)`
    // 2. `i` standalone → `(1i)`
    processed = processed.replace(/(\d)i(?![a-zA-Z])/g, '$1*(1i)');
    processed = processed.replace(/(?<![a-zA-Z0-9])i(?![a-zA-Z0-9])/g, '(1i)');

    const tree = parse(processed);

    // Evaluate the expression - mathjs will throw if there are undefined symbols
    const value = tree.evaluate();

    // Convert to ComplexPoint
    let result: ComplexPoint;
    if (typeof value === 'number') {
      result = { re: value, im: 0 };
    } else if (isComplex(value)) {
      result = { re: (value as { re: number; im: number }).re, im: (value as { re: number; im: number }).im };
    } else {
      result = { re: Number(value), im: 0 };
    }

    // Clean near-zero components
    if (Math.abs(result.re) < 1e-10) result.re = 0;
    if (Math.abs(result.im) < 1e-10) result.im = 0;

    // Check for NaN/Infinity
    if (!isFinite(result.re) || !isFinite(result.im)) {
      return { ok: false, error: 'Result is not finite' };
    }

    return { ok: true, value: result };
  } catch {
    return { ok: false, error: 'Invalid expression' };
  }
}

/**
 * Parse a polynomial expression, supporting complex coefficients (including `i`).
 * Uses mathjs parse + successive derivatives evaluated at 0 to extract coefficients.
 */
export function parsePolynomial(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: '' }; // empty input, silent
  }

  // Check for invalid trig patterns: sin-x, cos-x (negative arg without parentheses)
  if (/(?:sin|cos|tan|cot|sec|csc)-[a-zA-Z0-9]/.test(trimmed)) {
    return { ok: false, error: 'Negative trig arguments must be in parentheses, e.g. sin(-x)' };
  }

  try {
    let processed = trimmed;

    // Pre-process trig functions with non-parenthesized arguments:
    // sinx → sin(x), sin2x → sin(2*x), sinpi → sin(pi), etc.
    // But not sin(x) which already has parens
    processed = processed.replace(
      /\b(sin|cos|tan|cot|sec|csc)([a-zA-Z0-9]+)(?!\s*\()/g,
      (_, fn, arg) => {
        // Check if arg starts with a digit followed by letters (like 2x → 2*x)
        const expanded = arg.replace(/^(\d+)([a-zA-Z])/, '$1*$2');
        return `${fn}(${expanded})`;
      }
    );

    // Pre-process `i` into mathjs complex literals:
    // 1. `2iz` → `2*(1i)*z` (digit-i-variable)
    // 2. `iz` → `(1i)*z` (standalone i before variable)
    // 3. `i` → `(1i)` (standalone i, not adjacent to letter/digit)
    processed = processed.replace(/(\d)i(?=[a-zA-Z])/g, '$1*(1i)*');
    processed = processed.replace(/(?<![a-zA-Z0-9])i(?=[a-zA-Z])/g, '(1i)*');
    processed = processed.replace(/(?<![a-zA-Z0-9])i(?![a-zA-Z0-9])/g, '(1i)');

    const tree = parse(processed);

    // Detect the free variable (ignore `i` which we already replaced, and built-in constants)
    const builtinConstants = new Set(['i', 'pi', 'e']);
    const variables = new Set<string>();
    tree.traverse((node: MathNode) => {
      if (node.type === 'SymbolNode') {
        const name = (node as unknown as { name: string }).name;
        if (!builtinConstants.has(name)) {
          variables.add(name);
        }
      }
    });

    if (variables.size === 0) {
      return { ok: false, error: 'Expression must contain a variable (e.g. z)' };
    }
    if (variables.size > 1) {
      return { ok: false, error: `Expected single variable, found: ${[...variables].join(', ')}` };
    }

    const variable = [...variables][0];

    // Extract coefficients via successive derivatives at z=0
    // f(0) = a0, f'(0) = a1, f''(0)/2! = a2, etc.
    const maxDegree = 5; // We'll check up to degree 5 to verify it's 0
    const coefficients: ComplexPoint[] = [];
    let currentExpr: MathNode = tree;
    let factorial = 1;

    for (let n = 0; n <= maxDegree; n++) {
      if (n > 0) factorial *= n;

      // Evaluate the n-th derivative at variable=0
      const value = currentExpr.evaluate({ [variable]: 0 });

      // Convert to ComplexPoint
      let coeff: ComplexPoint;
      if (typeof value === 'number') {
        coeff = { re: value, im: 0 };
      } else if (isComplex(value)) {
        coeff = { re: (value as { re: number; im: number }).re, im: (value as { re: number; im: number }).im };
      } else {
        coeff = { re: Number(value), im: 0 };
      }

      // Divide by factorial to get the coefficient
      const c: ComplexPoint = { re: coeff.re / factorial, im: coeff.im / factorial };

      if (n <= 4) {
        coefficients.push(c);
      } else {
        // 5th derivative must be ~0 for degree ≤ 4
        if (Math.abs(c.re) > 1e-6 || Math.abs(c.im) > 1e-6) {
          return { ok: false, error: 'Maximum supported degree is 4' };
        }
      }

      // Take the next derivative
      if (n < maxDegree) {
        currentExpr = derivative(currentExpr, variable);
      }
    }

    // Trim trailing zero coefficients
    while (coefficients.length > 1) {
      const last = coefficients[coefficients.length - 1];
      if (Math.abs(last.re) < 1e-10 && Math.abs(last.im) < 1e-10) {
        coefficients.pop();
      } else {
        break;
      }
    }

    const degree = coefficients.length - 1;
    if (degree === 0) {
      return { ok: false, error: 'Expression is a constant, not a polynomial' };
    }

    // Clean near-zero components in coefficients
    for (const c of coefficients) {
      if (Math.abs(c.re) < 1e-10) c.re = 0;
      if (Math.abs(c.im) < 1e-10) c.im = 0;
    }

    return {
      ok: true,
      polynomial: { coefficients, degree, variable },
    };
  } catch {
    return { ok: false, error: 'Invalid expression' };
  }
}

function isZero(c: ComplexPoint): boolean {
  return cleanFloat(c.re) === 0 && cleanFloat(c.im) === 0;
}

function isReal(c: ComplexPoint): boolean {
  return cleanFloat(c.im) === 0;
}

function isImaginary(c: ComplexPoint): boolean {
  return cleanFloat(c.re) === 0 && cleanFloat(c.im) !== 0;
}

function cleanFloat(x: number, precision = 6): number {
  return parseFloat(x.toFixed(precision));
}

function formatRealCoeff(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return parseFloat(n.toPrecision(6)).toString();
}

/** Format polynomial in standard form: an*z^n + ... + a1*z + a0 (plain text) */
export function formatPolynomial(poly: Polynomial): string {
  const { coefficients, degree, variable } = poly;
  const parts: string[] = [];

  for (let i = degree; i >= 0; i--) {
    const c = coefficients[i];
    if (isZero(c)) continue;

    const re = cleanFloat(c.re);
    const im = cleanFloat(c.im);

    let sign: string;
    let term: string;

    if (isReal(c)) {
      // Purely real coefficient
      const absC = Math.abs(re);
      sign = re < 0 ? '-' : '+';
      if (i === 0) {
        term = formatRealCoeff(absC);
      } else if (i === 1) {
        term = absC === 1 ? variable : `${formatRealCoeff(absC)} * ${variable}`;
      } else {
        term = absC === 1 ? `${variable}^${i}` : `${formatRealCoeff(absC)} * ${variable}^${i}`;
      }
    } else if (isImaginary(c)) {
      // Purely imaginary coefficient
      const absIm = Math.abs(im);
      sign = im < 0 ? '-' : '+';
      if (i === 0) {
        term = absIm === 1 ? 'i' : `${formatRealCoeff(absIm)}i`;
      } else if (i === 1) {
        term = absIm === 1 ? `i * ${variable}` : `${formatRealCoeff(absIm)}i * ${variable}`;
      } else {
        term = absIm === 1 ? `i * ${variable}^${i}` : `${formatRealCoeff(absIm)}i * ${variable}^${i}`;
      }
    } else {
      // Full complex coefficient
      sign = '+';
      const complexStr = formatComplex(c);
      if (i === 0) {
        term = `(${complexStr})`;
      } else if (i === 1) {
        term = `(${complexStr}) * ${variable}`;
      } else {
        term = `(${complexStr}) * ${variable}^${i}`;
      }
    }

    if (parts.length === 0) {
      parts.push(sign === '-' ? `-${term}` : term);
    } else {
      parts.push(`${sign} ${term}`);
    }
  }

  return parts.length > 0 ? parts.join(' ') : '0';
}

/** Format polynomial as a LaTeX string for KaTeX rendering. */
export function formatPolynomialLatex(poly: Polynomial, mode: CoordinateMode = 'cartesian'): string {
  const { coefficients, degree, variable } = poly;
  const parts: string[] = [];

  // Choose formatter based on mode
  const formatCoeff = (c: ComplexPoint): string => {
    if (mode === 'polar') return formatPolarLatex(c);
    if (mode === 'euler') return formatEulerLatex(c);
    return formatComplexLatex(c);
  };

  for (let i = degree; i >= 0; i--) {
    const c = coefficients[i];
    if (isZero(c)) continue;

    const re = cleanFloat(c.re);
    const im = cleanFloat(c.im);

    let sign: string;
    let term: string;

    // In polar/euler mode, always use the full formatter
    if (mode !== 'cartesian') {
      sign = '+';
      const coeffStr = formatCoeff(c);
      if (i === 0) {
        term = `(${coeffStr})`;
      } else if (i === 1) {
        term = `(${coeffStr})${variable}`;
      } else {
        term = `(${coeffStr})${variable}^{${i}}`;
      }
    } else if (isReal(c)) {
      const absC = Math.abs(re);
      sign = re < 0 ? '-' : '+';
      if (i === 0) {
        term = formatRealCoeff(absC);
      } else if (i === 1) {
        term = absC === 1 ? variable : `${formatRealCoeff(absC)}${variable}`;
      } else {
        term = absC === 1
          ? `${variable}^{${i}}`
          : `${formatRealCoeff(absC)}${variable}^{${i}}`;
      }
    } else if (isImaginary(c)) {
      const absIm = Math.abs(im);
      sign = im < 0 ? '-' : '+';
      if (i === 0) {
        term = absIm === 1 ? 'i' : `${formatRealCoeff(absIm)}i`;
      } else if (i === 1) {
        term = absIm === 1 ? `i${variable}` : `${formatRealCoeff(absIm)}i${variable}`;
      } else {
        term = absIm === 1
          ? `i${variable}^{${i}}`
          : `${formatRealCoeff(absIm)}i${variable}^{${i}}`;
      }
    } else {
      // Full complex
      sign = '+';
      const complexLatex = formatComplexLatex(c);
      if (i === 0) {
        term = `(${complexLatex})`;
      } else if (i === 1) {
        term = `(${complexLatex})${variable}`;
      } else {
        term = `(${complexLatex})${variable}^{${i}}`;
      }
    }

    if (parts.length === 0) {
      parts.push(sign === '-' ? `-${term}` : term);
    } else {
      parts.push(`${sign} ${term}`);
    }
  }

  return parts.length > 0 ? parts.join(' ') : '0';
}

function formatComplexLatex(z: ComplexPoint): string {
  const re = cleanFloat(z.re);
  const im = cleanFloat(z.im);
  if (im === 0) return formatRealCoeff(Math.abs(re));
  if (re === 0) {
    const absIm = Math.abs(im);
    return absIm === 1 ? 'i' : `${formatRealCoeff(absIm)}i`;
  }
  const sign = im > 0 ? '+' : '-';
  const absIm = Math.abs(im);
  const imPart = absIm === 1 ? 'i' : `${formatRealCoeff(absIm)}i`;
  return `${formatRealCoeff(re)} ${sign} ${imPart}`;
}

/**
 * Compute polynomial coefficients from roots via polynomial multiplication.
 * A monic polynomial is uniquely determined by its roots: p(z) = (z - r₁)(z - r₂)...(z - rₙ)
 * Coefficients are returned in ascending order [a₀, a₁, ..., aₙ].
 */
export function rootsToCoefficients(
  roots: ComplexPoint[],
  leadingCoeff: ComplexPoint = { re: 1, im: 0 }
): ComplexPoint[] {
  // Start with [leadingCoeff] representing the constant polynomial
  let coeffs: ComplexPoint[] = [leadingCoeff];

  for (const root of roots) {
    // Multiply current polynomial by (z - root)
    // [c0, c1, ..., cn] * (z - r) = [-r*c0, c0-r*c1, c1-r*c2, ..., cn-1-r*cn, cn]
    const newCoeffs: ComplexPoint[] = [];
    const negRoot = { re: -root.re, im: -root.im };

    // First term: -root * c0
    newCoeffs.push(multiply(negRoot, coeffs[0]));

    // Middle terms: c[i-1] - root * c[i]
    for (let i = 1; i < coeffs.length; i++) {
      newCoeffs.push(add(coeffs[i - 1], multiply(negRoot, coeffs[i])));
    }

    // Last term: c[n] (coefficient of highest power)
    newCoeffs.push(coeffs[coeffs.length - 1]);

    coeffs = newCoeffs;
  }

  return coeffs;
}

export function findRoots(poly: Polynomial): RootFindingResult {
  const { coefficients, degree } = poly;

  // Use mathjs polynomialRoot only for real coefficients of degree ≤ 3
  const allReal = coefficients.every(c => Math.abs(c.im) < 1e-10);
  if (allReal && degree <= 3) {
    return findRootsBuiltin(coefficients);
  }
  return durandKerner(coefficients);
}

/** Use mathjs polynomialRoot for degree 1–3 (real coefficients only). */
function findRootsBuiltin(coefficients: ComplexPoint[]): RootFindingResult {
  try {
    const realCoeffs = coefficients.map(c => c.re);
    // polynomialRoot expects ascending order: constant, linear, quadratic, ...
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawRoots = (polynomialRoot as any)(...realCoeffs) as ReturnType<typeof polynomialRoot>;
    const roots: ComplexPoint[] = rawRoots.map(r => {
      if (typeof r === 'number') return { re: r, im: 0 };
      if (isComplex(r)) return { re: (r as { re: number; im: number }).re, im: (r as { re: number; im: number }).im };
      return { re: Number(r), im: 0 };
    });
    return { roots, converged: true };
  } catch {
    return durandKerner(coefficients);
  }
}

/**
 * Durand-Kerner method: finds all roots of a polynomial simultaneously.
 * Coefficients in ascending order [a0, a1, ..., an] as ComplexPoint[].
 */
function durandKerner(coefficients: ComplexPoint[]): RootFindingResult {
  const degree = coefficients.length - 1;
  const leadCoeff = coefficients[degree];

  // Normalize to monic: divide all coefficients by leading coefficient
  const monic: ComplexPoint[] = coefficients.map(c => divide(c, leadCoeff));

  // Initialize guesses: (0.4 + 0.9i)^k for k = 0..degree-1
  const seed: ComplexPoint = { re: 0.4, im: 0.9 };
  const roots: ComplexPoint[] = [{ re: 1, im: 0 }];
  for (let k = 1; k < degree; k++) {
    roots.push(multiply(roots[k - 1], seed));
  }

  const maxIter = 1000;
  const tol = 1e-12;
  let converged = false;

  for (let iter = 0; iter < maxIter; iter++) {
    let maxDelta = 0;

    for (let k = 0; k < degree; k++) {
      const fVal = evaluatePolynomial(monic, roots[k]);

      // Compute product of (roots[k] - roots[j]) for j ≠ k
      let denom: ComplexPoint = { re: 1, im: 0 };
      for (let j = 0; j < degree; j++) {
        if (j !== k) {
          denom = multiply(denom, subtract(roots[k], roots[j]));
        }
      }

      const delta = divide(fVal, denom);
      roots[k] = subtract(roots[k], delta);
      maxDelta = Math.max(maxDelta, magnitude(delta));
    }

    if (maxDelta < tol) {
      converged = true;
      break;
    }
  }

  // Clean near-zero components
  for (const root of roots) {
    if (Math.abs(root.re) < 1e-10) root.re = 0;
    if (Math.abs(root.im) < 1e-10) root.im = 0;
  }

  return { roots, converged };
}
