export default function createSpriteAnimator({ spriteSheetUrl, target, config, autoplay = false }) {
    const canvas = document.querySelector(target);
    if (!canvas) throw new Error('Target canvas not found');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = spriteSheetUrl;
    let currentFrame = 0;
    let lastFrameTime = 0;
    let isPlaying = autoplay;
    const delayMs = config.delayMs || 100; // Fallback if missing
    const loop = config.loop !== false; // Default to true
  
    function renderFrame() {
      const frame = config.frames[currentFrame];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        img,
        frame.x, frame.y, frame.width, frame.height,
        (frame.offsetX || 0) + (config.globalOffsetX || 0),
        (frame.offsetY || 0) + (config.globalOffsetY || 0),
        frame.width, frame.height
      );
    }
  
    function animate(timestamp) {
      if (!isPlaying) return;
      if (timestamp - lastFrameTime >= delayMs) {
        currentFrame = loop ? (currentFrame + 1) % config.frames.length : Math.min(currentFrame + 1, config.frames.length - 1);
        renderFrame();
        lastFrameTime = timestamp;
      }
      requestAnimationFrame(animate);
    }
  
    img.onload = () => {
      canvas.width = config.frames[0].width; // 85px
      canvas.height = config.frames[0].height; // 102px
      renderFrame();
      if (autoplay) requestAnimationFrame(animate);
    };
  
    img.onerror = () => {
      console.error('Failed to load sprite sheet:', spriteSheetUrl);
    };
  
    return {
      play: () => { isPlaying = true; requestAnimationFrame(animate); },
      pause: () => { isPlaying = false; },
      stop: () => { isPlaying = false; currentFrame = 0; renderFrame(); }
    };
  }