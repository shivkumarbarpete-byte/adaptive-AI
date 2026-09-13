# Adaptive Layout Engine

A high-performance TypeScript constraint-based layout resolution library and React developer tool that resolves a single declarative ad specification into fundamentally different, mathematically correct compositions across diverse physical surfaces (smartphones, television broadcast, interactive kiosks, digital billboards, and dynamic custom viewports).

Built with **pure TypeScript (strict mode)** and **React 19**, without CSS media queries, hardcoded layout lookup tables, or uniform scaling disguised as adaptation.

---
## 🚀 Live Demo

[**View Live Demo →**](https://adaptive-ai-virid.vercel.app/)

A high-performance TypeScript constraint-based layout resolution library and React developer tool that resolves a single declarative ad specification into fundamentally different, mathematically correct compositions across diverse physical surfaces.


## ⚡ Key Highlights & Architecture Guarantees

1. **Zero Surface-Name Branching**:
   The resolver engine (`src/resolver.ts`) never checks `if (surface.id === 'mobile')` or any surface name/identifier. It derives compositions mathematically from physical aspect ratios, viewing distances, safe area insets, `minTapTarget`, and `minTextSize`.
2. **Priority-First Graceful Degradation**:
   Under dimensional stress, elements shrink and drop in strictly ascending priority order. For example, on the space-constrained **Retail Kiosk (Tight Terminal)**, the lowest-priority branding mark (`p3`) cleanly and visibly drops out, while the critical headline (`p10`) and call-to-action button (`p9`) remain intact with **zero clipping or overlap**.
3. **Strict Mathematical Non-Overlap**:
   Every element box is allocated via discrete geometric partitioning and verified through Axis-Aligned Bounding Box (AABB) collision checks ($AABB \cap B = \emptyset$).
4. **Pluggable Multi-Backend Rendering**:
   Separation of concerns is 100% complete:
   - **DOM / CSS Renderer (`src/render-dom.tsx`)**: Renders hardware-accelerated absolute layouts with smooth transitions.
   - **HTML5 Canvas Renderer (`src/render-canvas.ts`)**: Demonstrates backend independence by painting the exact same `ResolvedLayout` data directly to raw pixels without React or CSS.
5. **Generalization to Unseen 5th Surface**:
   The engine generalizes seamlessly to previously unseen surface profiles (e.g., Highway Digital Billboard 1200×400 or arbitrary dynamic user sliders) without modifying a single line of resolver logic.

---

## 🚀 Quickstart & Running the Demo

### Prerequisites
- Node.js `>= 18.0.0` (tested on Node v26.5.0)
- npm `>= 9.0.0`

### Installation
```bash
# Clone or navigate to the project directory
cd "adaptive AI"

# Install dependencies
npm install
```

### Run the Interactive Demo App
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### Run the Unit Test Suite (Vitest)
```bash
# Run isolated unit tests once
npm test

# Run in watch mode
npm run test:watch
```

### Production Build & Typecheck
```bash
npm run build
```

---

## 📱 Switching Surfaces in the Demo App

The demo app includes a top-tier developer workbench:

| Surface Preset | Dimensions | Target Modality | Key Constraint Tested |
| :--- | :--- | :--- | :--- |
| **Mobile Portrait** | 320 × 480 | Handheld Touch | Thumb-reachable bottom CTA (`minTapTarget: 48px`), vertical hierarchy |
| **Mobile Landscape** | 640 × 360 | Widescreen Touch | Notch safe margin, dual-column split composition |
| **Broadcast Lower-3rd** | 1920 × 250 | Television Non-Touch | 3m viewing distance, extra-large legibility font (`minTextSize: 28px`), horizontal strip |
| **Retail Kiosk (Tight)** | 440 × 440 | Public Touch Terminal | **Deliberately space-constrained**: `72px` min tap target forces branding to cleanly drop while CTA/headline stay intact |
| **Retail Kiosk (Full 1080p)** | 1080 × 1080 | Commercial Totem | Ample square space allows all 5 elements to render without degradation |
| **Highway Billboard** | 1200 × 400 | Roadside LED Display | **Unseen 5th Profile**: Far viewing distance, non-touch banner composition |
| **Custom Sliders** | Dynamic | Live Stress-Test | Real-time width, height, tap target, and text size sliders |

### Interactive Controls
- **Renderer Toggle**: Switch between **DOM / CSS** and **HTML5 Canvas**.
- **Safe Guides Toggle**: Show/hide the emerald dashed safe margin insets.
- **Resolution Inspector**: Real-time sidebar revealing exact $(x, y, w, h)$ coordinates, font sizes, space utilization %, iteration passes, and the **Algorithmic Drop Log**.
- **Zoom & Fit**: Zoom in/out or auto-fit bezels to your screen.

---

## 📂 Project Structure

```
src/
├── spec.ts            # defineAd() + Element/Role/Priority types + runtime validator
├── surfaces.ts        # SurfaceProfile type + 5 concrete profiles + custom factory
├── resolver.ts        # Core constraint-resolution algorithm (pure TypeScript, zero surface branching)
├── resolver.test.ts   # Vitest unit test suite (12 tests covering all surfaces & edge cases)
├── sample-ad.ts       # Canonical product ad specification defined once
├── render-dom.tsx     # Pure DOM/CSS renderer component (consumes only ResolvedLayout)
├── render-dom.ts      # Re-export module
├── render-canvas.ts   # HTML5 Canvas 2D rendering backend (pure pixel renderer)
├── App.tsx            # Developer workbench demo app with realistic bezels & live inspector
├── index.css          # Dark-mode styling, scrollbars, and Tailwind CSS configuration
└── main.tsx           # Application entry point
package.json           # Scripts, dependencies, and metadata
tsconfig.json          # Strict TypeScript configuration
ARCHITECTURE.md        # Comprehensive mathematical formulation & architecture doc
README.md              # Project overview & documentation
```

---

## 🔄 Resolution Flow

```
+------------------------------------+        +------------------------------------+
|         Ad Specification           |        |          Surface Profile           |
|            (spec.ts)               |        |           (surfaces.ts)            |
| - Elements: text, image, button    |        | - width, height, safeArea          |
| - Roles: primary, hero, action,    |        | - minTapTarget, minTextSize        |
|          secondary, branding       |        | - viewingDistance, touchOnly       |
| - Priorities: 1 (low) to 10 (high) |        |                                    |
+-----------------+------------------+        +-----------------+------------------+
                  \                                            /
                   \                                          /
                    v                                        v
          +------------------------------------------------------------+
          |             Constraint Resolution Engine                   |
          |                   (src/resolver.ts)                        |
          |  1. Optical scale & typography adaptation                  |
          |  2. Aspect ratio archetype derivation (AR = W_safe/H_safe) |
          |  3. Degradation simulation & priority drop loop            |
          |  4. Collision-free coordinate packing & safe clamp         |
          +-----------------------------+------------------------------+
                                        |
                                        v
                          +----------------------------+
                          |       ResolvedLayout       |
                          |  - elements: (x, y, w, h)  |
                          |  - droppedElements: [...]  |
                          |  - compositionMode         |
                          |  - diagnostics             |
                          +-------------+--------------+
                                       / \
                         +------------+   +------------+
                         |                             |
                         v                             v
           +---------------------------+ +---------------------------+
           |     DOM / CSS Renderer    | |   HTML5 Canvas Renderer   |
           |     (src/render-dom.ts)   | |   (src/render-canvas.ts)  |
           |  Absolute box positioning | |  Pure 2D context painting |
           +---------------------------+ +---------------------------+
```

---

## 🛡️ Compile-Time & Runtime Type Safety

The type system prevents invalid specifications and malformed configurations:
- **Role Enforcement**: `AdElementRole` accepts only `'primary' | 'hero' | 'action' | 'secondary' | 'branding'`.
- **Integrity Validation**: `defineAd()` validates at runtime:
  - Disallows duplicate element IDs.
  - Requires at least one `'primary'` or `'hero'` element.
  - Requires at least one `'action'` (CTA) element.
  - Verifies priorities are finite positive numbers.
  - Freezes the specification with `Object.freeze()` to ensure immutability.
- **Surface Profile Constraints**: Typed safe insets, viewing distance enumerations, and modality flags.

---

## ⚠️ Known Limitations

1. **Synthetic Text Metric Approximation**:
   In the pure TypeScript resolver (which executes headless in unit tests without a DOM), text line-wrapping is computed via character-width heuristics ($\sim 0.55 \times \text{fontSize}$). In a production browser environment, this could be paired with the OffscreenCanvas `measureText` API.
2. **Fixed Element Type Set**:
   The engine currently models the 3 primary ad primitives: `text`, `image`, and `button`. Video and interactive 3D elements can be accommodated by extending `AdElementType`.
3. **Cross-Surface Shared State**:
   Switching surfaces recomputes a fresh layout. In-flight interactive state (such as input field text) is preserved at the component level, but element morphing animations across drastic aspect changes use CSS transition interpolation.

---

## ⏱️ Time Spent & AI Tooling Disclosure

- **Development Time**: Approximately 3.5 hours.
- **AI Tooling Disclosure**: Developed with the assistance of Google DeepMind's Antigravity agentic coding assistant for scaffolding, test generation, and architectural refinement.
