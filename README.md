# Complex Polynomial Visualizer

An interactive web-based visualization tool for exploring complex polynomials in the complex plane.

## Features

- **Polynomial Input** - Enter polynomial expressions using mathematical notation (e.g., `z^3 - 1`, `(z-1)*(z+2i)`)
- **Domain Coloring** - Visualize polynomials using phase-based domain coloring
- **Interactive Manipulation** - Drag roots and coefficients to modify polynomials in real-time
- **Root Finding** - Automatic calculation and display of polynomial roots
- **Multiple Coordinate Systems** - Toggle between Cartesian, Polar, and Euler representations
- **LaTeX Rendering** - Beautiful mathematical notation throughout the interface

## Installation

```bash
npm install
```

## Usage

### Development

Start a local development server with hot module reloading:

```bash
npm run dev
```

### Production Build

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

### Using the Application

1. Enter a polynomial expression in the input field
2. The visualization automatically shows:
   - Roots displayed as white circles
   - Domain coloring of the polynomial function
   - LaTeX-formatted mathematical notation
3. Interact with the visualization:
   - **Drag** roots or coefficients to modify the polynomial
   - **Scroll** to zoom in/out
   - **Pan** by dragging the canvas
   - **Hover** over points to see coordinates
   - **Toggle** coordinate display modes (Cartesian/Polar/Euler)

## Tech Stack

- **TypeScript** - Primary language
- **Vite** - Build tool and development server
- **KaTeX** - Mathematical formula rendering
- **mathjs** - Complex number arithmetic and polynomial parsing
- **Canvas 2D API** - Rendering engine

## Project Structure

```
src/
├── main.ts                    # Application entry point
├── style.css                  # Styling
├── types/                     # TypeScript interfaces
├── math/                      # Complex number and polynomial operations
│   ├── complex.ts
│   └── polynomial.ts
├── visualization/             # Rendering and visualization
│   ├── complex-plane.ts
│   ├── domain-coloring.ts
│   └── color-map.ts
├── state/                     # State management
└── ui/                        # UI components
    ├── input.ts
    ├── controls.ts
    └── coordinate-display.ts
```

## License

MIT License - see [LICENSE](LICENSE) for details.
