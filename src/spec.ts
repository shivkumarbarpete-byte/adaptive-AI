/**
 * Adaptive Layout Engine - Specification Module
 * Defines declarative ad structures, element roles, numeric priorities, and compile-time/runtime validation.
 */

export type AdElementType = 'text' | 'image' | 'button';

export type AdElementRole = 
  | 'primary'     // Main headline or value proposition (essential)
  | 'hero'        // Primary visual asset (product shot, feature photo)
  | 'action'      // Call to action button or interactive element (essential)
  | 'secondary'   // Supporting detail (price, promo tag, subtitle, disclosure)
  | 'branding';   // Brand logo, mark, or company badge (first to drop under heavy space constraint)

export interface BaseElementSpec {
  id: string;
  type: AdElementType;
  role: AdElementRole;
  /**
   * Numeric priority for graceful degradation.
   * Higher number = higher priority.
   * Under space pressure, lower priority elements shrink or drop first.
   * Recommended range: 1 (lowest/optional) to 10 (highest/critical).
   */
  priority: number;
  minWidth?: number;
  minHeight?: number;
  preferredWidth?: number;
  preferredHeight?: number;
  aspectRatio?: number; // width / height ratio
}

export interface TextElementSpec extends BaseElementSpec {
  type: 'text';
  text: string;
  variant?: 'headline' | 'subhead' | 'price' | 'caption';
  idealFontSize?: number;
  maxLines?: number;
  allowTruncation?: boolean;
}

export interface ImageElementSpec extends BaseElementSpec {
  type: 'image';
  src: string;
  alt: string;
  objectFit?: 'contain' | 'cover';
}

export interface ButtonElementSpec extends BaseElementSpec {
  type: 'button';
  label: string;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: string;
  idealFontSize?: number;
}

export type AdElement = TextElementSpec | ImageElementSpec | ButtonElementSpec;

export interface AdTheme {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardBackground: string;
  textColor: string;
  mutedTextColor: string;
  buttonTextColor: string;
  fontFamily?: string;
  displayFontFamily?: string;
}

export interface AdSpec {
  id: string;
  name: string;
  theme?: Partial<AdTheme>;
  elements: AdElement[];
}

export class AdSpecValidationError extends Error {
  readonly field?: string;
  readonly details?: unknown;

  constructor(message: string, field?: string, details?: unknown) {
    super(`[AdSpecValidationError] ${message}${field ? ` (field: ${field})` : ''}`);
    this.name = 'AdSpecValidationError';
    this.field = field;
    this.details = details;
  }
}

const VALID_TYPES: readonly AdElementType[] = ['text', 'image', 'button'];
const VALID_ROLES: readonly AdElementRole[] = ['primary', 'hero', 'action', 'secondary', 'branding'];

/**
 * Validates and freezes an AdSpec at runtime.
 * Throws an AdSpecValidationError if any schema rules or integrity constraints are violated.
 */
export function defineAd<T extends AdSpec>(spec: T): Readonly<T> {
  if (!spec || typeof spec !== 'object') {
    throw new AdSpecValidationError('AdSpec must be a valid non-null object');
  }

  if (!spec.id || typeof spec.id !== 'string' || spec.id.trim() === '') {
    throw new AdSpecValidationError('AdSpec requires a non-empty "id" string', 'id');
  }

  if (!spec.name || typeof spec.name !== 'string' || spec.name.trim() === '') {
    throw new AdSpecValidationError('AdSpec requires a non-empty "name" string', 'name');
  }

  if (!Array.isArray(spec.elements) || spec.elements.length === 0) {
    throw new AdSpecValidationError('AdSpec elements must be a non-empty array', 'elements');
  }

  const seenIds = new Set<string>();
  let hasPrimaryOrHero = false;
  let hasAction = false;

  for (let i = 0; i < spec.elements.length; i++) {
    const el = spec.elements[i];
    const prefix = `elements[${i}]`;

    if (!el || typeof el !== 'object') {
      throw new AdSpecValidationError(`Element at index ${i} must be an object`, prefix);
    }

    if (!el.id || typeof el.id !== 'string' || el.id.trim() === '') {
      throw new AdSpecValidationError(`Element requires a valid non-empty id`, `${prefix}.id`);
    }

    if (seenIds.has(el.id)) {
      throw new AdSpecValidationError(`Duplicate element id "${el.id}" detected`, `${prefix}.id`, { duplicateId: el.id });
    }
    seenIds.add(el.id);

    if (!VALID_TYPES.includes(el.type)) {
      throw new AdSpecValidationError(
        `Invalid element type "${el.type}". Allowed types: ${VALID_TYPES.join(', ')}`,
        `${prefix}.type`
      );
    }

    if (!VALID_ROLES.includes(el.role)) {
      throw new AdSpecValidationError(
        `Invalid element role "${el.role}". Allowed roles: ${VALID_ROLES.join(', ')}`,
        `${prefix}.role`
      );
    }

    if (typeof el.priority !== 'number' || !Number.isFinite(el.priority) || el.priority <= 0) {
      throw new AdSpecValidationError(
        `Element priority must be a finite positive number, received ${el.priority}`,
        `${prefix}.priority`
      );
    }

    if (el.role === 'primary' || el.role === 'hero') {
      hasPrimaryOrHero = true;
    }
    if (el.role === 'action') {
      hasAction = true;
    }

    // Type-specific validation
    if (el.type === 'text') {
      const textEl = el as TextElementSpec;
      if (typeof textEl.text !== 'string' || textEl.text.trim() === '') {
        throw new AdSpecValidationError(`Text element "${el.id}" requires non-empty "text" string`, `${prefix}.text`);
      }
      if (textEl.idealFontSize !== undefined && (typeof textEl.idealFontSize !== 'number' || textEl.idealFontSize <= 0)) {
        throw new AdSpecValidationError(`Text element "${el.id}" idealFontSize must be > 0`, `${prefix}.idealFontSize`);
      }
    } else if (el.type === 'image') {
      const imgEl = el as ImageElementSpec;
      if (typeof imgEl.src !== 'string' || imgEl.src.trim() === '') {
        throw new AdSpecValidationError(`Image element "${el.id}" requires non-empty "src" string`, `${prefix}.src`);
      }
      if (typeof imgEl.alt !== 'string') {
        throw new AdSpecValidationError(`Image element "${el.id}" requires an "alt" description`, `${prefix}.alt`);
      }
      if (imgEl.aspectRatio !== undefined && (typeof imgEl.aspectRatio !== 'number' || imgEl.aspectRatio <= 0)) {
        throw new AdSpecValidationError(`Image element "${el.id}" aspectRatio must be > 0`, `${prefix}.aspectRatio`);
      }
    } else if (el.type === 'button') {
      const btnEl = el as ButtonElementSpec;
      if (typeof btnEl.label !== 'string' || btnEl.label.trim() === '') {
        throw new AdSpecValidationError(`Button element "${el.id}" requires non-empty "label" string`, `${prefix}.label`);
      }
    }
  }

  if (!hasPrimaryOrHero) {
    throw new AdSpecValidationError('AdSpec must include at least one element with role "primary" or "hero"');
  }

  if (!hasAction) {
    throw new AdSpecValidationError('AdSpec must include at least one element with role "action" (CTA)');
  }

  return Object.freeze(JSON.parse(JSON.stringify(spec))) as Readonly<T>;
}
