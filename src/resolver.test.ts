import { describe, it, expect } from 'vitest';
import { defineAd, AdSpecValidationError } from './spec';
import {
  MOBILE_PORTRAIT,
  MOBILE_LANDSCAPE,
  BROADCAST_LOWER_THIRD,
  SQUARE_KIOSK_TIGHT,
  SQUARE_KIOSK_FULL,
  DIGITAL_BILLBOARD,
  createCustomSurface,
} from './surfaces';
import { resolveLayout, checkBoundingBoxOverlap, validateLayoutSanity } from './resolver';
import { AURA_HEADPHONES_AD } from './sample-ad';

describe('Specification Validation (spec.ts)', () => {
  it('successfully validates and freezes a well-formed ad spec', () => {
    expect(AURA_HEADPHONES_AD.id).toBe('ad-aura-pro-anc');
    expect(AURA_HEADPHONES_AD.elements.length).toBe(5);
    expect(Object.isFrozen(AURA_HEADPHONES_AD)).toBe(true);
  });

  it('rejects specs with duplicate element IDs', () => {
    expect(() => {
      defineAd({
        id: 'invalid-dup',
        name: 'Invalid Duplicate',
        elements: [
          { id: 'item-1', type: 'text', role: 'primary', priority: 10, text: 'Title' },
          { id: 'item-1', type: 'button', role: 'action', priority: 9, label: 'Click' },
        ],
      });
    }).toThrow(AdSpecValidationError);
  });

  it('rejects specs without a primary or hero role', () => {
    expect(() => {
      defineAd({
        id: 'no-primary',
        name: 'No Primary',
        elements: [
          { id: 'btn', type: 'button', role: 'action', priority: 9, label: 'Click' },
          { id: 'sec', type: 'text', role: 'secondary', priority: 5, text: 'Details' },
        ],
      });
    }).toThrow(AdSpecValidationError);
  });

  it('rejects specs without an action (CTA) role', () => {
    expect(() => {
      defineAd({
        id: 'no-action',
        name: 'No Action',
        elements: [
          { id: 'title', type: 'text', role: 'primary', priority: 10, text: 'Title' },
        ],
      });
    }).toThrow(AdSpecValidationError);
  });
});

