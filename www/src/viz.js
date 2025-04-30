// viz.js - Visualization logic for sID JAm voice canvases

// Rolling buffer to store voice levels for waveform
const BUFFER_SIZE = 250; // Matches canvas width
const voiceBuffers = [
    new Float32Array(BUFFER_SIZE), // Voice 1
    new Float32Array(BUFFER_SIZE), // Voice 2
    new Float32Array(BUFFER_SIZE)  // Voice 3
];
let bufferIndex = 0;
let retryCount = 0;
const MAX_RETRIES = 5;

// Draw waveform for a given voice canvas
function drawVoiceWaveform(canvasId, voiceIdx) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        window.logmsg(`Canvas with ID ${canvasId} not found`, 1);
        return;
    }
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // 250
    const height = canvas.height; // 100
    const midY = height / 2;

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#444'; // Background from styles.css
    ctx.fillRect(0, 0, width, height);

    // Check player state
    const player = window.player;
    if (!player || player.isPaused() || !player._isSongReady) {
        window.logmsg(`Player state: isPaused=${player?.isPaused()}, isSongReady=${player?._isSongReady}`, 2);
        return; // Don't draw if no playback
    }

    // Draw waveform
    ctx.beginPath();
    ctx.strokeStyle = '#00FF00'; // Green, as approved
    ctx.lineWidth = 2;

    const buffer = voiceBuffers[voiceIdx];
    for (let x = 0; x < width; x++) {
        const bufferPos = (bufferIndex - width + x + BUFFER_SIZE) % BUFFER_SIZE;
        const level = buffer[bufferPos]; // Expected range: -1 to 1
        const y = midY - (level * (height / 2) * 0.8); // Scale to 80% height
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

// Update voice buffers with new data
function updateVoiceBuffers() {
    const player = window.player;
    if (!player || player.isPaused() || !player._isSongReady) {
        return;
    }

    const adapter = player._backendAdapter;
    if (!adapter || !adapter.isAdapterReady()) {
        window.logmsg('SIDBackendAdapter not ready for voice data', 1);
        return;
    }

    // Try spectrum data from _freqByteData
    try {
        const freqData = player._freqByteData;
        if (freqData && freqData.length >= 32) {
            // Map frequency bins to voices (low, mid, high frequencies)
            const low = freqData[2]; // ~100-200 Hz
            const mid = freqData[8]; // ~500-1000 Hz
            const high = freqData[16]; // ~2000-4000 Hz
            window.logmsg(`Spectrum data: low=${low}, mid=${mid}, high=${high}`, 2);
            voiceBuffers[0][bufferIndex] = (low / 127.5) - 1; // Voice 1 (low)
            voiceBuffers[1][bufferIndex] = (mid / 127.5) - 1; // Voice 2 (mid)
            voiceBuffers[2][bufferIndex] = (high / 127.5) - 1; // Voice 3 (high)
        } else {
            window.logmsg('No valid spectrum data available', 1);
            voiceBuffers[0][bufferIndex] = 0;
            voiceBuffers[1][bufferIndex] = 0;
            voiceBuffers[2][bufferIndex] = 0;
        }
    } catch (error) {
        window.logmsg(`Error fetching spectrum data: ${error.message}`, 1);
        voiceBuffers[0][bufferIndex] = 0;
        voiceBuffers[1][bufferIndex] = 0;
        voiceBuffers[2][bufferIndex] = 0;
    }

    bufferIndex = (bufferIndex + 1) % BUFFER_SIZE;
}

// Animation loop with aggressive throttling for 60 FPS
let lastRenderTime = 0;
const TIME_LIMIT = 1000 / 60; // Target 60 FPS
let refreshCounter = 0;

function animateVoiceWaveforms() {
    const now = performance.now();
    const renderTime = now - lastRenderTime;

    // Throttle rendering
    const slowdownFactor = TIME_LIMIT ? Math.max(1, renderTime / TIME_LIMIT) : 1;
    refreshCounter++;
    if (refreshCounter >= slowdownFactor) {
        refreshCounter = 0;
        updateVoiceBuffers();
        drawVoiceWaveform('voice1-canvas', 0); // Voice 1
        drawVoiceWaveform('voice2-canvas', 1); // Voice 2
        drawVoiceWaveform('voice3-canvas', 2); // Voice 3
    }

    lastRenderTime = now;
    requestAnimationFrame(animateVoiceWaveforms);
}

// Initialize visualizations
function initVisualizations() {
    window.logmsg('Initializing voice waveform visualizations', 1);
    if (!window.player || !window.player._backendAdapter) {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
            window.logmsg(`ScriptNodePlayer not ready, retrying in 1s (${retryCount}/${MAX_RETRIES})`, 1);
            setTimeout(initVisualizations, 1000);
            return;
        } else {
            window.logmsg('Max retries reached, no visualizations available', 1);
            return; // Stop without rendering
        }
    }

    // Log ticker status
    window.logmsg(`Ticker enabled: ${!!window.player._externalTicker}`, 1);

    // Clear buffers
    voiceBuffers.forEach(buffer => buffer.fill(0));
    bufferIndex = 0;
    animateVoiceWaveforms();
}

// Start visualizations when the DOM is ready
document.addEventListener('DOMContentLoaded', initVisualizations);

// Export functions
export { initVisualizations, drawVoiceWaveform };