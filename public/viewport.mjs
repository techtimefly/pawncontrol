export const DESIGN_WIDTH = 2560;
export const DESIGN_HEIGHT = 1440;

// Presentation only: never change logical dimensions or playback state.
export function containViewport(width, height, dimensions = {width: DESIGN_WIDTH, height: DESIGN_HEIGHT}) {
  width = Number.isFinite(width) ? Math.max(0, width) : 0;
  height = Number.isFinite(height) ? Math.max(0, height) : 0;
  const scale = Math.min(width / dimensions.width, height / dimensions.height);
  return { width, height, scale, x: (width - dimensions.width * scale) / 2, y: (height - dimensions.height * scale) / 2 };
}

export function fitCanvas(canvas, width, height, dimensions) {
  const fit = containViewport(width, height, dimensions);
  canvas.style.transformOrigin = '0 0';
  canvas.style.transform = `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`;
  return fit;
}

export function observeViewport(canvas, viewport = window, dimensions) {
  const resize = () => fitCanvas(canvas, viewport.innerWidth, viewport.innerHeight, dimensions);
  viewport.addEventListener('resize', resize);
  resize();
  return () => viewport.removeEventListener('resize', resize);
}
