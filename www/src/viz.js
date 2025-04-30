// viz.js - Oscilloscope waveform visualizations for sID JAm voice canvases

// Rolling buffer for waveform samples
const BUFFER_SIZE = 250; // Matches canvas width
const voiceBuffers = [
    new Float32Array(BUFFER_SIZE), // Voice 1
    new Float32Array(BUFFER_SIZE), // Voice 2
    new Float32Array(BUFFER_SIZE)  // Voice 3
];
let bufferIndex = 0;
let retryCount = 0;
const MAX_RETRIES = 5;
let traceStreams = null;
let useTraceStreams = false;

// Draw oscilloscope waveform for a given voice
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

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#444'; // Background from styles.css
    ctx.fillRect(0, 0, width, height);

    // Check player state
    const player = window.player;
    if (!player || player.isPaused() || !player._isSongReady) {
        window.logmsg(`Player state: isPaused=${player?.isPaused()}, isSongReady=${player?._isSongReady}`, 2);
        return;
    }

    // Draw waveform
    ctx.beginPath();
    ctx.strokeStyle = '#00FF00'; // Green, consistent with original
    ctx.lineWidth = 2;

    const buffer = voiceBuffers[voiceIdx];
    for (let x = 0; x < width; x++) {
        const bufferPos = (bufferIndex - width + x + BUFFER_SIZE) % BUFFER_SIZE;
        const sample = buffer[bufferPos]; // Range: -1 to 1
        const y = midY - (sample * (height / 2) * 0.8); // Scale to 80% height
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

// Update voice buffers with waveform samples
function updateVoiceBuffers() {
    const player = window.player;
    if (!player || player.isPaused() || !player._isSongReady) {
        return;
    }

    const adapter = player._backendAdapter;
    if (!adapter || !adapter.isAdapterReady()) {
        window.logmsg('SIDBackendAdapter not ready for waveform data', 1);
        return;
    }

    const Module = window.backend_SID.Module;
    try {
        if (useTraceStreams && traceStreams && traceStreams.length >= 3) {
            // Read raw waveform samples from trace streams
            for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
                const stream = traceStreams[voiceIdx];
                // Read latest sample (assuming HEAP16, scaled to -1 to 1)
                const sample = Module.HEAP16[stream] / 32768;
                voiceBuffers[voiceIdx][bufferIndex] = sample;
            }
        } else {
            // Fallback to readVoiceLevel
            if (!player._externalTicker) {
                window.logmsg('External ticker not enabled, voice levels may be inaccurate', 1);
            }
            for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
                const level = adapter.readVoiceLevel(0, voiceIdx); // 0-1 range
                voiceBuffers[voiceIdx][bufferIndex] = (level * 2) - 1; // Normalize to -1 to 1
            }
        }
    } catch (error) {
        window.logmsg(`Error fetching waveform data: ${error.message}`, 1);
        voiceBuffers[0][bufferIndex] = 0;
        voiceBuffers[1][bufferIndex] = 0;
        voiceBuffers[2][bufferIndex] = 0;
    }

    bufferIndex = (bufferIndex + 1) % BUFFER_SIZE;
}

// Initialize trace streams
function initTraceStreams() {
    const player = window.player;
    if (!player || !player._backendAdapter) {
        return false;
    }
    const Module = window.backend_SID.Module;
    try {
        const numStreams = Module.ccall('emu_number_trace_streams', 'number');
        if (numStreams >= 3) {
            const streamsPtr = Module.ccall('emu_get_trace_streams', 'number');
            const streamsArray = Module.HEAP32.subarray(streamsPtr >> 2, (streamsPtr >> 2) + numStreams);
            traceStreams = [];
            for (let i = 0; i < numStreams && i < 3; i++) {
                traceStreams.push(streamsArray[i] >> 1); // HEAP16 offset
            }
            window.logmsg(`Initialized ${traceStreams.length} trace streams`, 1);
            return true;
        } else {
            window.logmsg(`Insufficient trace streams: ${numStreams}`, 1);
            return false;
        }
    } catch (error) {
        window.logmsg(`Error initializing trace streams: ${error.message}`, 1);
        return false;
    }
}

// Animation loop with 60 FPS throttling
let lastRenderTime = 0;
const TIME_LIMIT = 1000 / 60; // 60 FPS
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
        drawVoiceWaveform('voice1-canvas', 0);
        drawVoiceWaveform('voice2-canvas', 1);
        drawVoiceWaveform('voice3-canvas', 2);
    }

    lastRenderTime = now;
    requestAnimationFrame(animateVoiceWaveforms);
}

// Initialize visualizations
function initVisualizations() {
    window.logmsg('Initializing oscilloscope waveform visualizations', 1);
    if (!window.player || !window.player._backendAdapter) {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
            window.logmsg(`ScriptNodePlayer not ready, retrying in 1s (${retryCount}/${MAX_RETRIES})`, 1);
            setTimeout(initVisualizations, 1000);
            return;
        } else {
            window.logmsg('Max retries reached, no visualizations available', 1);
            return;
        }
    }

    // Initialize trace streams
    useTraceStreams = initTraceStreams();
    window.logmsg(`Using trace streams: ${useTraceStreams}`, 1);
    window.logmsg(`External ticker enabled: ${!!window.player._externalTicker}`, 1);

    // Clear buffers
    voiceBuffers.forEach(buffer => buffer.fill(0));
    bufferIndex = 0;
    animateVoiceWaveforms();
}

// Start visualizations
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVisualizations);
} else {
    initVisualizations();
}

export { initVisualizations, drawVoiceWaveform };