describe('Constraint Resolution Algorithm (resolver.ts)', () => {
  it('produces a vertical stack composition for Mobile Portrait (320x480)', () => {
    const layout = resolveLayout(AURA_HEADPHONES_AD, MOBILE_PORTRAIT);

    expect(layout.compositionMode).toBe('vertical-stack');
    expect(layout.elements.length).toBeGreaterThanOrEqual(3);

    // Hard per-surface constraint check: minTapTarget
    const cta = layout.elements.find(e => e.id === 'cta-button');
    expect(cta).toBeDefined();
    expect(cta!.height).toBeGreaterThanOrEqual(MOBILE_PORTRAIT.minTapTarget);

    // Sanity check: zero overlap & safe margin compliance
    const sanity = validateLayoutSanity(layout.elements, layout.safeArea, layout.canvasWidth, layout.canvasHeight);
    expect(sanity.valid).toBe(true);
  });

  it('produces a split dual-column composition for Mobile Landscape (640x360)', () => {
    const layout = resolveLayout(AURA_HEADPHONES_AD, MOBILE_LANDSCAPE);

    expect(layout.compositionMode).toBe('split-columns');

    // Verify presence of hero in left column and CTA in right column
    const hero = layout.elements.find(e => e.id === 'hero-product-image');
    const cta = layout.elements.find(e => e.id === 'cta-button');
    expect(hero).toBeDefined();
    expect(cta).toBeDefined();

    // CTA must be positioned to the right of hero
    expect(cta!.x).toBeGreaterThan(hero!.x + hero!.width);

    const sanity = validateLayoutSanity(layout.elements, layout.safeArea, layout.canvasWidth, layout.canvasHeight);
    expect(sanity.valid).toBe(true);
  });

  it('produces a horizontal strip composition with large text for Broadcast Lower-Third (1920x250)', () => {
    const layout = resolveLayout(AURA_HEADPHONES_AD, BROADCAST_LOWER_THIRD);

    expect(layout.compositionMode).toBe('horizontal-strip');

    // Hard constraint check: broadcast viewing distance requires large font >= 28px
    const headline = layout.elements.find(e => e.id === 'primary-headline');
    expect(headline).toBeDefined();
    expect(headline!.fontSize).toBeGreaterThanOrEqual(BROADCAST_LOWER_THIRD.minTextSize);

    // Elements should be arranged horizontally along the strip
    const sanity = validateLayoutSanity(layout.elements, layout.safeArea, layout.canvasWidth, layout.canvasHeight);
    expect(sanity.valid).toBe(true);
  });

  it('deliberately drops lowest-priority branding on Tight Retail Kiosk while headline and CTA stay intact', () => {
    const layout = resolveLayout(AURA_HEADPHONES_AD, SQUARE_KIOSK_TIGHT);

    expect(layout.compositionMode).toBe('compact-grid');

    // 1. Branding (priority 3) must be cleanly dropped due to space pressure
    const droppedBrand = layout.droppedElements.find(e => e.id === 'brand-logo');
    expect(droppedBrand).toBeDefined();
    expect(droppedBrand!.priority).toBe(3);

    // 2. High priority headline (priority 10) and CTA (priority 9) MUST stay intact
    const headline = layout.elements.find(e => e.id === 'primary-headline');
    const cta = layout.elements.find(e => e.id === 'cta-button');
    expect(headline).toBeDefined();
    expect(cta).toBeDefined();

    // 3. Strict minTapTarget (72px) must be respected on the kiosk CTA
    expect(cta!.height).toBeGreaterThanOrEqual(SQUARE_KIOSK_TIGHT.minTapTarget);

    // 4. Absolutely no overlapping or clipping
    const sanity = validateLayoutSanity(layout.elements, layout.safeArea, layout.canvasWidth, layout.canvasHeight);
    expect(sanity.valid).toBe(true);
  });

  it('renders all elements including branding when ample space is available (Full Kiosk 1080x1080)', () => {
    const layout = resolveLayout(AURA_HEADPHONES_AD, SQUARE_KIOSK_FULL);

    // On full 1080x1080 kiosk, branding should NOT drop
    const brand = layout.elements.find(e => e.id === 'brand-logo');
    expect(brand).toBeDefined();
    expect(layout.droppedElements.length).toBe(0);

    const sanity = validateLayoutSanity(layout.elements, layout.safeArea, layout.canvasWidth, layout.canvasHeight);
    expect(sanity.valid).toBe(true);
  });

  it('generalizes to an arbitrary, previously-unseen 5th surface profile without code changes', () => {
    const layout = resolveLayout(AURA_HEADPHONES_AD, DIGITAL_BILLBOARD);

    expect(layout.elements.length).toBeGreaterThanOrEqual(3);
    const sanity = validateLayoutSanity(layout.elements, layout.safeArea, layout.canvasWidth, layout.canvasHeight);
    expect(sanity.valid).toBe(true);
  });

  it('handles arbitrary dynamic custom surfaces (e.g. ultra-wide 1600x300 or narrow 300x700)', () => {
    const customWide = createCustomSurface({
      width: 1600,
      height: 300,
      minTapTarget: 0,
      minTextSize: 22,
    });
    const customTall = createCustomSurface({
      width: 300,
      height: 700,
      minTapTarget: 50,
      minTextSize: 14,
    });

    const layoutWide = resolveLayout(AURA_HEADPHONES_AD, customWide);
    const layoutTall = resolveLayout(AURA_HEADPHONES_AD, customTall);

    expect(layoutWide.compositionMode).toBe('horizontal-strip');
    expect(layoutTall.compositionMode).toBe('vertical-stack');

    expect(validateLayoutSanity(layoutWide.elements, layoutWide.safeArea, layoutWide.canvasWidth, layoutWide.canvasHeight).valid).toBe(true);
    expect(validateLayoutSanity(layoutTall.elements, layoutTall.safeArea, layoutTall.canvasWidth, layoutTall.canvasHeight).valid).toBe(true);
  });

  it('mathematically proves no bounding boxes intersect for any test layout', () => {
    const profiles = [
      MOBILE_PORTRAIT,
      MOBILE_LANDSCAPE,
      BROADCAST_LOWER_THIRD,
      SQUARE_KIOSK_TIGHT,
      SQUARE_KIOSK_FULL,
      DIGITAL_BILLBOARD,
    ];

    for (const surface of profiles) {
      const layout = resolveLayout(AURA_HEADPHONES_AD, surface);
      for (let i = 0; i < layout.elements.length; i++) {
        for (let j = i + 1; j < layout.elements.length; j++) {
          const overlap = checkBoundingBoxOverlap(layout.elements[i], layout.elements[j]);
          expect(overlap).toBe(false);
        }
      }
    }
  });
});
