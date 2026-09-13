/**
 * Adaptive Layout Engine - Constraint Resolution Core
 *
 * Framework-agnostic, pure TypeScript constraint solver.
 * Mathematical layout resolution operating strictly on physical geometry,
 * aspect ratios, and constraint thresholds.
 *
 * ZERO SURFACE-NAME BRANCHING:
 * It never checks `if (surface.id === 'mobile')` or any surface name/identifier.
 * Instead, it derives compositions mathematically from:
 *   - Available safe area aspect ratio (AR = W_safe / H_safe)
 *   - Physical constraints (minTapTarget, minTextSize, safeArea)
 *   - Viewing distance optical scale
 *   - Element priority-based degradation
 */

import type { AdElement, AdSpec, ButtonElementSpec, ImageElementSpec, TextElementSpec } from './spec';
import type { SafeAreaInsets, SurfaceProfile, ViewingDistance } from './surfaces';

export type CompositionMode = 
  | 'horizontal-strip' // Ultra-wide (AR >= 2.2, e.g. broadcast lower-third, banner)
  | 'vertical-stack'   // Tall portrait (AR <= 0.85, e.g. mobile portrait, totem)
  | 'split-columns'    // Landscape / medium-wide (0.85 < AR < 2.2, AR > 1.25)
  | 'compact-grid';    // Square / near-square (0.85 <= AR <= 1.25, e.g. kiosk)

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
  lineCount?: number;
}

export interface DropLogEntry {
  id: string;
  role: AdElement['role'];
  priority: number;
  reason: string;
}

export interface ResolvedLayout {
  readonly surfaceId: string;
  readonly surfaceName: string;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly safeArea: SafeAreaInsets;
  readonly safeWidth: number;
  readonly safeHeight: number;
  readonly compositionMode: CompositionMode;
  readonly elements: ResolvedElementBox[];
  readonly droppedElements: DropLogEntry[];
  readonly diagnostics: {
    iterationCount: number;
    spaceUtilization: number; // percentage 0 - 100
    safeAspectRatio: number;
    totalElementsOriginal: number;
    totalElementsRendered: number;
    totalElementsDropped: number;
  };
}

/**
 * Optical typography scaling based on physical viewing distance.
 */
function getViewingScale(distance: ViewingDistance): number {
  switch (distance) {
    case 'near': return 1.0;
    case 'arm-length': return 1.15;
    case 'medium': return 1.35;
    case 'far': return 1.75;
  }
}

/**
 * Estimate text bounding height given available width, font size, and line height.
 */
function calculateTextDimensions(
  text: string,
  fontSize: number,
  availableWidth: number,
  maxLines: number = 3
): { width: number; height: number; lineCount: number } {
  // Approximate average character width in standard sans-serif is ~0.55 * fontSize
  const avgCharWidth = fontSize * 0.55;
  const charsPerLine = Math.max(8, Math.floor(availableWidth / avgCharWidth));
  const estimatedLines = Math.min(maxLines, Math.max(1, Math.ceil(text.length / charsPerLine)));
  const lineHeight = fontSize * 1.28;
  const totalHeight = Math.ceil(estimatedLines * lineHeight + 4);
  const totalWidth = Math.min(availableWidth, Math.ceil(text.length * avgCharWidth));

  return {
    width: totalWidth,
    height: totalHeight,
    lineCount: estimatedLines,
  };
}

/**
 * Axis-Aligned Bounding Box (AABB) intersection check.
 * Strictly guarantees that no two elements overlap.
 */
export function checkBoundingBoxOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Verify complete layout sanity:
 * 1. All elements stay strictly within the surface safe bounds.
 * 2. No two elements intersect.
 */
