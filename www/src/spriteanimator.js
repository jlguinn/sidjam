// Embedded settings JSON for the flame animation
const FLAME_SETTINGS = {
  "frames": [
    { "x": 0, "y": 0, "width": 261, "height": 330, "offsetX": -10, "offsetY": 0 },
    { "x": 261, "y": 0, "width": 261, "height": 330, "offsetX": 3, "offsetY": 0 },
    { "x": 522, "y": 0, "width": 261, "height": 330, "offsetX": 21, "offsetY": -5 },
    { "x": 0, "y": 330, "width": 261, "height": 330, "offsetX": 1, "offsetY": 0 },
    { "x": 261, "y": 330, "width": 261, "height": 330, "offsetX": 8, "offsetY": 0 },
    { "x": 522, "y": 330, "width": 261, "height": 330, "offsetX": 22, "offsetY": 0 }
  ],
  "globalOffsetX": -7,
  "globalOffsetY": 6,
  "delayMs": 228,
  "loop": true
};

// Hardcoded sprite sheet path
const SPRITE_SHEET_PATH = '/image/flame-sprite.png';

// Scaling factor to match thumbnail size (~48x60 pixels)
const SCALE_FACTOR = 48 / 261; // Scales 261px width to 48px, preserving aspect ratio

// Preloaded sprite sheet image
let spriteSheet = null;

// Preload the sprite sheet
function preloadSpriteSheet() {
  spriteSheet = new Image();
  spriteSheet.src = SPRITE_SHEET_PATH;
  spriteSheet.onerror = () => {
    window.logmsg(`Failed to load sprite sheet: ${SPRITE_SHEET_PATH}`, 2);
  };
}

// Animation state
let animationFrameId = null;
let currentFrame = 0;
let lastFrameTime = 0;

// Render the sprite sheet animation
export function renderSpriteAnimation(targetElement, isActive) {
  if (!spriteSheet || !spriteSheet.complete || spriteSheet.naturalWidth === 0) {
    window.logmsg('Sprite sheet not loaded, skipping animation', 2);
    return;
  }

  // Remove any existing canvas
  const existingCanvas = targetElement.querySelector('canvas');
  if (existingCanvas) {
    existingCanvas.remove();
  }

  // Stop any running animation
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (!isActive) {
    // Clear the canvas and let CSS handle the static image
    targetElement.style.backgroundImage = ''; // Ensure canvas is primary when active
    return;
  }

  // Create a canvas to match the scaled size
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const scaledWidth = FLAME_SETTINGS.frames[0].width * SCALE_FACTOR;
  const scaledHeight = FLAME_SETTINGS.frames[0].height * SCALE_FACTOR;
  canvas.width = scaledWidth;
  canvas.height = scaledHeight;
  canvas.style.width = `${scaledWidth}px`;
  canvas.style.height = `${scaledHeight}px`;
  targetElement.appendChild(canvas);

  // Animation loop
  function animate() {
    const now = performance.now();
    if (now - lastFrameTime >= FLAME_SETTINGS.delayMs) {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw current frame
      const frame = FLAME_SETTINGS.frames[currentFrame];
      const scaledOffsetX = (frame.offsetX + FLAME_SETTINGS.globalOffsetX) * SCALE_FACTOR;
      const scaledOffsetY = (frame.offsetY + FLAME_SETTINGS.globalOffsetY) * SCALE_FACTOR;
      ctx.drawImage(
        spriteSheet,
        frame.x, frame.y, frame.width, frame.height,
        scaledOffsetX, scaledOffsetY, frame.width * SCALE_FACTOR, frame.height * SCALE_FACTOR
      );

      // Advance frame
      currentFrame = (currentFrame + 1) % FLAME_SETTINGS.frames.length;
      if (!FLAME_SETTINGS.loop && currentFrame === 0) {
        cancelAnimationFrame(animationFrameId);
        return;
      }
      lastFrameTime = now;
    }
    animationFrameId = requestAnimationFrame(animate);
  }

  // Start animation
  lastFrameTime = performance.now();
  animate();
}

// Initialize sprite sheet loading
preloadSpriteSheet();