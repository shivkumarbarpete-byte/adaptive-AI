/**
 * Realistic Product Ad Spec
 * Defined once, resolved universally across all surface profiles.
 */

import { defineAd, type AdSpec } from './spec';

export const AURA_HEADPHONES_AD: Readonly<AdSpec> = defineAd({
  id: 'ad-aura-pro-anc',
  name: 'Aura Pro ANC Headphones Launch',
  theme: {
    primaryColor: '#FF6B4A', // Warm coral / orange
    accentColor: '#0EA894',  // Teal / emerald
    backgroundColor: '#1C1924', // Deep rich plum-charcoal luxury backdrop
    cardBackground: 'rgba(38, 33, 49, 0.85)',
    textColor: '#FFFFFF',
    mutedTextColor: '#D5D1DF',
    buttonTextColor: '#FFFFFF',
  },
  elements: [
    {
      id: 'brand-logo',
      type: 'text',
      role: 'branding',
      priority: 3, // Lowest priority: will cleanly drop first under heavy space constraints!
      text: 'SONICLABS™',
      variant: 'caption',
      idealFontSize: 13,
      aspectRatio: 3.5,
    },
    {
      id: 'hero-product-image',
      type: 'image',
      role: 'hero',
      priority: 7,
      src: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80&auto=format&fit=crop',
      alt: 'Aura Pro Matte Black Noise Cancelling Headphones',
      aspectRatio: 1.25,
      objectFit: 'contain',
      minWidth: 80,
      minHeight: 64,
    },
    {
      id: 'primary-headline',
      type: 'text',
      role: 'primary',
      priority: 10, // Essential headline: highest priority
      text: 'Immerse in Pure Sound with Aura Pro',
      variant: 'headline',
      idealFontSize: 24,
      maxLines: 2,
    },
    {
      id: 'price-tag',
      type: 'text',
      role: 'secondary',
      priority: 8,
      text: '$249 · Limited Edition',
      variant: 'price',
      idealFontSize: 18,
    },
    {
      id: 'cta-button',
      type: 'button',
      role: 'action',
      priority: 9, // Essential CTA: protected from dropping
      label: 'Order Now',
      variant: 'primary',
      minWidth: 130,
      minHeight: 48,
    },
  ],
});
