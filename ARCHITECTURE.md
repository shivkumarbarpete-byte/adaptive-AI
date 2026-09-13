# Adaptive Layout Engine — Technical Architecture Document

This document provides an in-depth technical analysis of the **Adaptive Layout Engine**, detailing its mathematical formulation, constraint resolution lifecycle, priority degradation state machine, type safety guarantees, and architectural separation.

---

## 1. Architectural Philosophy & Invariants

Most responsive ad systems rely on one of three flawed strategies:
1. **Hardcoded Surface Switch-Cases**: `if (surface === 'mobile') return layoutA;` — brittle, fails immediately on any unmodeled device, and cannot generalize.
2. **CSS Media Queries**: Layout logic is buried in style sheets and cannot be tested headless in unit tests or exported to non-web platforms (e.g., Canvas, Unreal Engine, native signage players).
3. **Uniform Proportional Scaling**: Downscaling an entire composition uniformly — shrinking buttons below finger touch targets and reducing text below human optical legibility.

### The Invariants of the Adaptive Layout Engine
- **Invariant I (Zero Surface Name Knowledge)**:
  `src/resolver.ts` has zero knowledge of device IDs (`mobile`, `broadcast`, etc.). It operates purely on **physical constraints**: dimensions, safe margins, aspect ratios, viewing distances, and accessibility metrics.
- **Invariant II (Strict Non-Overlap)**:
  No two rendered element bounding boxes may intersect:
  $$\forall i \ne j, \quad \text{Box}_i \cap \text{Box}_j = \emptyset$$
- **Invariant III (Hard Constraint Enforcement)**:
  - All actionable touch elements must satisfy:
    $$\text{height} \ge \text{surface.minTapTarget}, \quad \text{width} \ge \text{surface.minTapTarget}$$
  - All typography must satisfy:
    $$\text{fontSize} \ge \text{surface.minTextSize}$$
  - All element coordinates must strictly reside within the safe insets:
    $$x \ge I_{\text{left}}, \quad y \ge I_{\text{top}}, \quad x + w \le W - I_{\text{right}}, \quad y + h \le H - I_{\text{bottom}}$$
- **Invariant IV (Monotonic Priority Degradation)**:
  Under space pressure, elements with lower numeric priority are degraded or dropped before higher priority elements are modified. Critical elements (`primary` headline and `action` CTA) are protected.

---

## 2. Mathematical Formulation & Resolution Algorithm

```
                  +-----------------------------------+
                  |   AdSpec + SurfaceProfile Input   |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------------------------+
                  | Phase 1: Constraint & Scale Prep  |
                  | - Compute safe bounds (W_s, H_s)  |
                  | - Optical typography scaling      |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------------------------+
                  | Phase 2: Aspect Archetype Derive  |
                  | AR = W_safe / H_safe              |
                  | - AR >= 2.2  => Horizontal Strip  |
                  | - AR <= 0.85 => Vertical Stack    |
                  | - AR > 1.25  => Split Columns     |
                  | - Otherwise  => Compact Grid      |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------------------------+
            +---> | Phase 3: Placement Simulation     |
            |     | Check all candidate elements fit  |
            |     +-----------------+-----------------+
            |                       |
      [Overflow /                   | [All Fit & Non-overlapping]
       Collision]                   v
            |             +-----------------------------------+
            |             | Phase 5: Coordinate Pack & Return |
            |             | Produce ResolvedLayout JSON       |
            |             +-----------------------------------+
            |
  +---------+-------------------------+
  | Phase 4: Priority Degradation     |
  | 1. Try soft-shrink tier (images)  |
  | 2. If still overflowing:          |
  |    Identify min-priority element  |
  |    (lowest numeric score)         |
  |    Drop to droppedElements[]      |
  +-----------------------------------+
```

### Phase 1: Physical Constraint Preparation
Given surface dimensions $W, H$ and safe margins $I = (I_t, I_r, I_b, I_l)$:
$$W_{\text{safe}} = W - I_l - I_r, \quad H_{\text{safe}} = H - I_t - I_b$$
$$\text{Aspect Ratio } AR = \frac{W_{\text{safe}}}{H_{\text{safe}}}$$

Optical typography scaling accounts for physical viewing distances:
$$S_{\text{view}} = \begin{cases} 
1.00 & \text{for 'near' (~30cm, smartphone)} \\
1.15 & \text{for 'arm-length' (~60cm, kiosk)} \\
1.35 & \text{for 'medium' (~1.5m, desktop)} \\
1.75 & \text{for 'far' (>3m, TV broadcast)}
\end{cases}$$

Effective font size for element $T$:
$$\text{effFontSize}(T) = \max(\text{surface.minTextSize}, \text{round}(T.\text{idealFontSize} \times S_{\text{view}}))$$

### Phase 2: Archetype Derivation
Rather than hardcoding layout templates to device labels, the engine categorizes geometry into four structural composition modes based strictly on $AR$:
1. **Horizontal Strip ($AR \ge 2.2$)**:
   Lays out elements in horizontal functional lanes:
   $$[\text{Visual Anchor / Brand}] \longrightarrow [\text{Headline + Subtitle}] \longrightarrow [\text{Price + Action Dock}]$$
2. **Vertical Stack ($AR \le 0.85$)**:
   Lays out elements in an ergonomic top-to-bottom vertical column:
   $$[\text{Brand Badge}] \longrightarrow [\text{Hero Visual}] \longrightarrow [\text{Headline}] \longrightarrow [\text{Bottom Thumb-Zone CTA}]$$
3. **Split Columns ($0.85 < AR < 2.2 \text{ and } AR > 1.25$)**:
   Bifurcates safe area into a visual left column ($44\%$) and an informational right column ($56\%$).
