// viz.js - Real-time oscilloscope waveform visualizations for sID JAm voice canvases

// Static buffer for waveform samples (short time window)
// Tweak BUFFER_SIZE to adjust zoom:
// - 8 (~0.181ms, ~1 cycle at 1 kHz, very zoomed)
// - 12 (~0.272ms, ~2 cycles, tighter)
// - 15 (~0.34ms, ~2.5 cycles, current)
// - 18 (~0.408ms, ~3 cycles, wider)
// - 20 (~0.453ms, ~3-4 cycles, very wide)
const BUFFER_SIZE = 15; // ~0.34ms at 44100 Hz, shows ~2.5 cycles at 1 kHz
const voiceBuffers = [
    new Float32Array(BUFFER_SIZE), // Voice 1
    new Float32Array(BUFFER_SIZE), // Voice 2
    new Float32Array(BUFFER_SIZE)  // Voice 3
];
let retryCount = 0;
const MAX_RETRIES = 5;
let traceStreams = null;

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
        return; // Silently skip rendering when paused or not ready
    }

    // Draw waveform
    ctx.beginPath();
    ctx.strokeStyle = '#00FF00'; // Green, consistent with original
    ctx.lineWidth = 2;

    const buffer = voiceBuffers[voiceIdx];
    // Dynamically scale amplitude
    // Tweak the factor (0.8) to adjust amplitude:
    // - 0.6 (60% height, smaller waveforms)
    // - 0.7 (70% height, slightly smaller)
    // - 0.8 (80% height, current)
    // - 0.9 (90% height, taller)
    // - 1.0 (100% height, may clip)
    let maxAmplitude = 0;
    for (let i = 0; i < BUFFER_SIZE; i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(buffer[i]));
    }
    const scale = maxAmplitude > 0 ? (0.8 * height / 2) / maxAmplitude : 1;

    // Interpolate samples across canvas width
    for (let x = 0; x < width; x++) {
        const t = x / (width - 1); // 0 to 1
        const sampleIdx = t * (BUFFER_SIZE - 1);
        const i0 = Math.floor(sampleIdx);
        const i1 = Math.min(i0 + 1, BUFFER_SIZE - 1);
        const frac = sampleIdx - i0;
        // Linear interpolation
        const sample = buffer[i0] + (buffer[i1] - buffer[i0]) * frac;
        const y = midY - (sample * scale);
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

// Update voice buffers with triggered waveform samples
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

    if (!traceStreams || traceStreams.length < 3) {
        window.logmsg('Trace streams not initialized or insufficient', 1);
        voiceBuffers.forEach(buffer => buffer.fill(0));
        return;
    }

    const Module = window.backend_SID.Module;
    try {
        // Read triggered waveform samples
        const SAMPLE_WINDOW = 20; // Scan window for trigger
        for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
            const stream = traceStreams[voiceIdx];
            // Find trigger point (first rising zero-crossing)
            let triggerIdx = 0;
            for (let i = 0; i < SAMPLE_WINDOW - 1; i++) {
                const sample0 = Module.HEAP16[stream + i] / 32768;
                const sample1 = Module.HEAP16[stream + i + 1] / 32768;
                if (sample0 <= 0 && sample1 > 0) {
                    triggerIdx = i + 1;
                    break;
                }
            }
            // Read BUFFER_SIZE samples from trigger point
            for (let i = 0; i < BUFFER_SIZE; i++) {
                const idx = triggerIdx + i;
                voiceBuffers[voiceIdx][i] = Module.HEAP16[stream + idx] / 32768;
            }
        }
    } catch (error) {
        window.logmsg(`Error fetching waveform data: ${error.message}`, 1);
        voiceBuffers.forEach(buffer => buffer.fill(0));
    }
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
    window.logmsg('Initializing real-time oscilloscope visualizations', 1);
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
    if (!initTraceStreams()) {
        window.logmsg('Failed to initialize trace streams, visualizations disabled', 1);
        return;
    }
    window.logmsg(`External ticker enabled: ${!!window.player._externalTicker}`, 1);

    // Clear buffers
    voiceBuffers.forEach(buffer => buffer.fill(0));
    animateVoiceWaveforms();
}

// Start visualizations
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVisualizations);
} else {
    initVisualizations();
}

export { initVisualizations, drawVoiceWaveform };