export function validateLayoutSanity(
  elements: ResolvedElementBox[],
  safeArea: SafeAreaInsets,
  canvasWidth: number,
  canvasHeight: number
): { valid: boolean; error?: string } {
  const minX = safeArea.left;
  const minY = safeArea.top;
  const maxX = canvasWidth - safeArea.right;
  const maxY = canvasHeight - safeArea.bottom;

  // 1. Boundary check
  for (const el of elements) {
    if (el.x < minX - 0.5 || el.y < minY - 0.5) {
      return { valid: false, error: `Element "${el.id}" placed outside safe margin (x: ${el.x}, y: ${el.y})` };
    }
    if (el.x + el.width > maxX + 0.5 || el.y + el.height > maxY + 0.5) {
      return {
        valid: false,
        error: `Element "${el.id}" clips safe margin boundary (right: ${el.x + el.width} > ${maxX}, bottom: ${el.y + el.height} > ${maxY})`,
      };
    }
  }

  // 2. Overlap check
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      if (checkBoundingBoxOverlap(elements[i], elements[j])) {
        return {
          valid: false,
          error: `Elements "${elements[i].id}" and "${elements[j].id}" intersect/overlap`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Core constraint resolution function.
 * Takes declarative AdSpec and physical SurfaceProfile, produces mathematically correct ResolvedLayout.
 */
export function resolveLayout(spec: AdSpec, surface: SurfaceProfile): ResolvedLayout {
  const { width: W, height: H, safeArea, minTapTarget, minTextSize, viewingDistance, touchOnly } = surface;

  const safeW = W - safeArea.left - safeArea.right;
  const safeH = H - safeArea.top - safeArea.bottom;

  if (safeW <= 20 || safeH <= 20) {
    throw new Error(`Invalid safe dimensions: ${safeW}x${safeH}px is insufficient for layout.`);
  }

  const safeAR = safeW / safeH;

  // Determine composition mode purely from physical aspect ratio
  let compositionMode: CompositionMode;
  if (safeAR >= 2.2) {
    compositionMode = 'horizontal-strip';
  } else if (safeAR <= 0.85) {
    compositionMode = 'vertical-stack';
  } else if (safeAR > 1.25) {
    compositionMode = 'split-columns';
  } else {
    compositionMode = 'compact-grid';
  }

  const viewScale = getViewingScale(viewingDistance);

  // Active elements pool, initially containing all elements from the spec
  let candidateElements = [...spec.elements];
  const droppedLog: DropLogEntry[] = [];
  let iteration = 0;
  const maxIterations = candidateElements.length + 5;

  let resolvedBoxes: ResolvedElementBox[] = [];

  // Priority-driven degradation loop:
  // If layout cannot fit within safe area without overlap/clipping,
  // we first try soft-shrinking, then iteratively drop the lowest priority element.
  while (iteration < maxIterations) {
    iteration++;

    const attempt = attemptPlacement({
      elements: candidateElements,
      mode: compositionMode,
      safeArea,
      safeW,
      safeH,
      minTapTarget,
      minTextSize,
      viewScale,
      touchOnly,
      shrinkTier: iteration > 1 ? 1 : 0,
    });

    if (attempt.success) {
      resolvedBoxes = attempt.boxes;
      break;
    }

    // Space pressure detected! Find the lowest priority element to drop.
    // Crucial rule: Never drop 'primary' or 'action' if other lower-priority roles remain.
    const droppable = [...candidateElements].sort((a, b) => {
      // Prioritize dropping branding (first), then secondary, then hero, before touching primary or action
      const roleWeight = (role: AdElement['role']): number => {
        switch (role) {
          case 'branding': return 1;
          case 'secondary': return 2;
          case 'hero': return 3;
          case 'primary': return 10;
          case 'action': return 10;
        }
      };
      const weightDiff = roleWeight(a.role) - roleWeight(b.role);
      if (weightDiff !== 0) return weightDiff;
      return a.priority - b.priority;
    });

    if (droppable.length <= 2) {
      // Minimum essential set (primary + action) reached, force best effort placement
      resolvedBoxes = attempt.boxes;
      break;
    }

    const elementToDrop = droppable[0];
    droppedLog.push({
      id: elementToDrop.id,
      role: elementToDrop.role,
      priority: elementToDrop.priority,
      reason: `Space constraint under minTapTarget (${minTapTarget}px) & minTextSize (${minTextSize}px)`,
    });

    candidateElements = candidateElements.filter(e => e.id !== elementToDrop.id);
  }

  // Calculate space utilization metric
  const totalOccupiedArea = resolvedBoxes.reduce((sum, b) => sum + (b.width * b.height), 0);
  const totalSafeArea = safeW * safeH;
  const utilization = Math.min(100, Math.round((totalOccupiedArea / totalSafeArea) * 100));

  return {
    surfaceId: surface.id,
    surfaceName: surface.name,
    canvasWidth: W,
    canvasHeight: H,
    safeArea,
    safeWidth: safeW,
    safeHeight: safeH,
    compositionMode,
    elements: resolvedBoxes,
    droppedElements: droppedLog,
    diagnostics: {
      iterationCount: iteration,
      spaceUtilization: utilization,
      safeAspectRatio: Number(safeAR.toFixed(2)),
      totalElementsOriginal: spec.elements.length,
      totalElementsRendered: resolvedBoxes.length,
      totalElementsDropped: droppedLog.length,
    },
  };
}

interface PlacementParams {
  elements: AdElement[];
  mode: CompositionMode;
  safeArea: SafeAreaInsets;
  safeW: number;
  safeH: number;
  minTapTarget: number;
  minTextSize: number;
  viewScale: number;
  touchOnly: boolean;
  shrinkTier: number;
}

interface PlacementResult {
  success: boolean;
  boxes: ResolvedElementBox[];
}

/**
 * Attempts to lay out elements within the safe boundaries according to the composition archetype.
 */
function attemptPlacement(params: PlacementParams): PlacementResult {
  const { mode } = params;

  switch (mode) {
    case 'horizontal-strip':
      return placeHorizontalStrip(params);
    case 'vertical-stack':
      return placeVerticalStack(params);
    case 'split-columns':
      return placeSplitColumns(params);
    case 'compact-grid':
      return placeCompactGrid(params);
  }
}

/**
 * 1. Horizontal Strip (AR >= 2.2)
 * Typically used for broadcast lower-thirds or wide horizontal banners.
 * Layout splits horizontally:
 * [Visual Anchor / Brand] -> [Primary Message & Subhead] -> [Price & CTA Action Dock]
 */
function placeHorizontalStrip(params: PlacementParams): PlacementResult {
  const { elements, safeArea, safeW, safeH, minTapTarget, minTextSize, viewScale, shrinkTier } = params;
  const boxes: ResolvedElementBox[] = [];

  const startX = safeArea.left;
  const startY = safeArea.top;
  const gapX = shrinkTier > 0 ? 16 : 24;

  const heroElem = elements.find(e => e.role === 'hero' && e.type === 'image') as ImageElementSpec | undefined;
  const brandElem = elements.find(e => e.role === 'branding') as AdElement | undefined;
  const primaryElem = elements.find(e => e.role === 'primary' && e.type === 'text') as TextElementSpec | undefined;
  const secondaryElems = elements.filter(e => e.role === 'secondary') as AdElement[];
  const actionElem = elements.find(e => e.role === 'action' && e.type === 'button') as ButtonElementSpec | undefined;

  let currentX = startX;
  const availableH = safeH;

  // 1. Visual Anchor on Left (Hero Image or Brand Logo)
  if (heroElem) {
    const heroH = Math.min(availableH, shrinkTier > 0 ? availableH * 0.85 : availableH);
    const heroW = Math.round(heroH * (heroElem.aspectRatio ?? 1.2));
    const heroY = startY + Math.round((availableH - heroH) / 2);

    boxes.push({
      id: heroElem.id,
      role: heroElem.role,
      type: heroElem.type,
      priority: heroElem.priority,
      x: currentX,
      y: heroY,
      width: heroW,
      height: heroH,
      status: shrinkTier > 0 ? 'shrunk' : 'rendered',
    });
    currentX += heroW + gapX;
  } else if (brandElem) {
    const brandH = Math.min(availableH * 0.7, 60);
    const brandW = Math.round(brandH * (brandElem.aspectRatio ?? 2.5));
    const brandY = startY + Math.round((availableH - brandH) / 2);

    boxes.push({
      id: brandElem.id,
      role: brandElem.role,
      type: brandElem.type,
      priority: brandElem.priority,
      x: currentX,
      y: brandY,
      width: brandW,
      height: brandH,
      status: 'rendered',
    });
    currentX += brandW + gapX;
  }

  // 2. Action Area on Right (CTA Button & Price)
  let actionAreaWidth = 0;
  let actionBox: ResolvedElementBox | undefined;
  let priceBox: ResolvedElementBox | undefined;

  const rightBound = startX + safeW;

  if (actionElem) {
    const btnFontSize = Math.max(minTextSize, Math.round((actionElem.idealFontSize ?? 16) * viewScale));
    const labelW = Math.ceil(actionElem.label.length * (btnFontSize * 0.6) + 32);
    const btnW = Math.max(minTapTarget, Math.max(actionElem.minWidth ?? 120, labelW));
    const btnH = Math.max(minTapTarget, Math.min(availableH * 0.6, Math.max(actionElem.minHeight ?? 44, btnFontSize * 1.5 + 16)));
    const btnY = startY + Math.round((availableH - btnH) / 2);
    const btnX = rightBound - btnW;

    actionBox = {
      id: actionElem.id,
      role: actionElem.role,
      type: actionElem.type,
      priority: actionElem.priority,
      x: btnX,
      y: btnY,
      width: btnW,
      height: btnH,
      fontSize: btnFontSize,
      status: 'rendered',
    };
    actionAreaWidth += btnW + gapX;
  }

  // Check for secondary price tag next to CTA
  const priceElem = secondaryElems.find(e => e.type === 'text' && (e as TextElementSpec).variant === 'price') as TextElementSpec | undefined;
  if (priceElem && actionBox) {
    const priceFontSize = Math.max(minTextSize, Math.round((priceElem.idealFontSize ?? 22) * viewScale));
    const priceDims = calculateTextDimensions(priceElem.text, priceFontSize, 180, 1);
    const priceX = actionBox.x - priceDims.width - gapX;
    const priceY = startY + Math.round((availableH - priceDims.height) / 2);

    if (priceX > currentX + 120) {
      priceBox = {
        id: priceElem.id,
        role: priceElem.role,
        type: priceElem.type,
        priority: priceElem.priority,
        x: priceX,
        y: priceY,
        width: priceDims.width,
        height: priceDims.height,
        fontSize: priceFontSize,
        status: 'rendered',
      };
      actionAreaWidth += priceDims.width + gapX;
    }
  }

  // 3. Central Content Zone (Headline & remaining secondary text)
  const remainingContentWidth = rightBound - actionAreaWidth - currentX;
  if (remainingContentWidth < 140 && primaryElem) {
    // Insufficient width for headline!
    return { success: false, boxes: [] };
  }

  if (primaryElem) {
    const headFontSize = Math.max(minTextSize + 2, Math.round((primaryElem.idealFontSize ?? 26) * viewScale));
    const headDims = calculateTextDimensions(primaryElem.text, headFontSize, remainingContentWidth, 2);

    // Other secondary subtitles
    const otherSecondary = secondaryElems.find(e => e.id !== priceBox?.id && e.type === 'text') as TextElementSpec | undefined;
    let subDims = { width: 0, height: 0, lineCount: 0 };
    let subFontSize = minTextSize;

    if (otherSecondary && safeH > 100) {
      subFontSize = Math.max(minTextSize, Math.round((otherSecondary.idealFontSize ?? 15) * viewScale));
      subDims = calculateTextDimensions(otherSecondary.text, subFontSize, remainingContentWidth, 1);
    }

    const totalTextH = headDims.height + (subDims.height > 0 ? subDims.height + 4 : 0);
    const textStartY = startY + Math.max(0, Math.round((availableH - totalTextH) / 2));

    boxes.push({
      id: primaryElem.id,
      role: primaryElem.role,
      type: primaryElem.type,
      priority: primaryElem.priority,
      x: currentX,
      y: textStartY,
      width: Math.min(remainingContentWidth, headDims.width),
      height: headDims.height,
      fontSize: headFontSize,
      status: 'rendered',
      lineCount: headDims.lineCount,
    });

    if (otherSecondary && subDims.height > 0) {
      boxes.push({
        id: otherSecondary.id,
        role: otherSecondary.role,
        type: otherSecondary.type,
        priority: otherSecondary.priority,
        x: currentX,
        y: textStartY + headDims.height + 4,
        width: Math.min(remainingContentWidth, subDims.width),
        height: subDims.height,
        fontSize: subFontSize,
        status: 'rendered',
      });
    }
  }

  // Push action and price boxes if successfully placed
  if (priceBox) boxes.push(priceBox);
  if (actionBox) boxes.push(actionBox);

  const sanity = validateLayoutSanity(boxes, safeArea, params.safeArea.left + safeW + params.safeArea.right, params.safeArea.top + safeH + params.safeArea.bottom);
  return { success: sanity.valid, boxes };
}

/**
 * 2. Vertical Stack (AR <= 0.85)
 * Typically used for mobile portrait interstitial or tall vertical kiosks.
 * Top-to-bottom prioritized flow:
 * [Branding Mark] -> [Hero Image] -> [Headline & Price] -> [Bottom CTA thumb-zone]
 */
function placeVerticalStack(params: PlacementParams): PlacementResult {
  const { elements, safeArea, safeW, safeH, minTapTarget, minTextSize, viewScale, shrinkTier } = params;
  const boxes: ResolvedElementBox[] = [];

  const startX = safeArea.left;
  const startY = safeArea.top;
  const gapY = shrinkTier > 0 ? 10 : 16;
  let currentY = startY;

  const brandElem = elements.find(e => e.role === 'branding') as AdElement | undefined;
  const heroElem = elements.find(e => e.role === 'hero' && e.type === 'image') as ImageElementSpec | undefined;
  const primaryElem = elements.find(e => e.role === 'primary' && e.type === 'text') as TextElementSpec | undefined;
  const secondaryElems = elements.filter(e => e.role === 'secondary') as AdElement[];
  const actionElem = elements.find(e => e.role === 'action' && e.type === 'button') as ButtonElementSpec | undefined;

  // 1. Bottom CTA button reservation
  let ctaHeight = 0;
  let ctaBox: ResolvedElementBox | undefined;
  if (actionElem) {
    const btnFontSize = Math.max(minTextSize, Math.round((actionElem.idealFontSize ?? 16) * viewScale));
    ctaHeight = Math.max(minTapTarget, Math.max(actionElem.minHeight ?? 48, btnFontSize * 1.4 + 20));
    const btnW = Math.min(safeW, Math.max(minTapTarget * 2, actionElem.preferredWidth ?? safeW));
    const btnX = startX + Math.round((safeW - btnW) / 2);
    const btnY = startY + safeH - ctaHeight;

    ctaBox = {
      id: actionElem.id,
      role: actionElem.role,
      type: actionElem.type,
      priority: actionElem.priority,
      x: btnX,
      y: btnY,
      width: btnW,
      height: ctaHeight,
      fontSize: btnFontSize,
      status: 'rendered',
    };
  }

  // Available vertical space for upper content
  const contentMaxY = startY + safeH - (ctaHeight > 0 ? ctaHeight + gapY : 0);

  // 2. Top Branding Badge (if included)
  if (brandElem) {
    const brandH = shrinkTier > 0 ? 24 : 32;
    const brandW = Math.min(safeW, Math.round(brandH * (brandElem.aspectRatio ?? 3.2)));
    const brandX = startX;

    boxes.push({
      id: brandElem.id,
      role: brandElem.role,
      type: brandElem.type,
      priority: brandElem.priority,
      x: brandX,
      y: currentY,
      width: brandW,
      height: brandH,
      status: 'rendered',
    });
    currentY += brandH + gapY;
  }

  // 3. Hero Visual Asset
  if (heroElem) {
    // Dynamically calculate hero height budget based on remaining space
    const remainingForHeroAndText = contentMaxY - currentY;
    const heroBudgetRatio = shrinkTier > 0 ? 0.38 : 0.46;
    let heroH = Math.round(remainingForHeroAndText * heroBudgetRatio);
    heroH = Math.max(80, Math.min(heroH, safeW * 0.9));
    const heroW = Math.min(safeW, Math.round(heroH * (heroElem.aspectRatio ?? 1.3)));
    const heroX = startX + Math.round((safeW - heroW) / 2);

    boxes.push({
      id: heroElem.id,
      role: heroElem.role,
      type: heroElem.type,
      priority: heroElem.priority,
      x: heroX,
      y: currentY,
      width: heroW,
      height: heroH,
      status: shrinkTier > 0 ? 'shrunk' : 'rendered',
    });
    currentY += heroH + gapY;
  }

  // 4. Headline & Primary Text
  if (primaryElem) {
    const headFontSize = Math.max(minTextSize, Math.round((primaryElem.idealFontSize ?? 22) * viewScale));
    const headDims = calculateTextDimensions(primaryElem.text, headFontSize, safeW, 3);
    const headX = startX;

    boxes.push({
      id: primaryElem.id,
      role: primaryElem.role,
      type: primaryElem.type,
      priority: primaryElem.priority,
      x: headX,
      y: currentY,
      width: safeW,
      height: headDims.height,
      fontSize: headFontSize,
      status: 'rendered',
      lineCount: headDims.lineCount,
    });
    currentY += headDims.height + gapY;
  }

  // 5. Secondary elements (Price, subtitle)
  for (const sec of secondaryElems) {
    if (sec.type === 'text') {
      const textSec = sec as TextElementSpec;
      const secFontSize = Math.max(minTextSize, Math.round((textSec.idealFontSize ?? 16) * viewScale));
      const secDims = calculateTextDimensions(textSec.text, secFontSize, safeW, 2);

      if (currentY + secDims.height <= contentMaxY) {
        boxes.push({
          id: sec.id,
          role: sec.role,
          type: sec.type,
          priority: sec.priority,
          x: startX,
          y: currentY,
          width: safeW,
          height: secDims.height,
          fontSize: secFontSize,
          status: 'rendered',
        });
        currentY += secDims.height + Math.round(gapY * 0.7);
      }
    }
  }

  if (ctaBox) {
    boxes.push(ctaBox);
  }

  // Verify that top content does not collide with bottom CTA
  if (currentY > contentMaxY) {
    return { success: false, boxes: [] };
  }

  const sanity = validateLayoutSanity(boxes, safeArea, params.safeArea.left + safeW + params.safeArea.right, params.safeArea.top + safeH + params.safeArea.bottom);
  return { success: sanity.valid, boxes };
}

/**
 * 3. Split Columns (0.85 < AR < 2.2 and AR > 1.25)
 * Typically used for landscape mobile or desktop banners.
 * Divides into dual columns:
 * Left Column: Hero visual asset & branding
 * Right Column: Headline, Subtitle/Price, and CTA
 */
function placeSplitColumns(params: PlacementParams): PlacementResult {
  const { elements, safeArea, safeW, safeH, minTapTarget, minTextSize, viewScale, shrinkTier } = params;
  const boxes: ResolvedElementBox[] = [];

  const startX = safeArea.left;
  const startY = safeArea.top;
  const gapX = shrinkTier > 0 ? 16 : 24;
  const gapY = shrinkTier > 0 ? 10 : 14;

  const leftColWidth = Math.round(safeW * 0.44);
  const rightColWidth = safeW - leftColWidth - gapX;
  const rightColX = startX + leftColWidth + gapX;

  const heroElem = elements.find(e => e.role === 'hero' && e.type === 'image') as ImageElementSpec | undefined;
  const brandElem = elements.find(e => e.role === 'branding') as AdElement | undefined;
  const primaryElem = elements.find(e => e.role === 'primary' && e.type === 'text') as TextElementSpec | undefined;
  const secondaryElems = elements.filter(e => e.role === 'secondary') as AdElement[];
  const actionElem = elements.find(e => e.role === 'action' && e.type === 'button') as ButtonElementSpec | undefined;

  // Left Column Placement: Brand mark + Hero visual
  let leftY = startY;
  if (brandElem) {
    const brandH = shrinkTier > 0 ? 24 : 30;
    const brandW = Math.min(leftColWidth, Math.round(brandH * (brandElem.aspectRatio ?? 3.0)));
    boxes.push({
      id: brandElem.id,
      role: brandElem.role,
      type: brandElem.type,
      priority: brandElem.priority,
      x: startX,
      y: leftY,
      width: brandW,
      height: brandH,
      status: 'rendered',
    });
    leftY += brandH + gapY;
  }

  if (heroElem) {
    const remainingH = (startY + safeH) - leftY;
    const heroH = Math.min(remainingH, Math.round(leftColWidth / (heroElem.aspectRatio ?? 1.3)));
    const heroW = Math.min(leftColWidth, Math.round(heroH * (heroElem.aspectRatio ?? 1.3)));
    const heroX = startX + Math.round((leftColWidth - heroW) / 2);
    const heroY = leftY + Math.round((remainingH - heroH) / 2);

    boxes.push({
      id: heroElem.id,
      role: heroElem.role,
      type: heroElem.type,
      priority: heroElem.priority,
      x: heroX,
      y: heroY,
      width: heroW,
      height: heroH,
      status: shrinkTier > 0 ? 'shrunk' : 'rendered',
    });
  }

  // Right Column Placement: Headline -> Price / Subhead -> CTA Button
  let rightY = startY;

  if (primaryElem) {
    const headFontSize = Math.max(minTextSize, Math.round((primaryElem.idealFontSize ?? 22) * viewScale));
    const headDims = calculateTextDimensions(primaryElem.text, headFontSize, rightColWidth, 3);
    boxes.push({
      id: primaryElem.id,
      role: primaryElem.role,
      type: primaryElem.type,
      priority: primaryElem.priority,
      x: rightColX,
      y: rightY,
      width: rightColWidth,
      height: headDims.height,
      fontSize: headFontSize,
      status: 'rendered',
      lineCount: headDims.lineCount,
    });
    rightY += headDims.height + gapY;
  }

  for (const sec of secondaryElems) {
    if (sec.type === 'text') {
      const textSec = sec as TextElementSpec;
      const isPrice = textSec.variant === 'price';
      const secFontSize = Math.max(minTextSize, Math.round((textSec.idealFontSize ?? (isPrice ? 20 : 14)) * viewScale));
      const secDims = calculateTextDimensions(textSec.text, secFontSize, rightColWidth, 2);

      if (rightY + secDims.height + minTapTarget + gapY <= startY + safeH) {
        boxes.push({
          id: sec.id,
          role: sec.role,
          type: sec.type,
          priority: sec.priority,
          x: rightColX,
          y: rightY,
          width: Math.min(rightColWidth, secDims.width),
          height: secDims.height,
          fontSize: secFontSize,
          status: 'rendered',
        });
        rightY += secDims.height + gapY;
      }
    }
  }

  if (actionElem) {
    const btnFontSize = Math.max(minTextSize, Math.round((actionElem.idealFontSize ?? 16) * viewScale));
    const labelW = Math.ceil(actionElem.label.length * (btnFontSize * 0.6) + 32);
    const btnW = Math.max(minTapTarget, Math.min(rightColWidth, Math.max(actionElem.minWidth ?? 120, labelW)));
    const btnH = Math.max(minTapTarget, Math.max(actionElem.minHeight ?? 44, btnFontSize * 1.4 + 16));
    const btnY = Math.max(rightY, startY + safeH - btnH);

    boxes.push({
      id: actionElem.id,
      role: actionElem.role,
      type: actionElem.type,
      priority: actionElem.priority,
      x: rightColX,
      y: btnY,
      width: btnW,
      height: btnH,
      fontSize: btnFontSize,
      status: 'rendered',
    });
    rightY = btnY + btnH;
  }

  if (rightY > startY + safeH) {
    return { success: false, boxes: [] };
  }

  const sanity = validateLayoutSanity(boxes, safeArea, params.safeArea.left + safeW + params.safeArea.right, params.safeArea.top + safeH + params.safeArea.bottom);
  return { success: sanity.valid, boxes };
}

/**
 * 4. Compact / Square Grid (0.85 <= AR <= 1.25)
 * Square kiosks, digital terminals, POS screens.
 * Heavy emphasis on touch-friendly accessibility (large minTapTarget).
 * Balanced visual composition:
 * - Upper half: Hero image or Brand mark
 * - Lower half: Headline, Price, and prominent touch CTA
 */
function placeCompactGrid(params: PlacementParams): PlacementResult {
  const { elements, safeArea, safeW, safeH, minTapTarget, minTextSize, viewScale, shrinkTier } = params;
  const boxes: ResolvedElementBox[] = [];

  const startX = safeArea.left;
  const startY = safeArea.top;
  const gapY = shrinkTier > 0 ? 10 : 14;

  const brandElem = elements.find(e => e.role === 'branding') as AdElement | undefined;
  const heroElem = elements.find(e => e.role === 'hero' && e.type === 'image') as ImageElementSpec | undefined;
  const primaryElem = elements.find(e => e.role === 'primary' && e.type === 'text') as TextElementSpec | undefined;
  const secondaryElems = elements.filter(e => e.role === 'secondary') as AdElement[];
  const actionElem = elements.find(e => e.role === 'action' && e.type === 'button') as ButtonElementSpec | undefined;

  let currentY = startY;

  // 1. Mandatory Bottom Action Button with strict minTapTarget enforcement
  let ctaHeight = 0;
  let ctaBox: ResolvedElementBox | undefined;
  if (actionElem) {
    const btnFontSize = Math.max(minTextSize, Math.round((actionElem.idealFontSize ?? 18) * viewScale));
    ctaHeight = Math.max(minTapTarget, Math.max(actionElem.minHeight ?? 52, btnFontSize * 1.4 + 20));
    const btnW = Math.min(safeW, Math.max(minTapTarget * 2.2, safeW * 0.92));
    const btnX = startX + Math.round((safeW - btnW) / 2);
    const btnY = startY + safeH - ctaHeight;

    ctaBox = {
      id: actionElem.id,
      role: actionElem.role,
      type: actionElem.type,
      priority: actionElem.priority,
      x: btnX,
      y: btnY,
      width: btnW,
      height: ctaHeight,
      fontSize: btnFontSize,
      status: 'rendered',
    };
  }

  const maxYForUpperContent = startY + safeH - (ctaHeight > 0 ? ctaHeight + gapY : 0);

  // 2. Top Branding Mark
  if (brandElem) {
    const brandH = shrinkTier > 0 ? 24 : 32;
    const brandW = Math.min(safeW, Math.round(brandH * (brandElem.aspectRatio ?? 3.0)));
    const brandX = startX + Math.round((safeW - brandW) / 2);

    boxes.push({
      id: brandElem.id,
      role: brandElem.role,
      type: brandElem.type,
      priority: brandElem.priority,
      x: brandX,
      y: currentY,
      width: brandW,
      height: brandH,
      status: 'rendered',
    });
    currentY += brandH + gapY;
  }

  // 3. Hero Visual Asset
  if (heroElem) {
    const minHeroH = Math.max(heroElem.minHeight ?? 100, Math.round(safeW * 0.35));
    const heroH = shrinkTier > 0 
      ? Math.max(minHeroH * 0.85, 80)
      : Math.max(minHeroH, Math.round(safeW * 0.42));
    
    const heroW = Math.min(safeW, Math.round(heroH * (heroElem.aspectRatio ?? 1.2)));
    const heroX = startX + Math.round((safeW - heroW) / 2);

    boxes.push({
      id: heroElem.id,
      role: heroElem.role,
      type: heroElem.type,
      priority: heroElem.priority,
      x: heroX,
      y: currentY,
      width: heroW,
      height: heroH,
      status: shrinkTier > 0 ? 'shrunk' : 'rendered',
    });
    currentY += heroH + gapY;
  }

  // 4. Headline & Primary proposition
  if (primaryElem) {
    const headFontSize = Math.max(minTextSize, Math.round((primaryElem.idealFontSize ?? 22) * viewScale));
    const headDims = calculateTextDimensions(primaryElem.text, headFontSize, safeW, 2);

    boxes.push({
      id: primaryElem.id,
      role: primaryElem.role,
      type: primaryElem.type,
      priority: primaryElem.priority,
      x: startX,
      y: currentY,
      width: safeW,
      height: headDims.height,
      fontSize: headFontSize,
      status: 'rendered',
      lineCount: headDims.lineCount,
    });
    currentY += headDims.height + gapY;
  }

  // 5. Secondary Elements (Price Tag / Features)
  for (const sec of secondaryElems) {
    if (sec.type === 'text') {
      const textSec = sec as TextElementSpec;
      const isPrice = textSec.variant === 'price';
      const secFontSize = Math.max(minTextSize, Math.round((textSec.idealFontSize ?? (isPrice ? 20 : 15)) * viewScale));
      const secDims = calculateTextDimensions(textSec.text, secFontSize, safeW, 1);

      if (currentY + secDims.height <= maxYForUpperContent) {
        boxes.push({
          id: sec.id,
          role: sec.role,
          type: sec.type,
          priority: sec.priority,
          x: startX + (isPrice ? Math.round((safeW - secDims.width) / 2) : 0),
          y: currentY,
          width: isPrice ? secDims.width : safeW,
          height: secDims.height,
          fontSize: secFontSize,
          status: 'rendered',
        });
        currentY += secDims.height + gapY;
      }
    }
  }

  if (ctaBox) {
    boxes.push(ctaBox);
  }

  // Completeness check: all candidate elements must have been accommodated
  if (boxes.length < elements.length || currentY > maxYForUpperContent) {
    return { success: false, boxes: [] };
  }

  const sanity = validateLayoutSanity(boxes, safeArea, params.safeArea.left + safeW + params.safeArea.right, params.safeArea.top + safeH + params.safeArea.bottom);
  return { success: sanity.valid, boxes };
}
