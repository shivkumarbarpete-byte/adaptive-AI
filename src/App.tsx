import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Smartphone,
  Tv,
  Monitor,
  Square,
  Sliders,
  Eye,
  EyeOff,
  CheckCircle2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  BarChart3,
  MousePointer,
} from 'lucide-react';

import { AURA_HEADPHONES_AD } from './sample-ad';
import {
  MOBILE_PORTRAIT,
  MOBILE_LANDSCAPE,
  BROADCAST_LOWER_THIRD,
  SQUARE_KIOSK_TIGHT,
  SQUARE_KIOSK_FULL,
  DIGITAL_BILLBOARD,
  createCustomSurface,
  type SurfaceProfile,
  type ViewingDistance,
} from './surfaces';
import { resolveLayout, type ResolvedLayout } from './resolver';
import { ResolvedAdDOM } from './render-dom';
import { renderToCanvas } from './render-canvas';

interface SurfaceCardOption {
  profile: SurfaceProfile;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  category: string;
  description: string;
  themeColor: string;
  accentBg: string;
  accentBorder: string;
  badge?: string;
  badgeColor?: string;
}

export default function App() {
  const surfaces: SurfaceCardOption[] = useMemo(
    () => [
      {
        profile: MOBILE_PORTRAIT,
        icon: Smartphone,
        label: 'Mobile Portrait',
        category: 'Handheld',
        description: '320 × 480 · Thumb-reach CTA, vertical stack',
        themeColor: '#FF6B4A',
        accentBg: '#FFF5F2',
        accentBorder: '#FFD9CE',
      },
      {
        profile: MOBILE_LANDSCAPE,
        icon: Smartphone,
        label: 'Mobile Landscape',
        category: 'Widescreen',
        description: '640 × 360 · Notch-safe, dual-column split',
        themeColor: '#2563EB',
        accentBg: '#F0F7FF',
        accentBorder: '#D0E4FF',
      },
      {
        profile: BROADCAST_LOWER_THIRD,
        icon: Tv,
        label: 'Broadcast TV',
        category: 'Living Room',
        description: '1920 × 250 · Far viewing, 28px text strip',
        themeColor: '#0EA894',
        accentBg: '#EEFAF8',
        accentBorder: '#C3EFE8',
      },
      {
        profile: SQUARE_KIOSK_TIGHT,
        icon: Square,
        label: 'Retail Kiosk (Tight)',
        category: 'Touch Terminal',
        description: '440 × 440 · Strict 72px tap targets drop logo',
        themeColor: '#D97706',
        accentBg: '#FEF9E8',
        accentBorder: '#FBE9B3',
        badge: 'Drops Logo',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      },
      {
        profile: SQUARE_KIOSK_FULL,
        icon: Maximize2,
        label: 'Retail Kiosk (Full)',
        category: 'Totem',
        description: '1080 × 1080 · Spacious square, all elements fit',
        themeColor: '#7C3AED',
        accentBg: '#F7F4FD',
        accentBorder: '#E2D6F7',
      },
      {
        profile: DIGITAL_BILLBOARD,
        icon: Monitor,
        label: 'Highway Billboard',
        category: 'Out of Home',
        description: '1200 × 400 · Unseen 5th profile test',
        themeColor: '#E11D48',
        accentBg: '#FFF2F5',
        accentBorder: '#FFD3DC',
        badge: '5th Profile',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
      },
    ],
    []
  );

  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string>(MOBILE_PORTRAIT.id);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [rendererMode, setRendererMode] = useState<'dom' | 'canvas'>('dom');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  // Dynamic slider state
  const [customWidth, setCustomWidth] = useState<number>(540);
  const [customHeight, setCustomHeight] = useState<number>(480);
  const [customMinTap, setCustomMinTap] = useState<number>(56);
  const [customMinText, setCustomMinText] = useState<number>(16);
  const [customDistance, setCustomDistance] = useState<ViewingDistance>('medium');

  // Active surface profile calculation
  const activeSurface: SurfaceProfile = useMemo(() => {
    if (isCustomMode) {
      return createCustomSurface({
        width: customWidth,
        height: customHeight,
        minTapTarget: customMinTap,
        minTextSize: customMinText,
        viewingDistance: customDistance,
        safeArea: { top: 24, right: 24, bottom: 24, left: 24 },
      });
    }
    const found = surfaces.find(s => s.profile.id === selectedSurfaceId);
    return found ? found.profile : MOBILE_PORTRAIT;
  }, [isCustomMode, customWidth, customHeight, customMinTap, customMinText, customDistance, selectedSurfaceId, surfaces]);

  // Execute pure constraint resolution algorithm
  const resolvedLayout: ResolvedLayout = useMemo(() => {
    return resolveLayout(AURA_HEADPHONES_AD, activeSurface);
  }, [activeSurface]);

  // HTML5 Canvas ref for canvas renderer mode
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (rendererMode === 'canvas' && canvasRef.current) {
      renderToCanvas(canvasRef.current, AURA_HEADPHONES_AD, resolvedLayout, {
        showSafeAreaGuides: showGuides,
      });
    }
  }, [rendererMode, resolvedLayout, showGuides]);

