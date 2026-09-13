/**
 * Adaptive Layout Engine - Surface Profiles Module
 * Models physical display constraints beyond raw width and height:
 * safe areas, viewing distances, touch mechanics, and minimum accessibility thresholds.
 */

export type ViewingDistance = 'near' | 'arm-length' | 'medium' | 'far';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SurfaceProfile {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly width: number;
  readonly height: number;
  readonly safeArea: SafeAreaInsets;
  /**
   * Minimum dimension in pixels for touch targets (WCAG / physical usability).
   * Touch surfaces require >= 44-72px, whereas non-touch broadcast displays can be 0.
   */
  readonly minTapTarget: number;
  /**
   * Minimum legibility threshold for text in pixels, determined by viewing distance and optical resolution.
   */
  readonly minTextSize: number;
  /**
   * Physical viewing context:
   * 'near' (~30cm, smartphone), 'arm-length' (~60cm, kiosk/tablet), 'medium' (~1.5m, desktop), 'far' (>3m, TV/billboard)
   */
  readonly viewingDistance: ViewingDistance;
  readonly touchOnly: boolean;
  /**
   * Bezel archetype for realistic UI preview frame in demo
   */
  readonly deviceFrame: 'phone-portrait' | 'phone-landscape' | 'broadcast-tv' | 'kiosk-terminal' | 'billboard' | 'custom';
}

/**
 * 1. Mobile Portrait Interstitial (320 x 480)
 * Classic compact mobile ad unit. High verticality, near viewing distance, touch-first ergonomics.
 */
export const MOBILE_PORTRAIT: SurfaceProfile = {
  id: 'mobile-portrait',
  name: 'Mobile Portrait',
  description: 'Handheld smartphone interstitial (320x480). Thumb-driven action zone at bottom.',
  width: 320,
  height: 480,
  safeArea: { top: 28, right: 16, bottom: 28, left: 16 },
  minTapTarget: 48,
  minTextSize: 14,
  viewingDistance: 'near',
  touchOnly: true,
  deviceFrame: 'phone-portrait',
};

/**
 * 2. Mobile Landscape Banner / Interstitial (640 x 360)
 * Wide horizontal aspect ratio with camera notch side safe margins.
 */
export const MOBILE_LANDSCAPE: SurfaceProfile = {
  id: 'mobile-landscape',
  name: 'Mobile Landscape',
  description: 'Widescreen mobile gaming/video banner (640x360). Dual-column split composition.',
  width: 640,
  height: 360,
  safeArea: { top: 16, right: 36, bottom: 20, left: 36 },
  minTapTarget: 44,
  minTextSize: 13,
  viewingDistance: 'near',
  touchOnly: true,
  deviceFrame: 'phone-landscape',
};

/**
 * 3. Broadcast Lower-Third (1920 x 250)
 * Ultra-wide horizontal strip across television broadcasts.
 * Non-touch, far viewing distance (>3m) demanding massive min font sizes and SMPTE title safe area.
 */
export const BROADCAST_LOWER_THIRD: SurfaceProfile = {
  id: 'broadcast-lower-third',
  name: 'Broadcast Lower-Third',
  description: 'Television bottom overlay (1920x250). 3m viewing distance, extra-large legibility font, non-touch.',
  width: 1920,
  height: 250,
  safeArea: { top: 18, right: 96, bottom: 24, left: 96 },
  minTapTarget: 0, // Non-touch display; buttons are promotional badges
  minTextSize: 28, // Television viewing distance requires >= 28px text for optical legibility
  viewingDistance: 'far',
  touchOnly: false,
  deviceFrame: 'broadcast-tv',
};

/**
 * 4. Square Retail Kiosk - Space Constrained (460 x 460)
 * Deliberately tight on space to test constraint-driven degradation:
 * Strenuous minTapTarget (72px) and minTextSize (20px) force lower-priority branding to gracefully drop
 * while headline, price, and CTA remain intact with zero clipping or overlap!
 */
export const SQUARE_KIOSK_TIGHT: SurfaceProfile = {
  id: 'square-kiosk-tight',
  name: 'Retail Kiosk (Tight Terminal)',
  description: 'Compact self-checkout touch kiosk (460x460). 72px tap targets force branding to drop cleanly.',
  width: 460,
  height: 460,
  safeArea: { top: 32, right: 28, bottom: 32, left: 28 },
  minTapTarget: 72, // Public kiosks demand massive tap targets for accessibility
  minTextSize: 20, // Arm-length public standing distance
  viewingDistance: 'arm-length',
  touchOnly: true,
  deviceFrame: 'kiosk-terminal',
};

/**
 * Spacious Retail Kiosk (1080 x 1080)
 * Full-size standard kiosk for comparison.
 */
export const SQUARE_KIOSK_FULL: SurfaceProfile = {
  id: 'square-kiosk-full',
  name: 'Retail Kiosk (Full 1080p)',
  description: 'Large commercial interactive totem (1080x1080). Ample space allows full branding + hero.',
  width: 1080,
  height: 1080,
  safeArea: { top: 60, right: 60, bottom: 60, left: 60 },
  minTapTarget: 72,
  minTextSize: 24,
  viewingDistance: 'arm-length',
  touchOnly: true,
  deviceFrame: 'kiosk-terminal',
};

/**
 * 5. Digital Billboard (1200 x 400)
 * Arbitrary 5th profile used to demonstrate zero-code-change generalization.
 */
export const DIGITAL_BILLBOARD: SurfaceProfile = {
  id: 'digital-billboard',
  name: 'Highway Digital Billboard',
  description: 'High-speed roadside LED board (1200x400). High contrast, far distance, non-touch.',
  width: 1200,
  height: 400,
  safeArea: { top: 24, right: 48, bottom: 24, left: 48 },
  minTapTarget: 0,
  minTextSize: 26,
  viewingDistance: 'far',
  touchOnly: false,
  deviceFrame: 'billboard',
};

export const STANDARD_SURFACES: readonly SurfaceProfile[] = [
  MOBILE_PORTRAIT,
  MOBILE_LANDSCAPE,
  BROADCAST_LOWER_THIRD,
  SQUARE_KIOSK_TIGHT,
  SQUARE_KIOSK_FULL,
  DIGITAL_BILLBOARD,
];

/**
 * Dynamic custom surface factory for testing arbitrary, previously unseen constraints.
 */
export function createCustomSurface(params: {
  id?: string;
  name?: string;
  width: number;
  height: number;
  safeArea?: Partial<SafeAreaInsets>;
  minTapTarget?: number;
  minTextSize?: number;
  viewingDistance?: ViewingDistance;
  touchOnly?: boolean;
}): SurfaceProfile {
  return {
    id: params.id ?? `custom-${params.width}x${params.height}`,
    name: params.name ?? `Custom Surface (${params.width}x${params.height})`,
    description: `Dynamic surface generated with custom constraints (${params.width}x${params.height}px)`,
    width: Math.max(120, params.width),
    height: Math.max(120, params.height),
    safeArea: {
      top: params.safeArea?.top ?? 16,
      right: params.safeArea?.right ?? 16,
      bottom: params.safeArea?.bottom ?? 16,
      left: params.safeArea?.left ?? 16,
    },
    minTapTarget: params.minTapTarget ?? 44,
    minTextSize: params.minTextSize ?? 14,
    viewingDistance: params.viewingDistance ?? 'medium',
    touchOnly: params.touchOnly ?? true,
    deviceFrame: 'custom',
  };
}
