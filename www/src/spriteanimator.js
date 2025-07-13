// Configuration map for animations
const ANIMATION_CONFIGS = {
  flame: {
    spriteSheetPath: '../image/bomb_fuse_sheet.png',
    staticImagePath: '../image/bomb_at_rest.png',
    scaleFactor:  0.55, //   128 / 235,
  "frames": [
    {
      "x": 0, 
      "y": 0,
      "width": 235,
      "height": 203,
      "offsetX": -22,
      "offsetY": -5
    },
    {
      "x": 235,
      "y": 0,
      "width": 235,
      "height": 203,
      "offsetX": 7,
      "offsetY": -11
    },
    {
      "x": 0,
      "y": 203,
      "width": 235,
      "height": 203,
      "offsetX": -18,
      "offsetY": 11
    },
    {
      "x": 235,
      "y": 203,
      "width": 235,
      "height": 203,
      "offsetX": 15,
      "offsetY": 9
    }
  ],
  "globalOffsetX": -37,
  "globalOffsetY": -27,
  "delayMs": 225,
  "loop": true
  },
  boom: {
    spriteSheetPath: '../image/boom_sheet.png',
    staticImagePath: '../image/bomb_at_rest.png',
    scaleFactor:  0.55, 
    "frames": [
      {
        "x": 0,
        "y": 0,
        "width": 267,
        "height": 261,
        "offsetX": -22,
        "offsetY": 2
      },
      {
        "x": 267,
        "y": 0,
        "width": 267,
        "height": 261,
        "offsetX": -15,
        "offsetY": 5
      },
      {
        "x": 534,
        "y": 0,
        "width": 267,
        "height": 261,
        "offsetX": -4,
        "offsetY": 7
      },
      {
        "x": 801,
        "y": 0,
        "width": 267,
        "height": 261,
        "offsetX": 8,
        "offsetY": 7
      },
      {
        "x": 0,
        "y": 261,
        "width": 267,
        "height": 261,
        "offsetX": -24,
        "offsetY": 40
      },
      {
        "x": 267,
        "y": 261,
        "width": 267,
        "height": 261,
        "offsetX": -9,
        "offsetY": 41
      },
      {
        "x": 534,
        "y": 261,
        "width": 267,
        "height": 261,
        "offsetX": 11,
        "offsetY": 35
      },
      {
        "x": 801,
        "y": 261,
        "width": 267,
        "height": 261,
        "offsetX": 15,
        "offsetY": 41
      },
      {
        "x": 0,
        "y": 522,
        "width": 267,
        "height": 261,
        "offsetX": -17,
        "offsetY": 45
      },
      {
        "x": 267,
        "y": 522,
        "width": 267,
        "height": 261,
        "offsetX": 12,
        "offsetY": 36
      },
      {
        "x": 534,
        "y": 522,
        "width": 267,
        "height": 261,
        "offsetX": 10,
        "offsetY": 27
      },
      {
        "x": 801,
        "y": 522,
        "width": 267,
        "height": 261,
        "offsetX": 16,
        "offsetY": 29
      }
    ],
    "globalOffsetX": 0,
    "globalOffsetY": 0,
    "delayMs": 250,
    "loop": true
  },
  jam: {
    spriteSheetPath: '../image/jam-sprite.png',
    staticImagePath: '../image/jam-static.png',
    scaleFactor: 160 / 320, // Scales 320px width to 160px
    frames: [
      { x: 0, y: 0, width: 320, height: 238, offsetX: -6, offsetY: -1 },
      { x: 320, y: 0, width: 320, height: 238, offsetX: -1, offsetY: 0 },
      { x: 0, y: 238, width: 320, height: 238, offsetX: -6, offsetY: 3 },
      { x: 320, y: 238, width: 320, height: 238, offsetX: -2, offsetY: -1 }
    ],
    globalOffsetX: 0,
    globalOffsetY: 0,
    delayMs: 400,
    loop: true
  }
};

// Store preloaded sprite sheets
const spriteSheets = new Map();

// Store animation state per target element
const animationStates = new WeakMap();

// Preload sprite sheets for all animations
function preloadSpriteSheets() {
  Object.entries(ANIMATION_CONFIGS).forEach(([animationId, config]) => {
    const img = new Image();
    img.src = config.spriteSheetPath;
    img.onerror = () => {
      window.logmsg(`Failed to load sprite sheet for ${animationId}: ${config.spriteSheetPath}`, 1);
    };
    img.onload = () => {
      window.logmsg(`Sprite sheet for ${animationId} loaded successfully`, 1);
    };
    spriteSheets.set(animationId, img);
  });
}

