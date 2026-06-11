// spriteanimator.js
// Configuration map for animations
const ANIMATION_CONFIGS = {
  bomb: {
    spriteSheetPath: '../image/bomb_fuse_sheet.png',
    staticImagePath: '../image/bomb_at_rest.png',
    scaleFactor: 0.653, // 128 / 235
    frames: [
      {
        x: 0,
        y: 0,
        width: 235,
        height: 203,
        offsetX: -22,
        offsetY: -5
      },
      {
        x: 235,
        y: 0,
        width: 235,
        height: 203,
        offsetX: 7,
        offsetY: -11
      },
      {
        x: 0,
        y: 203,
        width: 235,
        height: 203,
        offsetX: -18,
        offsetY: 11
      },
      {
        x: 235,
        y: 203,
        width: 235,
        height: 203,
        offsetX: 15,
        offsetY: 9
      }
    ],
    globalOffsetX: 0,
    globalOffsetY: 0,
    delayMs: 225,
    loop: true
  },
  boom: {
    spriteSheetPath: '../image/boom_sheet.png',
    staticImagePath: '../image/bomb_at_rest.png',
    soundTrack: '../image/fizz_boom.wav',
    scaleFactor: 0.653,
    volume: 0.6, // Default volume (max)
    audioOffsetMs: 0, // No offset by default
    frames: [
      {
        x: 0,
        y: 0,
        width: 267,
        height: 261,
        offsetX: -22,
        offsetY: 2
      },
      {
        x: 267,
        y: 0,
        width: 267,
        height: 261,
        offsetX: -15,
        offsetY: 5
      },
      {
        x: 534,
        y: 0,
        width: 267,
        height: 261,
        offsetX: -4,
        offsetY: 7
      },
      {
        x: 801,
        y: 0,
        width: 267,
        height: 261,
        offsetX: 8,
        offsetY: 7
      },
      {
        x: 0,
        y: 261,
        width: 267,
        height: 261,
        offsetX: -24,
        offsetY: 40
      },
      {
        x: 267,
        y: 261,
        width: 267,
        height: 261,
        offsetX: -9,
        offsetY: 41
      },
      {
        x: 534,
        y: 261,
        width: 267,
        height: 261,
        offsetX: 11,
        offsetY: 35
      },
      {
        x: 801,
        y: 261,
        width: 267,
        height: 261,
        offsetX: 15,
        offsetY: 41
      },
      {
        x: 0,
        y: 522,
        width: 267,
        height: 261,
        offsetX: -17,
        offsetY: 45
      },
      {
        x: 267,
        y: 522,
        width: 267,
        height: 261,
        offsetX: 12,
        offsetY: 36
      },
      {
        x: 534,
        y: 522,
        width: 267,
        height: 261,
        offsetX: 10,
        offsetY: 27
      },
      {
        x: 801,
        y: 522,
        width: 267,
        height: 261,
        offsetX: 16,
        offsetY: 29
      }
    ],
    globalOffsetX: -18,
    globalOffsetY: -12,
    delayMs: 225,
    loop: false
  },
  jam: {
    spriteSheetPath: '../image/jam-sprite.png',
    staticImagePath: '../image/jam-static.png',
    scaleFactor: 154 / 320,
    frames: [
      { x: 0, y: 0, width: 320, height: 238, offsetX: -6, offsetY: -1 },
      { x: 320, y: 0, width: 320, height: 238, offsetX: -1, offsetY: 0 },
      { x: 0, y: 238, width: 320, height: 238, offsetX: -6, offsetY: 3 },
      { x: 320, y: 238, width: 320, height: 238, offsetX: -2, offsetY: -1 }
    ],
    globalOffsetX: -2,
    globalOffsetY: 7,
    delayMs: 400,
    loop: true
  }
};

const spriteSheets = new Map();
const audioTracks = new Map();

// Preload assets
function preloadAssets() {
  Object.entries(ANIMATION_CONFIGS).forEach(([animationId, config]) => {
    const img = new Image();
    img.src = config.spriteSheetPath;
    img.onerror = () => window.logmsg(`Failed to load sprite sheet for ${animationId}: ${config.spriteSheetPath}`, 1);
    img.onload = () => window.logmsg(`Sprite sheet for ${animationId} loaded`, 2);
    spriteSheets.set(animationId, img);

    if (config.soundTrack) {
      const audio = new Audio(config.soundTrack);
      audio.preload = 'auto';
      audio.volume = Math.max(0, Math.min(1, config.volume || 1.0)); // Set volume during preload
      audio.onerror = () => window.logmsg(`Failed to load sound for ${animationId}: ${config.soundTrack}`, 1);
      audio.oncanplaythrough = () => window.logmsg(`Sound for ${animationId} preloaded`, 2);
      audioTracks.set(animationId, audio);
    }
  });
}
preloadAssets();

// Store animation state per target element
const animationStates = new WeakMap();

// Render the sprite sheet animation
export function renderSpriteAnimation(targetElement, animationId, isActive, onComplete = null) {
  // Validate animationId
  if (!ANIMATION_CONFIGS[animationId]) {
    window.logmsg(`Invalid animationId: ${animationId}`, 1);
    targetElement.style.backgroundImage = `url(${ANIMATION_CONFIGS.bomb.staticImagePath})`;
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

  // Play sound with offset
  const audio = audioTracks.get(animationId);
  if (audio) {
    audio.currentTime = 0; // Reset
    audio.volume = Math.max(0, Math.min(1, config.volume || 1.0)); // Apply volume
    const offsetMs = config.audioOffsetMs || 0;

    if (offsetMs >= 0) {
      // Positive offset: Delay audio
      setTimeout(() => {
        audio.play().catch(err => window.logmsg(`Sound playback error for ${animationId}: ${err}`, 1));
      }, offsetMs);
    } else {
      // Negative offset: Delay video
      const videoDelay = Math.abs(offsetMs);
      setTimeout(() => {
        // Start animation
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
              if (onComplete) onComplete();
              return;
            }
            state.lastFrameTime = now;
          }
          state.animationFrameId = requestAnimationFrame(animate);
          animationStates.set(targetElement, state);
        }

        state = {
          currentFrame: 0,
          lastFrameTime: performance.now(),
          animationFrameId: null
        };
        animate();
      }, videoDelay);

      // Play audio immediately
      audio.play().catch(err => window.logmsg(`Sound playback error for ${animationId}: ${err}`, 1));
      animationStates.set(targetElement, state);
      return; // Exit to avoid starting animation twice
    }
  }

  // Animation loop (when no video delay)
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
        if (onComplete) onComplete();
        return;
      }
      state.lastFrameTime = now;
    }
    state.animationFrameId = requestAnimationFrame(animate);
    animationStates.set(targetElement, state);
  }

  // Start animation (when no video delay)
  state = {
    currentFrame: 0,
    lastFrameTime: performance.now(),
    animationFrameId: null
  };
  animate();
  animationStates.set(targetElement, state);
}