4. **Compact Grid ($0.85 \le AR \le 1.25$)**:
   Balanced touch terminal layout with prominent touch target action buttons ($CTA \ge 72\text{px}$).

### Phase 3 & 4: Degradation Simulation & Priority Drop Loop
Let $C$ be the candidate element set, initially equal to `spec.elements`.
At each iteration:
1. Attempt placement of all elements in $C$ using the active archetype.
2. If all elements in $C$ fit without clipping or overlapping:
   - Placement is successful; proceed to finalization.
3. If elements exceed boundaries or intersect:
   - Identify candidate element $e \in C$ with the lowest priority:
     $$e^* = \arg\min_{e \in C \setminus \{\text{primary}, \text{action}\}} (\text{roleWeight}(e) \cdot 100 + e.\text{priority})$$
   - Remove $e^*$ from $C$ and append to `droppedElements` log.
   - Re-run placement with $C \setminus \{e^*\}$.

### Concrete Example: Space-Constrained Retail Kiosk
- **Dimensions**: $440 \times 440\text{px}$, safe area $32\text{px}$ top/bottom, $28\text{px}$ left/right.
- **Available Safe Height**: $440 - 64 = 376\text{px}$.
- **Constraints**: `minTapTarget: 72px`, `minTextSize: 20px`.
- **Elements Present**:
  - `brand-logo`: role `branding`, priority `3`
  - `hero-product-image`: role `hero`, priority `7`
  - `price-tag`: role `secondary`, priority `8`
  - `cta-button`: role `action`, priority `9` (height forced to $\ge 72\text{px}$)
  - `primary-headline`: role `primary`, priority `10`
- **Resolution Step 1**: Total combined height with brand logo exceeds $376\text{px}$. Attempt fails.
- **Resolution Step 2**: Priority drop evaluates candidates. `brand-logo` has the lowest priority (`3`).
- **Resolution Step 3**: `brand-logo` is moved to `droppedElements`. Placement is re-attempted.
- **Resolution Step 4**: Remaining 4 elements fit cleanly with $0\text{px}$ overflow and zero collision.
- **Result**: Headline and CTA are 100% preserved; branding is omitted gracefully.

---

## 3. Type Safety & Schema Validation

The library provides dual-layer compile-time and runtime validation:

```typescript
// Strict Role Typing
export type AdElementRole = 'primary' | 'hero' | 'action' | 'secondary' | 'branding';
export type AdElementType = 'text' | 'image' | 'button';

// Compile-Time Contract
export interface BaseElementSpec {
  id: string;
  type: AdElementType;
  role: AdElementRole;
  priority: number;
  minWidth?: number;
  minHeight?: number;
  preferredWidth?: number;
  preferredHeight?: number;
  aspectRatio?: number;
}
```

### Runtime Validation (`defineAd`)
At startup, `defineAd(spec)` performs strict integrity verification:
- Checks for unique element IDs ($O(N)$ uniqueness check).
- Enforces presence of at least one `primary` or `hero` element.
- Enforces presence of at least one `action` CTA element.
- Verifies that `priority` is a finite positive number.
- Calls `Object.freeze()` to prevent mutation of spec data structures.

---

## 4. Multi-Backend Rendering Architecture

A key requirement is that the constraint resolver outputs a framework-agnostic geometric data model:

```typescript
export interface ResolvedElementBox {
  id: string;
  role: AdElement['role'];
  type: AdElement['type'];
  priority: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  status: 'rendered' | 'shrunk';
}
```

Because `ResolvedLayout` contains only absolute coordinates $(x, y, w, h)$, rendering backends are completely decoupled from layout calculation:

1. **DOM / CSS Backend (`render-dom.tsx`)**:
   - Renders HTML elements positioned via inline CSS `left`, `top`, `width`, `height`.
   - Uses CSS hardware-accelerated transitions (`cubic-bezier(0.16, 1, 0.3, 1)`) for smooth interpolation when surfaces change.
2. **HTML5 Canvas 2D Backend (`render-canvas.ts`)**:
   - Uses raw 2D Canvas context (`fillRect`, `drawImage`, `fillText`, `clip`).
   - Supports High-DPI displays via `window.devicePixelRatio`.
   - Has zero DOM dependencies, proving that `resolver.ts` could run in Node.js, WebWorkers, or native engines.

---

## 5. Collision Verification Invariant

The resolver executes an automated Axis-Aligned Bounding Box (AABB) intersection test across all rendered elements:

$$\text{checkOverlap}(A, B) = (A.x < B.x + B.w) \land (A.x + A.w > B.x) \land (A.y < B.y + B.h) \land (A.y + A.h > B.y)$$

If any collision is detected, `validateLayoutSanity` returns `valid: false` and the resolver rolls back to degrade lower-priority elements before producing output.

---

## 6. Known Limitations & Extensibility

| Dimension | Current Implementation | Production Evolution |
| :--- | :--- | :--- |
| **Text Metrics** | Character-count font heuristics | `OffscreenCanvas.measureText()` or HarfBuzz WASM |
| **Primitives** | `text`, `image`, `button` | Add `video`, `carousel`, `lottie` primitives |
| **Grid Partitions** | 4 mathematical archetypes | Dynamic simplex solver or Cassowary algorithm |
| **Transition** | CSS coordinate transitions | FLIP animation engine across DOM elements |

---

## 7. AI Disclosure & Effort

- **Tools Used**: Google DeepMind Antigravity Agent.
- **Architectural Authoring**: Hand-crafted constraint algorithms and mathematical layout engines without third-party layout libraries.
