/**
 * Adaptive Layout Engine - DOM/CSS Renderer
 *
 * PURE RENDERER:
 * Consumes ONLY ResolvedLayout geometry (x, y, width, height, fontSize) and AdSpec visual tokens.
 * It has ZERO knowledge of surface names, device profiles, priority logic, or constraint solving.
 */

import React, { useState } from 'react';
import type { AdSpec, ButtonElementSpec, ImageElementSpec, TextElementSpec } from './spec';
import type { ResolvedLayout, ResolvedElementBox } from './resolver';

export interface RenderDomProps {
  spec: AdSpec;
  layout: ResolvedLayout;
  showSafeAreaGuides?: boolean;
  scale?: number;
  className?: string;
  onActionClick?: (actionId: string) => void;
}

export const ResolvedAdDOM: React.FC<RenderDomProps> = ({
  spec,
  layout,
  showSafeAreaGuides = false,
  scale = 1,
  className = '',
  onActionClick,
}) => {
  const { elements, canvasWidth, canvasHeight, safeArea } = layout;
  const theme = spec.theme ?? {};
  const [clickedAction, setClickedAction] = useState<string | null>(null);

  // Map elements by ID for instant spec metadata lookup
  const specMap = new Map(spec.elements.map(el => [el.id, el]));

  const handleAction = (id: string) => {
    setClickedAction(id);
    onActionClick?.(id);
    setTimeout(() => setClickedAction(null), 300);
  };

  return (
    <div
      className={`relative select-none overflow-hidden ${className}`}
      style={{
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        backgroundColor: theme.backgroundColor ?? '#0F111A',
        color: theme.textColor ?? '#F3F4F6',
        fontFamily: theme.fontFamily ?? 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Background Ambient Glow */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background: `radial-gradient(circle at 75% 25%, ${theme.primaryColor ?? '#FF6B4A'}38 0%, transparent 65%),
                       radial-gradient(circle at 20% 80%, ${theme.accentColor ?? '#0EA894'}28 0%, transparent 55%)`,
        }}
      />

      {/* Safe Area Visual Inset Guide (Developer overlay) */}
      {showSafeAreaGuides && (
        <div
          className="absolute pointer-events-none border-2 border-dashed border-teal-400/80 z-30 transition-all duration-300"
          style={{
            top: `${safeArea.top}px`,
            left: `${safeArea.left}px`,
            width: `${canvasWidth - safeArea.left - safeArea.right}px`,
            height: `${canvasHeight - safeArea.top - safeArea.bottom}px`,
            boxShadow: 'inset 0 0 0 1px rgba(14, 168, 148, 0.2)',
          }}
        >
          <div className="absolute top-1.5 left-2.5 text-[13px] font-sans font-semibold text-teal-100 bg-teal-900/90 px-2.5 py-0.5 rounded-full shadow-sm">
            Safe Area Margin
          </div>
        </div>
      )}

      {/* Resolved Elements Layer */}
      {elements.map(box => {
        const itemSpec = specMap.get(box.id);
        if (!itemSpec) return null;

        return (
          <div
            key={box.id}
            data-element-id={box.id}
            data-element-role={box.role}
            className="absolute transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] z-10 box-border overflow-hidden"
            style={{
              left: `${box.x}px`,
              top: `${box.y}px`,
              width: `${box.width}px`,
              height: `${box.height}px`,
            }}
          >
            {renderBoxContent(box, itemSpec, theme, clickedAction === box.id, () => handleAction(box.id))}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Pure element content renderer based on type and visual tokens.
 */
function renderBoxContent(
  box: ResolvedElementBox,
  specItem: NonNullable<ReturnType<Map<string, any>['get']>>,
  theme: Record<string, string | undefined>,
  isClicked: boolean,
  onAction: () => void
): React.ReactNode {
  switch (specItem.type) {
    case 'image': {
      const img = specItem as ImageElementSpec;
      return (
        <div className="w-full h-full relative rounded-xl overflow-hidden shadow-lg border border-white/10 bg-slate-900/60 group">
          <img
            src={img.src}
            alt={img.alt}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ objectFit: img.objectFit ?? 'cover' }}
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>
      );
    }

    case 'button': {
      const btn = specItem as ButtonElementSpec;
      const bg = theme.primaryColor ?? '#FF6B4A';
      return (
        <button
          type="button"
          onClick={onAction}
          className="w-full h-full flex items-center justify-center font-bold rounded-2xl tracking-wide cursor-pointer transition-all duration-200 active:scale-[0.98] shadow-lg shadow-orange-950/20 hover:brightness-105 active:brightness-95 select-none px-5 text-white"
          style={{
            backgroundColor: bg,
            color: theme.buttonTextColor ?? '#FFFFFF',
            fontSize: `${Math.max(14, box.fontSize ?? 16)}px`,
            border: '1px solid rgba(255,255,255,0.25)',
            transform: isClicked ? 'scale(0.97)' : undefined,
          }}
        >
          <span>{btn.label}</span>
          <svg className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      );
    }

    case 'text': {
      const txt = specItem as TextElementSpec;
      const fontSize = Math.max(13, box.fontSize ?? txt.idealFontSize ?? 16);

      if (txt.role === 'branding') {
        return (
          <div className="h-full flex items-center">
            <span
              className="inline-flex items-center px-3 py-1 rounded-lg text-[13px] font-extrabold tracking-wider uppercase border border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-sm"
            >
              ✦ {txt.text}
            </span>
          </div>
        );
      }

      if (txt.variant === 'price') {
        return (
          <div className="h-full flex items-center">
            <span
              className="font-bold tracking-tight text-teal-300 bg-teal-950/60 border border-teal-500/30 px-3 py-1.5 rounded-xl shadow-sm"
              style={{ fontSize: `${Math.max(14, fontSize)}px` }}
            >
              {txt.text}
            </span>
          </div>
        );
      }

      if (txt.variant === 'headline' || txt.role === 'primary') {
        return (
          <h2
            className="font-extrabold tracking-tight text-white leading-tight font-heading"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: 1.22,
              textShadow: '0 2px 10px rgba(0,0,0,0.45)',
            }}
          >
            {txt.text}
          </h2>
        );
      }

      // Default / secondary text
      return (
        <p
          className="font-medium text-slate-300 leading-normal"
          style={{ fontSize: `${fontSize}px` }}
        >
          {txt.text}
        </p>
      );
    }
  }
}
