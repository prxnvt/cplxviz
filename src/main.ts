import 'katex/dist/katex.min.css';
import './style.css';
import { ComplexPlane } from './visualization/complex-plane.ts';
import { PolynomialInput } from './ui/input.ts';
import { ViewControls } from './ui/controls.ts';
import { CoordinateDisplay } from './ui/coordinate-display.ts';
import { ModeToggle } from './ui/mode-toggle.ts';
import { findRoots, formatPolynomial, formatPolynomialLatex, parsePolynomial, rootsToCoefficients } from './math/polynomial.ts';
import { getCoordinateMode, onCoordinateModeChange } from './state/coordinate-mode.ts';
import type { ComplexPoint, Polynomial } from './types/index.ts';

const app = document.getElementById('app')!;
const plane = new ComplexPlane(app);
new ModeToggle(app);

let currentPoly: Polynomial | null = null;

const coordDisplay = new CoordinateDisplay(app, {
  onCoefficientEdit(index, value) {
    if (!currentPoly) return;
    const coefficients = [...currentPoly.coefficients];
    coefficients[index] = value;
    updateFromCoefficients(coefficients);
  },
  onRootEdit(index, value) {
    if (!currentPoly) return;
    const roots = [...plane.getRoots()];
    roots[index] = value;
    updateFromRoots(roots);
  },
});

function handleInput(value: string) {
  const result = parsePolynomial(value);
  if (!result.ok) {
    if (result.error) {
      polyInput.setError(true);
    } else {
      polyInput.setError(false);
    }
    plane.setRoots([]);
    plane.setCoefficients([]);
    coordDisplay.setPolynomialData([], []);
    currentPoly = null;
    return result;
  }

  polyInput.setError(false);
  currentPoly = result.polynomial;
  const { roots } = findRoots(currentPoly);
  plane.setRoots(roots);
  plane.setCoefficients(currentPoly.coefficients);
  coordDisplay.setPolynomialData(currentPoly.coefficients, roots);
  polyInput.setLatex(formatPolynomialLatex(currentPoly, getCoordinateMode()));
  return result;
}

function applyStandardForm(poly: Polynomial) {
  polyInput.setValue(formatPolynomial(poly));
  polyInput.setLatex(formatPolynomialLatex(poly, getCoordinateMode()));
}

function updateFromCoefficients(coefficients: ComplexPoint[]) {
  // Trim trailing zero coefficients but keep at least 2 entries (degree >= 1)
  while (coefficients.length > 2) {
    const last = coefficients[coefficients.length - 1];
    if (Math.abs(last.re) < 1e-10 && Math.abs(last.im) < 1e-10) {
      coefficients.pop();
    } else {
      break;
    }
  }
  const degree = coefficients.length - 1;
  const variable = currentPoly?.variable ?? 'z';
  const poly: Polynomial = { coefficients, degree, variable };
  currentPoly = poly;

  const { roots } = findRoots(poly);
  plane.setRoots(roots);
  plane.setCoefficients(poly.coefficients);
  coordDisplay.setPolynomialData(poly.coefficients, roots);
  applyStandardForm(poly);
  polyInput.setError(false);
}

function updateFromRoots(roots: ComplexPoint[]) {
  // Preserve leading coefficient from current polynomial
  const leadingCoeff = currentPoly
    ? currentPoly.coefficients[currentPoly.degree]
    : { re: 1, im: 0 };

  const coefficients = rootsToCoefficients(roots, leadingCoeff);
  const degree = coefficients.length - 1;
  const variable = currentPoly?.variable ?? 'z';
  const poly: Polynomial = { coefficients, degree, variable };
  currentPoly = poly;

  plane.setRoots(roots);
  plane.setCoefficients(poly.coefficients);
  coordDisplay.setPolynomialData(poly.coefficients, roots);
  applyStandardForm(poly);
  polyInput.setError(false);
}

const polyInput = new PolynomialInput(
  app,
  handleInput,
  (value) => {
    const result = handleInput(value);
    if (result && result.ok) {
      applyStandardForm(result.polynomial);
    }
  },
);

new ViewControls(plane, {
  onCoefficientDrag(index, value: ComplexPoint) {
    if (!currentPoly) return;
    const coefficients = [...currentPoly.coefficients];
    coefficients[index] = value;
    updateFromCoefficients(coefficients);
  },
  onRootDrag(index, value: ComplexPoint) {
    if (!currentPoly) return;
    const roots = [...plane.getRoots()];
    roots[index] = value;
    updateFromRoots(roots);
  },
  onPointHover(point, label) {
    coordDisplay.update(point, label);
  },
});

// Re-render polynomial when coordinate mode changes
onCoordinateModeChange(() => {
  if (currentPoly) {
    polyInput.setLatex(formatPolynomialLatex(currentPoly, getCoordinateMode()));
  }
});

// Initialize with default polynomial z^4
polyInput.setValue('z^4');
handleInput('z^4');