// Render the sprite sheet animation
export function renderSpriteAnimation(targetElement, animationId, isActive) {
  // Validate animationId
  if (!ANIMATION_CONFIGS[animationId]) {
    window.logmsg(`Invalid animationId: ${animationId}`, 1);
    targetElement.style.backgroundImage = `url(${ANIMATION_CONFIGS.flame.staticImagePath})`;
    targetElement.style.backgroundSize = 'contain';
    targetElement.style.backgroundRepeat = 'no-repeat';
    targetElement.style.backgroundPosition = 'center';
    targetElement.style.backgroundColor = 'transparent';
    return;
  }

  const config = ANIMATION_CONFIGS[animationId];
  const spriteSheet = spriteSheets.get(animationId);

  // Fallback to static image if sprite sheet not loaded
  if (!spriteSheet || !spriteSheet.complete || spriteSheet.naturalWidth === 0) {
    window.logmsg(`Sprite sheet for ${animationId} not loaded, using static image`, 1);
    targetElement.style.backgroundImage = `url(${config.staticImagePath})`;
    targetElement.style.backgroundSize = 'contain';
    targetElement.style.backgroundRepeat = 'no-repeat';
    targetElement.style.backgroundPosition = 'center';
    targetElement.style.backgroundColor = 'transparent';
    return;
  }

  // Remove existing canvas
  const existingCanvas = targetElement.querySelector('canvas');
  if (existingCanvas) {
    existingCanvas.remove();
  }

  // Stop any running animation
  let state = animationStates.get(targetElement) || {};
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }

  if (!isActive) {
    // Set static image
    targetElement.style.backgroundImage = `url(${config.staticImagePath})`;
    targetElement.style.backgroundSize = 'contain';
    targetElement.style.backgroundRepeat = 'no-repeat';
    targetElement.style.backgroundPosition = 'center';
    targetElement.style.backgroundColor = 'transparent';
    animationStates.set(targetElement, { ...state, animationFrameId: null });
    return;
  }

  // Create canvas and context
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const scaledWidth = config.frames[0].width * config.scaleFactor;
  const scaledHeight = config.frames[0].height * config.scaleFactor;
  canvas.width = scaledWidth;
  canvas.height = scaledHeight;
  canvas.style.width = `${scaledWidth}px`;
  canvas.style.height = `${scaledHeight}px`;

  // Draw first frame immediately
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const frame = config.frames[0];
  const scaledOffsetX = (frame.offsetX + config.globalOffsetX) * config.scaleFactor;
  const scaledOffsetY = (frame.offsetY + config.globalOffsetY) * config.scaleFactor;
  ctx.drawImage(
    spriteSheet,
    frame.x, frame.y, frame.width, frame.height,
    scaledOffsetX, scaledOffsetY, frame.width * config.scaleFactor, frame.height * config.scaleFactor
  );

  // Clear background and append canvas
  targetElement.style.backgroundImage = 'none';
  targetElement.style.background = 'none';
  targetElement.style.backgroundColor = 'transparent';
  targetElement.appendChild(canvas);

  // Animation loop
  function animate() {
    const now = performance.now();
    if (now - state.lastFrameTime >= config.delayMs) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const frame = config.frames[state.currentFrame];
      const scaledOffsetX = (frame.offsetX + config.globalOffsetX) * config.scaleFactor;
      const scaledOffsetY = (frame.offsetY + config.globalOffsetY) * config.scaleFactor;
      ctx.drawImage(
        spriteSheet,
        frame.x, frame.y, frame.width, frame.height,
        scaledOffsetX, scaledOffsetY, frame.width * config.scaleFactor, frame.height * config.scaleFactor
      );

      state.currentFrame = (state.currentFrame + 1) % config.frames.length;
      if (!config.loop && state.currentFrame === 0) {
        cancelAnimationFrame(state.animationFrameId);
        animationStates.set(targetElement, { ...state, animationFrameId: null });
        return;
      }
      state.lastFrameTime = now;
    }
    state.animationFrameId = requestAnimationFrame(animate);
    animationStates.set(targetElement, state);
  }

  // Start animation
  state = {
    currentFrame: 0,
    lastFrameTime: performance.now(),
    animationFrameId: null
  };
  animate();
  animationStates.set(targetElement, state);
}

// Initialize sprite sheet loading
preloadSpriteSheets();