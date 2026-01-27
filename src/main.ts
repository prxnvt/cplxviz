import 'katex/dist/katex.min.css';
import './style.css';
import { ComplexPlane } from './visualization/complex-plane.ts';
import { PolynomialInput } from './ui/input.ts';
import { ViewControls } from './ui/controls.ts';
import { CoordinateDisplay } from './ui/coordinate-display.ts';
import { findRoots, formatPolynomial, formatPolynomialLatex, parsePolynomial } from './math/polynomial.ts';
import type { ComplexPoint, Polynomial } from './types/index.ts';

const app = document.getElementById('app')!;
const plane = new ComplexPlane(app);
const coordDisplay = new CoordinateDisplay(app);

let currentPoly: Polynomial | null = null;

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
  return result;
}

function applyStandardForm(poly: Polynomial) {
  polyInput.setValue(formatPolynomial(poly));
  polyInput.setLatex(formatPolynomialLatex(poly));
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
  onPointHover(point, label) {
    coordDisplay.update(point, label);
  },
});