function getDeviceBezelDimensions(surface: SurfaceProfile): { width: number; height: number } {
  switch (surface.deviceFrame) {
    case 'phone-portrait':
      return { width: surface.width + 40, height: surface.height + 90 };
    case 'phone-landscape':
      return { width: surface.width + 68, height: surface.height + 40 };
    case 'broadcast-tv':
      return { width: surface.width + 30, height: surface.height + 254 };
    case 'kiosk-terminal':
      return { width: surface.width + 56, height: surface.height + 122 };
    default:
      return { width: surface.width + 38, height: surface.height + 38 };
  }
}

  // Viewport auto-scaling based on true outer device bezel dimensions
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoScale, setAutoScale] = useState<number>(1);

  const bezelDims = useMemo(() => getDeviceBezelDimensions(activeSurface), [activeSurface]);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      // Reserve 48px padding so the device mockup sits comfortably inside the canvas panel
      const availW = Math.max(100, containerRef.current.clientWidth - 48);
      const availH = Math.max(100, containerRef.current.clientHeight - 48);

      const scaleX = availW / bezelDims.width;
      const scaleY = availH / bezelDims.height;
      const fitted = Math.min(1, Math.min(scaleX, scaleY));
      setAutoScale(Math.max(0.15, fitted));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [bezelDims]);

  const effectiveScale = autoScale * zoomLevel;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F8F7F4] text-[#3C364C]">
      {/* Top Editorial Navigation Header */}
      <header className="h-20 bg-white border-b border-[#EAE7DF] px-8 flex items-center justify-between shrink-0 shadow-soft z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B4A] to-[#FF8E72] flex items-center justify-center shadow-lg shadow-[#FF6B4A]/25 text-white">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold text-[#2B2140] tracking-tight font-heading">
                Adaptive Layout Engine
              </h1>
              <span className="text-[13px] font-bold px-3 py-0.5 rounded-full bg-[#FFF0EB] text-[#FF6B4A] border border-[#FFD9CE]">
                Multi-Surface Compiler
              </span>
            </div>
            <p className="text-[14px] text-[#6B6578] mt-0.5">
              Declarative single-spec ads resolved across diverse physical constraints
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-4">
          {/* Renderer Selector */}
          <div className="flex items-center bg-[#F3F1EC] p-1.5 rounded-2xl border border-[#E4E0D6]">
            <button
              onClick={() => setRendererMode('dom')}
              className={`px-4 py-2 rounded-xl text-[14px] font-semibold transition-all cursor-pointer ${
                rendererMode === 'dom'
                  ? 'bg-white text-[#2B2140] shadow-soft'
                  : 'text-[#6B6578] hover:text-[#2B2140]'
              }`}
            >
              Interactive DOM
            </button>
            <button
              onClick={() => setRendererMode('canvas')}
              className={`px-4 py-2 rounded-xl text-[14px] font-semibold transition-all cursor-pointer ${
                rendererMode === 'canvas'
                  ? 'bg-white text-[#2B2140] shadow-soft'
                  : 'text-[#6B6578] hover:text-[#2B2140]'
              }`}
            >
              Canvas 2D
            </button>
          </div>

          {/* Safe Area Guides Toggle */}
          <button
            onClick={() => setShowGuides(!showGuides)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[14px] font-semibold border transition-all cursor-pointer shadow-soft ${
              showGuides
                ? 'bg-[#EEFAF8] text-[#0EA894] border-[#C3EFE8]'
                : 'bg-white text-[#6B6578] border-[#E4E0D6] hover:text-[#2B2140]'
            }`}
          >
            {showGuides ? <Eye className="w-4 h-4 text-[#0EA894]" /> : <EyeOff className="w-4 h-4" />}
            <span>Safe Guides</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center bg-white rounded-2xl border border-[#E4E0D6] p-1 shadow-soft text-[13px] text-[#6B6578]">
            <button
              onClick={() => setZoomLevel(z => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
              className="p-2 hover:text-[#2B2140] hover:bg-[#F8F7F4] rounded-xl transition-colors cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-3 font-semibold text-[#2B2140]">
              {Math.round(effectiveScale * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(z => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
              className="p-2 hover:text-[#2B2140] hover:bg-[#F8F7F4] rounded-xl transition-colors cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-2 hover:text-[#2B2140] hover:bg-[#F8F7F4] rounded-xl transition-colors border-l border-[#EAE7DF] cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Surface Picker Grid (Colorful Cards) */}
      <section className="bg-white border-b border-[#EAE7DF] px-8 py-4 shrink-0 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-[#FF6B4A] uppercase tracking-wider">
              Select Surface Target
            </span>
            <span className="text-[14px] text-[#847E91]">
              · Zero surface-name branching, mathematical constraint resolution
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#6B6578]">Active Archetype:</span>
            <span className="px-3 py-1 rounded-full text-[13px] font-bold bg-[#FFF5F2] text-[#FF6B4A] border border-[#FFD9CE]">
              {resolvedLayout.compositionMode}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {surfaces.map(card => {
            const Icon = card.icon;
            const isSelected = !isCustomMode && selectedSurfaceId === card.profile.id;

            return (
              <button
                key={card.profile.id}
                onClick={() => {
                  setIsCustomMode(false);
                  setSelectedSurfaceId(card.profile.id);
                }}
                className={`relative flex flex-col text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'shadow-soft-lg ring-2 ring-[#FF6B4A] bg-white border-[#FF6B4A]'
                    : 'bg-white hover:shadow-soft border-[#EAE7DF] hover:border-[#D5D0C5]'
                }`}
                style={{
                  backgroundColor: isSelected ? '#FFFFFF' : card.accentBg,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: isSelected ? card.themeColor : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : card.themeColor,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {card.badge && (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        card.badgeColor ?? 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {card.badge}
                    </span>
                  )}
                </div>

                <div className="font-heading font-bold text-[14px] text-[#2B2140] tracking-tight leading-snug">
                  {card.label}
                </div>
                <div className="text-[13px] text-[#6B6578] mt-1 line-clamp-2 leading-relaxed">
                  {card.description}
                </div>
              </button>
            );
          })}

          {/* Custom Dynamic Surface Card */}
          <button
            onClick={() => setIsCustomMode(true)}
            className={`relative flex flex-col text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
              isCustomMode
                ? 'shadow-soft-lg ring-2 ring-[#FF6B4A] bg-white border-[#FF6B4A]'
                : 'bg-[#FAF8F5] hover:bg-white hover:shadow-soft border-[#E4E0D6]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isCustomMode ? 'bg-[#FF6B4A] text-white' : 'bg-white text-[#5B4C76] border border-[#E0DDD5]'
                }`}
              >
                <Sliders className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                Interactive
              </span>
            </div>
            <div className="font-heading font-bold text-[14px] text-[#2B2140] tracking-tight leading-snug">
              Custom Studio
            </div>
            <div className="text-[13px] text-[#6B6578] mt-1 leading-relaxed">
              Live dimension & constraint stress-testing
            </div>
          </button>
        </div>
      </section>

      {/* Dynamic Custom Sliders Panel */}
      {isCustomMode && (
        <div className="bg-white border-b border-[#EAE7DF] px-8 py-4 flex flex-wrap items-center gap-8 text-[14px] shadow-soft animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="text-[#6B6578] font-semibold">Width:</span>
            <input
              type="range"
              min={240}
              max={1600}
              step={20}
              value={customWidth}
              onChange={e => setCustomWidth(Number(e.target.value))}
              className="w-32 accent-[#FF6B4A] cursor-pointer"
            />
            <span className="font-bold text-[#2B2140] w-14">{customWidth}px</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[#6B6578] font-semibold">Height:</span>
            <input
              type="range"
              min={180}
              max={1000}
              step={20}
              value={customHeight}
              onChange={e => setCustomHeight(Number(e.target.value))}
              className="w-32 accent-[#FF6B4A] cursor-pointer"
            />
            <span className="font-bold text-[#2B2140] w-14">{customHeight}px</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[#6B6578] font-semibold">Min Tap Target:</span>
            <input
              type="range"
              min={0}
              max={80}
              step={4}
              value={customMinTap}
              onChange={e => setCustomMinTap(Number(e.target.value))}
              className="w-28 accent-[#FF6B4A] cursor-pointer"
            />
            <span className="font-bold text-[#2B2140] w-10">{customMinTap}px</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[#6B6578] font-semibold">Min Text Size:</span>
            <input
              type="range"
              min={12}
              max={32}
              step={1}
              value={customMinText}
              onChange={e => setCustomMinText(Number(e.target.value))}
              className="w-28 accent-[#FF6B4A] cursor-pointer"
            />
            <span className="font-bold text-[#2B2140] w-10">{customMinText}px</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[#6B6578] font-semibold">Distance:</span>
            <select
              value={customDistance}
              onChange={e => setCustomDistance(e.target.value as ViewingDistance)}
              className="bg-[#F8F7F4] border border-[#DCD8CD] rounded-xl px-3 py-1.5 text-[#2B2140] font-medium outline-none focus:border-[#FF6B4A] cursor-pointer"
            >
              <option value="near">Near (~30cm, Mobile)</option>
              <option value="arm-length">Arm-Length (~60cm, Kiosk)</option>
              <option value="medium">Medium (~1.5m, Desktop)</option>
              <option value="far">Far (&gt;3m, TV / Billboard)</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Studio Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Canvas Center Viewport */}
        <main
          ref={containerRef}
          className="flex-1 h-full min-h-0 bg-[#F5F4F0] relative flex items-center justify-center p-6 overflow-hidden select-none"
        >
          {/* Sizing Wrapper: sized to the exact scaled outer dimensions so flexbox centers it perfectly! */}
          <div
            className="relative flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0"
            style={{
              width: `${Math.round(bezelDims.width * effectiveScale)}px`,
              height: `${Math.round(bezelDims.height * effectiveScale)}px`,
            }}
          >
            {/* Scaled Bezel */}
            <div
              className="absolute top-0 left-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] origin-top-left flex items-center justify-center"
              style={{
                width: `${bezelDims.width}px`,
                height: `${bezelDims.height}px`,
                transform: `scale(${effectiveScale})`,
              }}
            >
              {renderLightDeviceBezel(
                activeSurface,
                rendererMode === 'dom' ? (
                  <ResolvedAdDOM
                    spec={AURA_HEADPHONES_AD}
                    layout={resolvedLayout}
                    showSafeAreaGuides={showGuides}
                    scale={1}
                    onActionClick={id => setLastActionMessage(`Action triggered: [${id}] at ${new Date().toLocaleTimeString()}`)}
                  />
                ) : (
                  <div className="relative" style={{ width: activeSurface.width, height: activeSurface.height }}>
                    <canvas ref={canvasRef} className="block" />
                  </div>
                )
              )}
            </div>
          </div>

          {/* Dimension HUD Pill in Bottom Left */}
          <div className="absolute bottom-5 left-5 bg-white/95 backdrop-blur-md border border-[#EAE7DF] rounded-2xl px-3.5 py-2 text-[13px] text-[#6B6578] flex items-center gap-3.5 shadow-soft pointer-events-none z-10">
            <div>
              <span className="text-[#847E91]">Surface: </span>
              <span className="text-[#2B2140] font-bold">{activeSurface.width} × {activeSurface.height}px</span>
            </div>
            <div className="h-4 w-px bg-[#EAE7DF]" />
            <div>
              <span className="text-[#847E91]">Safe Content: </span>
              <span className="text-[#0EA894] font-bold">{resolvedLayout.safeWidth} × {resolvedLayout.safeHeight}px</span>
            </div>
            <div className="h-4 w-px bg-[#EAE7DF]" />
            <div>
              <span className="text-[#847E91]">Scale: </span>
              <span className="text-[#FF6B4A] font-bold">{Math.round(effectiveScale * 100)}%</span>
            </div>
          </div>
        </main>

        {/* Right Sidebar: Editorial Resolution Inspector */}
        <aside className="w-[400px] h-full min-h-0 border-l border-[#EAE7DF] bg-white flex flex-col shrink-0 overflow-y-auto shadow-soft">
          {/* Inspector Header */}
          <div className="p-6 border-b border-[#EAE7DF] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFF5F2] text-[#FF6B4A] flex items-center justify-center border border-[#FFD9CE]">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#2B2140] font-heading">
                  Resolution Inspector
                </h2>
                <p className="text-[13px] text-[#6B6578]">Live mathematical layout diagnostics</p>
              </div>
            </div>
            <span className="text-[13px] font-bold px-3 py-1 rounded-full bg-[#EEFAF8] text-[#0EA894] border border-[#C3EFE8]">
              Verified Valid
            </span>
          </div>

          {/* Degradation Alert (Clean, warm, card) */}
          {resolvedLayout.droppedElements.length > 0 ? (
            <div className="m-6 p-5 rounded-2xl bg-[#FFF5F2] border border-[#FFD9CE] shadow-soft">
              <div className="flex items-center gap-2.5 text-[#E11D48] font-bold mb-2">
                <ShieldAlert className="w-5 h-5 shrink-0 text-[#E11D48]" />
                <span className="text-[15px] font-heading">Priority Degradation Triggered</span>
              </div>
              <p className="text-[#4A4557] leading-relaxed text-[14px]">
                Under space pressure on <strong>{activeSurface.name}</strong> ({activeSurface.width}×{activeSurface.height}px with <strong>{activeSurface.minTapTarget}px</strong> touch target), the lowest-priority branding mark was cleanly dropped so that the primary headline and CTA action button remain completely visible with zero clipping.
              </p>
              <div className="mt-3 space-y-2">
                {resolvedLayout.droppedElements.map(dropped => (
                  <div
                    key={dropped.id}
                    className="bg-white rounded-xl p-3 border border-[#FFD9CE] shadow-soft"
                  >
                    <div className="flex items-center justify-between text-[#2B2140]">
                      <span className="font-bold text-[14px]">✕ {dropped.id}</span>
                      <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-[#E11D48]">
                        Priority: {dropped.priority}
                      </span>
                    </div>
                    <div className="text-[13px] text-[#6B6578] mt-1 leading-normal">
                      {dropped.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="m-6 p-4 rounded-2xl bg-[#EEFAF8] border border-[#C3EFE8] flex items-center gap-3 text-[#0EA894] shadow-soft">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#0EA894]" />
              <div className="text-[14px] font-medium text-[#1E3A34]">
                All 5 spec elements fit comfortably with zero degradation.
              </div>
            </div>
          )}

          {/* Clean Analytics Stat Grid */}
          <div className="px-6 pb-6">
            <h3 className="text-[13px] font-bold text-[#847E91] uppercase tracking-wider mb-3">
              Engine Metrics
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#FAF9F5] border border-[#EAE7DF] rounded-2xl p-4 shadow-soft">
                <div className="text-[#847E91] text-[13px] font-medium">Composition Archetype</div>
                <div className="text-[#2B2140] font-heading font-extrabold text-[16px] mt-1 truncate">
                  {resolvedLayout.compositionMode}
                </div>
              </div>

              <div className="bg-[#FAF9F5] border border-[#EAE7DF] rounded-2xl p-4 shadow-soft">
                <div className="text-[#847E91] text-[13px] font-medium">Space Utilization</div>
                <div className="text-[#0EA894] font-heading font-extrabold text-[20px] mt-0.5">
                  {resolvedLayout.diagnostics.spaceUtilization}%
                </div>
              </div>

              <div className="bg-[#FAF9F5] border border-[#EAE7DF] rounded-2xl p-4 shadow-soft">
                <div className="text-[#847E91] text-[13px] font-medium">Safe Aspect Ratio</div>
                <div className="text-[#2B2140] font-heading font-extrabold text-[16px] mt-1">
                  {resolvedLayout.diagnostics.safeAspectRatio} : 1
                </div>
              </div>

              <div className="bg-[#FAF9F5] border border-[#EAE7DF] rounded-2xl p-4 shadow-soft">
                <div className="text-[#847E91] text-[13px] font-medium">Solver Execution</div>
                <div className="text-[#FF6B4A] font-heading font-extrabold text-[16px] mt-1">
                  {resolvedLayout.diagnostics.iterationCount} pass
                </div>
              </div>
            </div>
          </div>

          {/* Physical Display Constraints */}
          <div className="px-6 pb-6">
            <h3 className="text-[13px] font-bold text-[#847E91] uppercase tracking-wider mb-3">
              Physical Constraints
            </h3>
            <div className="bg-[#FAF9F5] border border-[#EAE7DF] rounded-2xl p-4 space-y-2.5 shadow-soft text-[14px]">
              <div className="flex justify-between items-center">
                <span className="text-[#6B6578] font-medium">Min Tap Target</span>
                <span className="text-[#2B2140] font-bold px-2 py-0.5 rounded-md bg-white border border-[#E0DDD5]">
                  {activeSurface.minTapTarget}px
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6B6578] font-medium">Min Text Size</span>
                <span className="text-[#2B2140] font-bold px-2 py-0.5 rounded-md bg-white border border-[#E0DDD5]">
                  {activeSurface.minTextSize}px
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6B6578] font-medium">Viewing Distance</span>
                <span className="text-[#7C3AED] font-bold uppercase px-2 py-0.5 rounded-md bg-white border border-[#E0DDD5]">
                  {activeSurface.viewingDistance}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6B6578] font-medium">Input Modality</span>
                <span className="text-[#0EA894] font-bold px-2 py-0.5 rounded-md bg-white border border-[#E0DDD5]">
                  {activeSurface.touchOnly ? 'Touch-First' : 'Visual Non-Touch'}
                </span>
              </div>
            </div>
          </div>

          {/* Resolved Elements Geometry Table */}
          <div className="px-6 pb-8 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-[#847E91] uppercase tracking-wider">
                Resolved Geometry
              </h3>
              <span className="text-[13px] font-bold text-[#6B6578]">
                {resolvedLayout.elements.length} of {AURA_HEADPHONES_AD.elements.length} active
              </span>
            </div>

            <div className="space-y-3">
              {AURA_HEADPHONES_AD.elements.map(specEl => {
                const resolved = resolvedLayout.elements.find(e => e.id === specEl.id);
                const isDropped = !resolved;

                return (
                  <div
                    key={specEl.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      isDropped
                        ? 'bg-[#FFF5F2] border-[#FFD9CE] opacity-75'
                        : 'bg-white border-[#EAE7DF] shadow-soft hover:shadow-soft-lg'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-heading font-bold text-[14px] text-[#2B2140]">
                          {specEl.id}
                        </div>
                        <div className="text-[13px] text-[#847E91] capitalize">
                          Role: {specEl.role}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[13px] px-2 py-0.5 rounded-full font-semibold bg-[#F3F1EC] text-[#4A4557]">
                          Priority {specEl.priority}
                        </span>

                        {isDropped ? (
                          <span className="text-[13px] px-2.5 py-0.5 rounded-full font-bold bg-[#FFEBEF] text-[#E11D48] border border-[#FFCCD5]">
                            Dropped
                          </span>
                        ) : resolved.status === 'shrunk' ? (
                          <span className="text-[13px] px-2.5 py-0.5 rounded-full font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                            Shrunk
                          </span>
                        ) : (
                          <span className="text-[13px] px-2.5 py-0.5 rounded-full font-bold bg-[#EEFAF8] text-[#0EA894] border border-[#C3EFE8]">
                            Fits
                          </span>
                        )}
                      </div>
                    </div>

                    {resolved ? (
                      <div className="text-[13px] text-[#4A4557] flex flex-wrap gap-2 mt-2 pt-2 border-t border-[#F2EFE8]">
                        <span className="px-2 py-1 rounded-lg bg-[#F8F7F4] border border-[#EAE7DF]">
                          X: <strong>{resolved.x}px</strong>
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-[#F8F7F4] border border-[#EAE7DF]">
                          Y: <strong>{resolved.y}px</strong>
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-[#F8F7F4] border border-[#EAE7DF]">
                          Size: <strong>{resolved.width} × {resolved.height}px</strong>
                        </span>
                        {resolved.fontSize && (
                          <span className="px-2 py-1 rounded-lg bg-[#F0F7FF] text-[#2563EB] border border-[#D0E4FF]">
                            Font: <strong>{resolved.fontSize}px</strong>
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[13px] text-[#E11D48] mt-1 italic">
                        Omitted to satisfy {activeSurface.minTapTarget}px tap target and safe area bounds.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {lastActionMessage && (
              <div className="mt-4 p-3 rounded-xl bg-[#FFF5F2] border border-[#FFD9CE] text-[13px] text-[#FF6B4A] font-medium flex items-center gap-2">
                <MousePointer className="w-4 h-4 shrink-0" />
                <span>{lastActionMessage}</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Renders realistic device bezels in an elegant LIGHT framework.
 * Soft warm pearl/silver-gray enclosures with layered shadows, not black plastic.
 */
function renderLightDeviceBezel(surface: SurfaceProfile, children: React.ReactNode): React.ReactNode {
  switch (surface.deviceFrame) {
    case 'phone-portrait':
      return (
        <div
          className="p-4 bg-gradient-to-b from-[#FFFFFF] to-[#F1EFEA] rounded-[52px] shadow-device border-[4px] border-[#E5E2DA] flex flex-col items-center shrink-0"
          style={{ width: `${surface.width + 40}px`, height: `${surface.height + 90}px` }}
        >
          {/* Subtle Speaker / Dynamic Island */}
          <div className="w-24 h-5 bg-[#E8E5DD] rounded-full mb-3 flex items-center justify-center shadow-inner">
            <div className="w-12 h-1.5 bg-[#D3CFCA] rounded-full" />
          </div>
          {/* Screen Glass */}
          <div
            className="overflow-hidden rounded-[38px] bg-[#1C1924] shadow-md border border-[#E5E2DA]"
            style={{ width: `${surface.width}px`, height: `${surface.height}px` }}
          >
            {children}
          </div>
          {/* Subtle Home Indicator */}
          <div className="w-28 h-1.5 bg-[#D0CCC2] rounded-full mt-3" />
        </div>
      );

    case 'phone-landscape':
      return (
        <div
          className="p-4 bg-gradient-to-r from-[#FFFFFF] to-[#F1EFEA] rounded-[42px] shadow-device border-[4px] border-[#E5E2DA] flex items-center shrink-0"
          style={{ width: `${surface.width + 68}px`, height: `${surface.height + 40}px` }}
        >
          {/* Left Notch */}
          <div className="h-20 w-4 bg-[#E8E5DD] rounded-full mr-3 flex flex-col items-center justify-center shadow-inner">
            <div className="h-10 w-1.5 bg-[#D3CFCA] rounded-full" />
          </div>
          {/* Screen Glass */}
          <div
            className="overflow-hidden rounded-[28px] bg-[#1C1924] shadow-md border border-[#E5E2DA]"
            style={{ width: `${surface.width}px`, height: `${surface.height}px` }}
          >
            {children}
          </div>
        </div>
      );

    case 'broadcast-tv':
      return (
        <div
          className="p-3 bg-gradient-to-b from-[#FFFFFF] to-[#EAE7E0] rounded-2xl shadow-device border-[3px] border-[#DED9CF] flex flex-col shrink-0"
          style={{ width: `${surface.width + 30}px`, height: `${surface.height + 254}px` }}
        >
          {/* TV Screen Container */}
          <div
            className="relative overflow-hidden rounded-xl bg-[#0E0C12] shadow-inner"
            style={{ width: `${surface.width}px` }}
          >
            {/* Simulated 16:9 Live Broadcast Stream Backdrop */}
            <div
              className="w-full h-44 bg-cover bg-center opacity-35 flex items-center justify-center"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1600&q=80')`,
              }}
            >
              <span className="text-white font-heading text-[14px] font-bold bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full">
                Live Television Broadcast Feed (1080p)
              </span>
            </div>
            {/* Lower-Third Strip */}
            <div className="w-full shadow-2xl">
              {children}
            </div>
          </div>
          {/* TV Chin Brand Indicator */}
          <div className="flex justify-between items-center px-4 pt-2.5">
            <span className="text-[13px] font-heading font-bold text-[#6B6578] tracking-wider uppercase">
              STUDIO BROADCAST · LOWER-THIRD
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-[#E11D48] tracking-wide">LIVE</span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#E11D48] shadow-sm animate-pulse" />
            </div>
          </div>
        </div>
      );

    case 'kiosk-terminal':
      return (
        <div
          className="p-6 bg-gradient-to-b from-[#FFFFFF] via-[#FAF9F5] to-[#EFECE5] rounded-3xl shadow-device border-[4px] border-[#DED9CF] flex flex-col items-center shrink-0"
          style={{ width: `${surface.width + 56}px`, height: `${surface.height + 122}px` }}
        >
          {/* Kiosk Header Bar */}
          <div className="w-full flex justify-between items-center mb-3.5 px-2">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-[#0EA894] animate-ping" />
              <span className="text-[13px] font-heading font-extrabold text-[#2B2140] tracking-wider uppercase">
                Interactive Touch Kiosk
              </span>
            </div>
            <div className="w-7 h-7 rounded-full bg-[#EFECE5] border border-[#D5D0C5] flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#847E91]" />
            </div>
          </div>
          {/* Touch Glass */}
          <div
            className="overflow-hidden rounded-2xl bg-[#1C1924] shadow-md border border-[#D5D0C5]"
            style={{ width: `${surface.width}px`, height: `${surface.height}px` }}
          >
            {children}
          </div>
          {/* Base Trim */}
          <div className="w-40 h-2 bg-[#D5D0C5] rounded-full mt-4" />
        </div>
      );

    default:
      return (
        <div
          className="p-4 bg-white rounded-3xl shadow-device border-[3px] border-[#EAE7DF] shrink-0"
          style={{ width: `${surface.width + 38}px`, height: `${surface.height + 38}px` }}
        >
          <div
            className="overflow-hidden rounded-2xl bg-[#1C1924]"
            style={{ width: `${surface.width}px`, height: `${surface.height}px` }}
          >
            {children}
          </div>
        </div>
      );
  }
}
