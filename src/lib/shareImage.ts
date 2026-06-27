import type { ShareExerciseView, ShareModel } from '../domain/share';

/**
 * Renders a ShareModel to a PNG image on a canvas. This is the browser-only
 * counterpart to the pure `buildShareModel` — it lives outside `domain/`
 * because it touches the DOM/canvas.
 */

// Palette mirrors the app theme in src/index.css.
const C = {
  bg: '#0f172a',
  bgTop: '#1e293b',
  card: '#1e293b',
  border: '#334155',
  text: '#f1f5f9',
  dim: '#94a3b8',
  accent: '#3b82f6',
  success: '#22c55e',
  danger: '#ef4444',
  chipBg: '#0f172a',
} as const;

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

// Layout constants (logical px; the canvas is scaled up for crispness).
const W = 1080;
const PAD = 72;
const HEADER_H = 300;
const EX_GAP = 28;
const EX_PAD = 32;
const EX_HEAD_H = 78;
const CHIP = 76;
const CHIP_GAP = 16;
const CHIP_BLOCK_H = CHIP + 28;
const FOOTER_H = 110;
const SCALE = 2;

function exerciseHeight(_ex: ShareExerciseView): number {
  return EX_PAD + EX_HEAD_H + CHIP_BLOCK_H + EX_PAD;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawHeader(ctx: CanvasRenderingContext2D, model: ShareModel): void {
  // Subtle gradient band behind the header.
  const grad = ctx.createLinearGradient(0, 0, 0, HEADER_H);
  grad.addColorStop(0, C.bgTop);
  grad.addColorStop(1, C.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HEADER_H);

  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = C.accent;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText('FIVEBYFIVE', PAD, 92);

  ctx.fillStyle = C.text;
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText(model.title, PAD, 188);

  ctx.fillStyle = C.dim;
  ctx.font = `400 36px ${FONT}`;
  ctx.fillText(`${model.dateText} · ${model.timeText}`, PAD, 244);
}

function drawExercise(
  ctx: CanvasRenderingContext2D,
  ex: ShareExerciseView,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = C.card;
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 24);
  ctx.fill();
  ctx.stroke();

  const innerX = x + EX_PAD;
  let cursor = y + EX_PAD;

  // Name + status dot.
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.text;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(ex.name, innerX, cursor);

  const dotColor = ex.succeeded ? C.success : C.danger;
  const dotR = 14;
  const dotCx = x + w - EX_PAD - dotR;
  const dotCy = cursor + 24;
  ctx.beginPath();
  ctx.fillStyle = dotColor;
  ctx.arc(dotCx, dotCy, dotR, 0, Math.PI * 2);
  ctx.fill();

  // Weight, right-aligned under the dot.
  ctx.fillStyle = C.dim;
  ctx.font = `600 40px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(ex.weight, x + w - EX_PAD, cursor + 52);
  ctx.textAlign = 'left';

  cursor += EX_HEAD_H;

  // Rep chips.
  let chipX = innerX;
  const chipY = cursor + 8;
  for (const set of ex.sets) {
    ctx.fillStyle = C.chipBg;
    ctx.strokeStyle = set.hit ? C.success : C.danger;
    ctx.lineWidth = 3;
    roundRect(ctx, chipX, chipY, CHIP, CHIP, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = set.hit ? C.success : C.danger;
    ctx.font = `700 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(set.reps), chipX + CHIP / 2, chipY + CHIP / 2 + 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    chipX += CHIP + CHIP_GAP;
  }
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  model: ShareModel,
  y: number,
): void {
  ctx.textBaseline = 'middle';
  ctx.fillStyle = model.allSucceeded ? C.success : C.dim;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(model.summaryText, PAD, y + FOOTER_H / 2);

  ctx.fillStyle = C.dim;
  ctx.font = `400 30px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('Tracked with FiveByFive', W - PAD, y + FOOTER_H / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Draw `model` onto a freshly created canvas and return it. */
export function renderShareCanvas(model: ShareModel): HTMLCanvasElement {
  const exHeights = model.exercises.map(exerciseHeight);
  const exTotal = exHeights.reduce((a, b) => a + b, 0) + EX_GAP * model.exercises.length;
  const height = HEADER_H + exTotal + FOOTER_H + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = height * SCALE;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(SCALE, SCALE);

  // Background.
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, height);

  drawHeader(ctx, model);

  let y = HEADER_H;
  model.exercises.forEach((ex, i) => {
    drawExercise(ctx, ex, PAD, y, W - PAD * 2, exHeights[i]);
    y += exHeights[i] + EX_GAP;
  });

  drawFooter(ctx, model, y);

  return canvas;
}

/** Render `model` to a PNG Blob. */
export function renderShareImage(model: ShareModel): Promise<Blob> {
  const canvas = renderShareCanvas(model);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      'image/png',
    );
  });
}
