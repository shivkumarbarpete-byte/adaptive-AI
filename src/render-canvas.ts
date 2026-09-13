/**
 * Adaptive Layout Engine - Canvas Rendering Backend (Stretch Goal)
 *
 * Demonstrates backend agnosticism:
 * Consumes the exact same ResolvedLayout data structure and renders to an HTML5 Canvas context
 * without changing a single line of resolver.ts or spec.ts!
 */

import type { AdSpec, ButtonElementSpec, ImageElementSpec, TextElementSpec } from './spec';
import type { ResolvedLayout } from './resolver';

// Image asset cache to prevent blinking during rapid canvas redraws
const imageCache = new Map<string, HTMLImageElement>();

export function renderToCanvas(
  canvas: HTMLCanvasElement,
  spec: AdSpec,
  layout: ResolvedLayout,
  options: { showSafeAreaGuides?: boolean } = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { canvasWidth, canvasHeight, safeArea, elements } = layout;
  const theme = spec.theme ?? {};

  // High DPI scaling support
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvasWidth * dpr;
  canvas.height = canvasHeight * dpr;
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  ctx.scale(dpr, dpr);

  // Clear canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 1. Background Fill
  ctx.fillStyle = theme.backgroundColor ?? '#0F111A';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Subtle ambient radial glow
  const grad = ctx.createRadialGradient(
    canvasWidth * 0.75, canvasHeight * 0.25, 10,
    canvasWidth * 0.75, canvasHeight * 0.25, canvasWidth * 0.8
  );
  grad.addColorStop(0, 'rgba(255, 107, 74, 0.28)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Safe Area Inset Guides
  if (options.showSafeAreaGuides) {
    ctx.strokeStyle = 'rgba(14, 168, 148, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      safeArea.left,
      safeArea.top,
      canvasWidth - safeArea.left - safeArea.right,
      canvasHeight - safeArea.top - safeArea.bottom
    );
    ctx.setLineDash([]);

    ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#0EA894';
    ctx.fillText(
      `Safe Margin (${safeArea.top}t · ${safeArea.right}r · ${safeArea.bottom}b · ${safeArea.left}l)`,
      safeArea.left + 8,
      safeArea.top + 18
    );
  }

  // Map elements
  const specMap = new Map(spec.elements.map(e => [e.id, e]));

  // 3. Render Each Resolved Element
  for (const box of elements) {
    const item = specMap.get(box.id);
    if (!item) continue;

    switch (item.type) {
      case 'image': {
        const imgSpec = item as ImageElementSpec;
        let img = imageCache.get(imgSpec.src);
        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = imgSpec.src;
          img.onload = () => {
            renderToCanvas(canvas, spec, layout, options);
          };
          imageCache.set(imgSpec.src, img);
        } else if (img.complete && img.naturalWidth > 0) {
          ctx.save();
          // Draw rounded clipping rect
          drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 12);
          ctx.clip();
          ctx.drawImage(img, box.x, box.y, box.width, box.height);
          ctx.restore();

          // Border overlay
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
          drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 12);
          ctx.stroke();
        }
        break;
      }

      case 'button': {
        const btnSpec = item as ButtonElementSpec;
        // Button background
        ctx.fillStyle = theme.primaryColor ?? '#FF6B4A';
        drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 16);
        ctx.fill();

        // Button border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 16);
        ctx.stroke();

        // Button label
        const fontSize = Math.max(14, box.fontSize ?? 16);
        ctx.fillStyle = theme.buttonTextColor ?? '#FFFFFF';
        ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `${btnSpec.label} →`,
          box.x + box.width / 2,
          box.y + box.height / 2
        );
        break;
      }

      case 'text': {
        const txtSpec = item as TextElementSpec;
        const fontSize = Math.max(13, box.fontSize ?? txtSpec.idealFontSize ?? 16);

        if (txtSpec.role === 'branding') {
          // Brand badge
          ctx.fillStyle = 'rgba(245, 183, 0, 0.2)';
          drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 8);
          ctx.fill();
          ctx.strokeStyle = 'rgba(245, 183, 0, 0.45)';
          ctx.stroke();

          ctx.fillStyle = '#FCD34D';
          ctx.font = `800 ${Math.max(13, fontSize)}px "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`✦ ${txtSpec.text}`, box.x + box.width / 2, box.y + box.height / 2);
        } else if (txtSpec.variant === 'price') {
          // Price badge
          ctx.fillStyle = 'rgba(14, 168, 148, 0.2)';
          drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 12);
          ctx.fill();
          ctx.strokeStyle = 'rgba(14, 168, 148, 0.4)';
          ctx.stroke();

          ctx.fillStyle = '#5EEAD4';
          ctx.font = `700 ${Math.max(14, fontSize)}px "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(txtSpec.text, box.x + box.width / 2, box.y + box.height / 2);
        } else if (txtSpec.variant === 'headline' || txtSpec.role === 'primary') {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `800 ${fontSize}px "Sora", "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          wrapCanvasText(ctx, txtSpec.text, box.x, box.y, box.width, fontSize * 1.25);
        } else {
          ctx.fillStyle = '#E5E2EC';
          ctx.font = `500 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          wrapCanvasText(ctx, txtSpec.text, box.x, box.y, box.width, fontSize * 1.3);
        }
        break;
      }
    }
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}
