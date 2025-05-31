// viz.js
import { updateWaveformVisibility, updateVUMeterVisibility } from './ui.js';
import { getPlayerState, updatePlayerState } from './brackets.js';

// Configuration
const BUFFER_SIZE = 9000; // WebSID buffer size (~204ms at 44100 Hz)
const CIRCULAR_BUFFER_SIZE = 44100; // Exactly 1 second at 44100 Hz
const USABLE_SAMPLES = 777; // Changed to 777 samples per frame for "bad" songs

const VU_WINDOW_SIZE = 800; // Larger for smoother, smaller for more aggressive
const MAX_VISIBLE_SAMPLES = CIRCULAR_BUFFER_SIZE; // Max range for visualization
const TARGET_FPS = 60; // Match rendering loop
const TIME_LIMIT = 1000 / TARGET_FPS; // ~16.67ms at 60 FPS
const RMS_SCALING_FACTOR = 2.0; // Adjusted scaling factor
const BACKGROUND_COLOR = '#333333'; // Dark grey for waveform canvas
const FALLBACK_COLOR = '#555555'; // Fallback for unregulated data

// VU meter configuration
const VU_METER_COUNT = 3; // One per voice
const NEEDLE_LENGTH = 50; // Pixels, scaled for 100x57px canvas
const ANGLE_RANGE = [-50, 43]; // Degrees, -100 dB to 0 dB
const ATTACK_RATE = 0.9; // Seconds, for spring strength (~3–6ms attack)
const DECAY_RATE = 0.07; // Seconds, for spring strength (~50–100ms decay)
const OVERSHOOT = 0.15; // 15% overshoot for controlled 70s bounce
const LOG_INTERVAL = 0.05; // Seconds, log 10 times per second (100ms)
const ZERO_TICK_THRESHOLD = 2; // Stop logging after 2 consecutive all-zero ticks
const PEAK_WINDOW_SIZE = 200; // ~5ms at 44100 Hz for short transients
let peakRMS = new Float32Array(VU_METER_COUNT); // Peak RMS for each voice

// Zoom configuration
const SINGLE_CLICK_ZOOM_STEP = 1.125; // 12.5% for single clicks
const CONTINUOUS_ZOOM_STEP = 1.025; // 2.5% for continuous zooming
const ZOOM_INTERVAL = 50; // ms between continuous zoom steps

// Circular buffers for each voice
const circularBuffers = [
    new Float32Array(CIRCULAR_BUFFER_SIZE), // Voice 1
    new Float32Array(CIRCULAR_BUFFER_SIZE), // Voice 2
    new Float32Array(CIRCULAR_BUFFER_SIZE)  // Voice 3
];
let writePosition = 0; // Current write position in the circular buffer
let zoomFactor; // Initialize later in startVisualizations

// VU meter state
const vuLabelImage = new Image();
vuLabelImage.src = '../image/vu_label.png';
const vuFrameImage = new Image();
vuFrameImage.src = '../image/vu_frame.png';
let isLabelImageLoaded = false;
let isFrameImageLoaded = false;

vuLabelImage.onload = () => {
    isLabelImageLoaded = true;
    renderStaticVUMeters();
};
vuLabelImage.onerror = () => {
    window.logmsg('Failed to load VU label image', 1);
};
vuFrameImage.onload = () => {
    isFrameImageLoaded = true;
    renderStaticVUMeters();
};
vuFrameImage.onerror = () => {
    window.logmsg('Failed to load VU frame image', 1);
};

const vuLevels = new Float32Array(VU_METER_COUNT); // RMS amplitude
const needleAngles = new Float32Array(VU_METER_COUNT); // Current angle
const needleVelocities = new Float32Array(VU_METER_COUNT); // Physics velocity

let traceStreams = null;
let isVisualizationActive = false;
let lastRenderTime = 0;
let logTimer = 0;
let logCounter = 0;
let zeroTickCount = 0;

// Continuous zoom state
let zoomIntervalId = null;

// Draw static waveform
function drawStaticWaveform(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        window.logmsg(`drawStaticWaveform: Canvas ${canvasId} not found`, 1);
        return;
    }
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // 250
    const height = canvas.height; // 100
    const midY = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();
}

// Draw static VU meter and amplitude bar
function drawStaticVUMeter(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        window.logmsg(`drawStaticVUMeter: Canvas ${canvasId} not found`, 1);
        return;
    }
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // 120
    const height = canvas.height; // 70
    const pivotX = width / 2;
    const pivotY = height * 0.9;

    ctx.clearRect(0, 0, width, height);

    if (isLabelImageLoaded) {
        ctx.drawImage(vuLabelImage, 0, 0, width, height);
    } else {
        ctx.fillStyle = FALLBACK_COLOR;
        ctx.fillRect(0, 0, width, height);
    }

    const angleDeg = ANGLE_RANGE[0];
    const angleRad = (angleDeg * Math.PI) / 180;
    const endX = pivotX + NEEDLE_LENGTH * Math.sin(angleRad);
    const endY = pivotY - NEEDLE_LENGTH * Math.cos(angleRad);

    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (isFrameImageLoaded) {
        ctx.drawImage(vuFrameImage, 0, 0, width, height);
    }

    // Draw static amplitude bar
    const voiceIdx = parseInt(canvasId.replace('vu', '')) - 1;
    const ampCanvasId = `amp${voiceIdx + 1}-canvas`;
    drawAmplitudeBar(ampCanvasId, voiceIdx, 0); // Zero amplitude for static state
}

// Render static visualizations
function renderStaticVisualizations() {
    drawStaticWaveform('voice1-canvas');
    drawStaticWaveform('voice2-canvas');
    drawStaticWaveform('voice3-canvas');
    renderStaticVUMeters();
    const playerState = getPlayerState();
    updateWaveformVisibility(playerState.isWaveformActive);
    updateVUMeterVisibility(playerState.isVUActive);
}

function renderStaticVUMeters() {
    const state = getPlayerState();
    const isVUActive = state.isVUActive;
    const isBarActive = state.isBarActive;
    if (isVUActive) {
        drawStaticVUMeter('vu1-canvas');
        drawStaticVUMeter('vu2-canvas');
        drawStaticVUMeter('vu3-canvas');
    }
    if (isBarActive) {
        drawAmplitudeBar('amp1-canvas', 0, 0);
        drawAmplitudeBar('amp2-canvas', 1, 0);
        drawAmplitudeBar('amp3-canvas', 2, 0);
    }
}



// Draw dynamic waveform
function drawVoiceWaveform(canvasId, voiceIdx) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        window.logmsg(`drawVoiceWaveform: Canvas ${canvasId} not found`, 1);
        return;
    }
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // 250
    const height = canvas.height; // 100
    const midY = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    const player = window.player;
    const isWaveformActive = getPlayerState().isWaveformActive;
    if (!player || !player._isSongReady || !isWaveformActive) {
        circularBuffers.forEach(buffer => buffer.fill(0));
        vuLevels.fill(0);
        needleAngles.fill(ANGLE_RANGE[0]);
        needleVelocities.fill(0);
        ctx.beginPath();
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();
        return;
    }

    ctx.beginPath();
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;

    const buffer = circularBuffers[voiceIdx];
    let maxAmplitude = 0;
    const visibleSamples = Math.min(Math.round(MAX_VISIBLE_SAMPLES / zoomFactor), MAX_VISIBLE_SAMPLES);
    const newestSampleIdx = writePosition === 0 ? CIRCULAR_BUFFER_SIZE - 1 : writePosition - 1;
    const endCircularIdx = newestSampleIdx;
    const startCircularIdx = (endCircularIdx - visibleSamples + CIRCULAR_BUFFER_SIZE) % CIRCULAR_BUFFER_SIZE;

    let idx = startCircularIdx - visibleSamples + 1;
    if (idx < 0) idx += CIRCULAR_BUFFER_SIZE;
    for (let i = 0; i < visibleSamples; i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(buffer[idx]));
        idx = (idx + 1) % CIRCULAR_BUFFER_SIZE;
    }
    const scale = maxAmplitude > 0 ? (0.8 * height / 2) / maxAmplitude : 1;

    idx = startCircularIdx;
    for (let x = 0; x < width; x++) {
        const t = x / (width - 1);
        const sampleIdx = t * (visibleSamples - 1);
        const i0 = Math.floor(sampleIdx);
        const i1 = Math.min(i0 + 1, visibleSamples - 1);
        const frac = sampleIdx - i0;

        const circularIdx0 = (startCircularIdx + i0) % CIRCULAR_BUFFER_SIZE;
        const circularIdx1 = (startCircularIdx + i1) % CIRCULAR_BUFFER_SIZE;
        const sample = buffer[circularIdx0] + (buffer[circularIdx1] - buffer[circularIdx0]) * frac;
        const y = midY - (sample * scale);
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

// Draw dynamic VU meter
function drawVUMeter(canvasId, voiceIdx) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        window.logmsg(`drawVUMeter: Canvas ${canvasId} not found`, 1);
        return;
    }
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // 120
    const height = canvas.height; // 70
    const pivotX = width / 2;
    const pivotY = height * 0.9;

    ctx.clearRect(0, 0, width, height);
    if (isLabelImageLoaded) {
        ctx.drawImage(vuLabelImage, 0, 0, width, height);
    } else {
        ctx.fillStyle = FALLBACK_COLOR;
        ctx.fillRect(0, 0, width, height);
    }

    const player = window.player;
    if (!player || !player._isSongReady) {
        return;
    }

    const angleDeg = needleAngles[voiceIdx];
    const angleRad = (angleDeg * Math.PI) / 180;
    const endX = pivotX + NEEDLE_LENGTH * Math.sin(angleRad);
    const endY = pivotY - NEEDLE_LENGTH * Math.cos(angleRad);

    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (isFrameImageLoaded) {
        ctx.drawImage(vuFrameImage, 0, 0, width, height);
    }
}

// New: Draw amplitude bar
function drawAmplitudeBar(canvasId, voiceIdx, amplitude) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        window.logmsg(`drawAmplitudeBar: Canvas ${canvasId} not found`, 1);
        return;
    }
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // 20
    const height = canvas.height; // 70

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#000000'; // Black background
    ctx.fillRect(0, 0, width, height);

    // Use effectiveLevel and apply adjusted logarithmic scaling for bars
    const effectiveLevel = Math.max(peakRMS[voiceIdx], amplitude);
    const db = effectiveLevel > 0 ? 20 * Math.log10(effectiveLevel) : -100;
    const normalizedLevel = (db + 100) / 110; // Less aggressive curve for bars (visual impact)
    const barHeight = Math.min(Math.max(normalizedLevel * height, 0), height);

    // Color gradient: green (bottom) to yellow (middle) to red (top)
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#00FF00'); // Green at bottom
    gradient.addColorStop(0.5, '#FFFF00'); // Yellow in middle
    gradient.addColorStop(1, '#FF0000'); // Red at top
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - barHeight, width, barHeight); // Draw from bottom up

    // Add a subtle peak marker (store peak height in a global array)
    if (!window.peakBarHeights) {
        window.peakBarHeights = new Float32Array(VU_METER_COUNT).fill(0);
    }
    window.peakBarHeights[voiceIdx] = Math.max(window.peakBarHeights[voiceIdx], barHeight);
    // Decay peak marker slowly (mimic needle decay)
    window.peakBarHeights[voiceIdx] -= 0.5; // ~0.5 pixels per frame (~30 pixels/sec at 60 FPS)
    window.peakBarHeights[voiceIdx] = Math.max(0, window.peakBarHeights[voiceIdx]);
    if (window.peakBarHeights[voiceIdx] > barHeight) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height - window.peakBarHeights[voiceIdx]);
        ctx.lineTo(width, height - window.peakBarHeights[voiceIdx]);
        ctx.stroke();
    }
}

// Update voice buffers and VU levels
function updateVoiceBuffers() {
    const player = window.player;
    if (!player || !player._isSongReady) {
        circularBuffers.forEach(buffer => buffer.fill(0));
        vuLevels.fill(0);
        peakRMS.fill(0);
        needleAngles.fill(ANGLE_RANGE[0]);
        needleVelocities.fill(0);
        writePosition = 0;
        return;
    }

    if (player.isPaused()) {
        vuLevels.fill(0);
        peakRMS.fill(0);
        return;
    }

    const adapter = player._backendAdapter;
    if (!adapter || !adapter.isAdapterReady()) {
        window.logmsg('updateVoiceBuffers: SIDBackendAdapter not ready', 1);
        circularBuffers.forEach(buffer => buffer.fill(0));
        vuLevels.fill(0);
        peakRMS.fill(0);
        writePosition = 0;
        return;
    }

    if (!traceStreams || traceStreams.length < 3) {
        window.logmsg('updateVoiceBuffers: Trace streams not initialized, attempting reinitialization', 1);
        if (!initTraceStreams()) {
            window.logmsg('updateVoiceBuffers: Failed to reinitialize trace streams', 1);
            circularBuffers.forEach(buffer => buffer.fill(0));
            vuLevels.fill(0);
            peakRMS.fill(0);
            writePosition = 0;
            return;
        }
    }

    const Module = window.backend_SID.Module;
    try {
        // Write waveform data to circular buffers
        for (let i = 0; i < USABLE_SAMPLES; i++) {
            const circularIdx = (writePosition + i) % CIRCULAR_BUFFER_SIZE;
            for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
                const stream = traceStreams[voiceIdx];
                const buffer = circularBuffers[voiceIdx];
                buffer[circularIdx] = Module.HEAP16[stream + i] / 32768;
            }
        }

        // Compute average RMS (existing)
        vuLevels.fill(0);
        for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
            let sumSquares = 0;
            const buffer = circularBuffers[voiceIdx];
            const newestIdx = writePosition === 0 ? CIRCULAR_BUFFER_SIZE - 1 : writePosition - 1;
            const startIdx = (newestIdx - USABLE_SAMPLES + CIRCULAR_BUFFER_SIZE) % CIRCULAR_BUFFER_SIZE;
            for (let i = 0; i < USABLE_SAMPLES; i++) {
                const idx = (startIdx + i) % CIRCULAR_BUFFER_SIZE;
                const sample = buffer[idx];
                sumSquares += sample * sample;
            }
            vuLevels[voiceIdx] = Math.sqrt(sumSquares / USABLE_SAMPLES) * 2.0;
            vuLevels[voiceIdx] = Math.min(vuLevels[voiceIdx], 1.0);
        }

        // Compute peak RMS (new, shorter window)
        peakRMS.fill(0);
        for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
            let sumSquares = 0;
            const buffer = circularBuffers[voiceIdx];
            const newestIdx = writePosition === 0 ? CIRCULAR_BUFFER_SIZE - 1 : writePosition - 1;
            const startIdx = (newestIdx - PEAK_WINDOW_SIZE + CIRCULAR_BUFFER_SIZE) % CIRCULAR_BUFFER_SIZE;
            for (let i = 0; i < PEAK_WINDOW_SIZE; i++) {
                const idx = (startIdx + i) % CIRCULAR_BUFFER_SIZE;
                const sample = buffer[idx];
                sumSquares += sample * sample;
            }
            peakRMS[voiceIdx] = Math.sqrt(sumSquares / PEAK_WINDOW_SIZE) * 2.0;
            peakRMS[voiceIdx] = Math.min(peakRMS[voiceIdx], 1.0);
        }

        writePosition = (writePosition + USABLE_SAMPLES) % CIRCULAR_BUFFER_SIZE;
    } catch (error) {
        window.logmsg(`updateVoiceBuffers: Error fetching waveform data: ${error.message}`, 1);
        traceStreams = null;
    }
}


// Update needle physics
function updateNeedlePhysics() {
    const now = performance.now();
    const renderTime = Math.min(now - lastPhysicsTime, 33.33) / 1000;
    const dt = renderTime > 0 ? renderTime : 1 / TARGET_FPS;
    const attackSmoothing = ATTACK_RATE; // Faster attack for sharper response
    const decaySmoothing = DECAY_RATE; // Slightly faster decay for liveliness

    logTimer += dt;
    logCounter++;
    if (logTimer >= LOG_INTERVAL) {
        const allZero = vuLevels.every(level => level === 0);
        if (allZero) {
            zeroTickCount++;
        } else {
            zeroTickCount = 0;
        }

        logTimer = 0;
        logCounter = 0;
    }

    const player = window.player;
    if (!player || !player._isSongReady) {
        return;
    }

    for (let i = 0; i < VU_METER_COUNT; i++) {
        const level = Math.max(peakRMS[i], vuLevels[i]);
        const db = level > 0 ? 20 * Math.log10(level) : -100;
        // Adjusted mapping to reduce pegging: soften mid-level response
        const targetAngle = ANGLE_RANGE[0] + (db + 100) / 130 * (ANGLE_RANGE[1] - ANGLE_RANGE[0]);

        const smoothing = needleAngles[i] < targetAngle ? attackSmoothing : decaySmoothing;
        needleAngles[i] += (targetAngle - needleAngles[i]) * smoothing * (dt / (1 / TARGET_FPS));
        needleAngles[i] = Math.max(ANGLE_RANGE[0], Math.min(ANGLE_RANGE[1], needleAngles[i]));
        needleVelocities[i] = 0;
    }

    lastPhysicsTime = now;
}


// Initialize trace streams
function initTraceStreams() {
    const player = window.player;
    if (!player || !player._backendAdapter) {
        window.logmsg('initTraceStreams: ScriptNodePlayer not ready', 1);
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
                traceStreams.push(streamsArray[i] >> 1);
                window.logmsg(`Trace stream ${i}: ${traceStreams[i]}`, 1);
            }
            return true;
        } else {
            window.logmsg(`Insufficient trace streams: ${numStreams}`, 1);
            return false;
        }
    } catch (error) {
        window.logmsg(`initTraceStreams: Error initializing trace streams: ${error.message}`, 1);
        return false;
    }
}

// Animation loop
let waveformFrameSkip = 0;
let vuMeterFrameSkip = 0;
function updateViz() {
    if (!isVisualizationActive) {
        window.logmsg('updateViz: Visualization loop stopped', 2);
        return;
    }

    const now = performance.now();
    const renderTime = now - lastRenderTime;

    if (renderTime >= TIME_LIMIT) {
        updateVoiceBuffers();
        updateNeedlePhysics();
        const playerState = getPlayerState();
        const isWaveformActive = playerState.isWaveformActive;
        const isVUActive = playerState.isVUActive;
        const isBarActive = playerState.isBarActive;

        // Enforce LOG_INTERVAL intervals for metrics (e.g., 0.05s = 50ms), but only collect if not paused
        const elapsed = (now - lastLogTime) / 1000;
        logTimer += elapsed;
        logCounter++;
        const player = window.player;
        if (logTimer >= LOG_INTERVAL && player && !player.isPaused()) {
            const fps = (logCounter / logTimer).toFixed(2);
            const effectiveLevels = Array.from(vuLevels).map((level, i) => Math.max(peakRMS[i], level));
            const barHeightPercentages = effectiveLevels.map(level => {
                const db = level > 0 ? 20 * Math.log10(level) : -100;
                return ((db + 100) / 110).toFixed(4); // Match bar scaling
            });
            const metricsFrame = {
                timestamp: now.toFixed(2),
                needleAngles: Array.from(needleAngles).map(a => a.toFixed(2)),
                vuLevels: Array.from(vuLevels).map(l => l.toFixed(4)),
                barLevels: Array.from(vuLevels).map(l => l.toFixed(4)),
                peakRMS: Array.from(peakRMS).map(l => l.toFixed(4)),
                effectiveLevels: effectiveLevels.map(l => l.toFixed(4)),
                barHeightPercentage: barHeightPercentages, // New: Track bar height percentage
                rawAmplitudes: [],
                zeroTickCount: zeroTickCount,
                writePosition: writePosition,
                traceStreamsStatus: traceStreams ? 'active' : 'inactive',
                targetAngles: Array.from(vuLevels).map((level, i) => {
                    const effectiveLevel = effectiveLevels[i];
                    const db = effectiveLevel > 0 ? 20 * Math.log10(effectiveLevel) : -100;
                    return (ANGLE_RANGE[0] + (db + 100) / 130 * (ANGLE_RANGE[1] - ANGLE_RANGE[0])).toFixed(2);
                }),
                needleVelocities: Array.from(needleVelocities).map(v => v.toFixed(4)),
                fps: fps,
                dt: (renderTime / 1000).toFixed(4),
                bufferSampleCheck: [],
                paused: false
            };

            // Compute raw waveform amplitudes and buffer check
            for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
                const buffer = circularBuffers[voiceIdx];
                let maxAmp = 0;
                let sampleSum = 0;
                const newestIdx = writePosition === 0 ? CIRCULAR_BUFFER_SIZE - 1 : writePosition - 1;
                const startIdx = (newestIdx - USABLE_SAMPLES + CIRCULAR_BUFFER_SIZE) % CIRCULAR_BUFFER_SIZE;
                for (let i = 0; i < USABLE_SAMPLES; i++) {
                    const idx = (startIdx + i) % CIRCULAR_BUFFER_SIZE;
                    const sample = buffer[idx];
                    maxAmp = Math.max(maxAmp, Math.abs(sample));
                    sampleSum += Math.abs(sample);
                }
                metricsFrame.rawAmplitudes.push(maxAmp.toFixed(4));
                metricsFrame.bufferSampleCheck.push((sampleSum / USABLE_SAMPLES).toFixed(4));
            }

            // Update playerState.vuMetrics (keep last 10 frames)
            playerState.vuMetrics.push(metricsFrame);
            if (playerState.vuMetrics.length > 10) {
                playerState.vuMetrics.shift();
            }
            updatePlayerState({ vuMetrics: playerState.vuMetrics });

            logTimer = 0;
            logCounter = 0;
            lastLogTime = now;
        }

        // Throttle rendering
        waveformFrameSkip = (waveformFrameSkip + 1) % 2;
        vuMeterFrameSkip = (vuMeterFrameSkip + 1) % 2;
        if (isWaveformActive && waveformFrameSkip === 0) {
            drawVoiceWaveform('voice1-canvas', 0);
            drawVoiceWaveform('voice2-canvas', 1);
            drawVoiceWaveform('voice3-canvas', 2);
        }
        if (isVUActive && vuMeterFrameSkip === 0) {
            drawVUMeter('vu1-canvas', 0);
            drawVUMeter('vu2-canvas', 1);
            drawVUMeter('vu3-canvas', 2);
        }
        if (isBarActive) {
            drawAmplitudeBar('amp1-canvas', 0, vuLevels[0]);
            drawAmplitudeBar('amp2-canvas', 1, vuLevels[1]);
            drawAmplitudeBar('amp3-canvas', 2, vuLevels[2]);
        }
        lastRenderTime = now;
    }

    requestAnimationFrame(updateViz);
}

// Initialize lastLogTime
let lastLogTime = performance.now();

// Zoom controls
export function zoomWaveformIn(isContinuous = false) {
    const step = isContinuous ? CONTINUOUS_ZOOM_STEP : SINGLE_CLICK_ZOOM_STEP;
    zoomFactor *= step; // Zoom in by step (2.5% continuous, 12.5% single click)
    zoomFactor = Math.max(1, Math.min(zoomFactor, 8820)); // Max zoom to see ~5 samples
    updatePlayerState({ zoomFactor }); // Update playerState
    window.logmsg('[+]', 1);
    window.logmsg(`Zoomed in to ${zoomFactor.toFixed(2)}x`, 1);
    updateZoomButtonStates();
    // Force redraw to apply new zoom
    const playerState = getPlayerState();
    if (playerState.isWaveformActive && window.player && window.player._isSongReady) {
        drawVoiceWaveform('voice1-canvas', 0);
        drawVoiceWaveform('voice2-canvas', 1);
        drawVoiceWaveform('voice3-canvas', 2);
    }
}

export function zoomWaveformOut(isContinuous = false) {
    const step = isContinuous ? CONTINUOUS_ZOOM_STEP : SINGLE_CLICK_ZOOM_STEP;
    zoomFactor /= step; // Zoom out by step (2.5% continuous, 12.5% single click)
    zoomFactor = Math.max(1, Math.min(zoomFactor, 8820));
    updatePlayerState({ zoomFactor }); // Update playerState
    window.logmsg('[-]', 1);
    window.logmsg(`Zoomed out to ${zoomFactor.toFixed(2)}x`, 1);
    updateZoomButtonStates();
    // Force redraw to apply new zoom
    const playerState = getPlayerState();
    if (playerState.isWaveformActive && window.player && window.player._isSongReady) {
        drawVoiceWaveform('voice1-canvas', 0);
        drawVoiceWaveform('voice2-canvas', 1);
        drawVoiceWaveform('voice3-canvas', 2);
    }
}

export function resetView() {
    zoomFactor = 46.13; // Reset to 44100 / 956 ≈ 956 samples
    updatePlayerState({ zoomFactor }); // Update playerState
    window.logmsg('[⭯]', 1);
    window.logmsg('View reset', 1);
    updateZoomButtonStates();
    // Force redraw to apply reset zoom
    const playerState = getPlayerState();
    if (playerState.isWaveformActive && window.player && window.player._isSongReady) {
        drawVoiceWaveform('voice1-canvas', 0);
        drawVoiceWaveform('voice2-canvas', 1);
        drawVoiceWaveform('voice3-canvas', 2);
    }
}

function updateZoomButtonStates() {
    const zoomOutButton = document.getElementById('zoom-out-button');
    const zoomInButton = document.getElementById('zoom-in-button');
    const resetButton = document.getElementById('reset-view-button');
    if (zoomOutButton) {
        zoomOutButton.disabled = zoomFactor <= 1;
    }
    if (zoomInButton) {
        zoomInButton.disabled = zoomFactor >= 8820;
    }
    if (resetButton) {
        resetButton.disabled = Math.abs(zoomFactor - 46.13) < 0.01; // Account for floating-point precision
    }
}

// Continuous zoom setup
function setupContinuousZoom() {
    const zoomInButton = document.getElementById('zoom-in-button');
    const zoomOutButton = document.getElementById('zoom-out-button');

    if (zoomInButton) {
        zoomInButton.addEventListener('mousedown', () => {
            if (!zoomInButton.disabled) {
                zoomWaveformIn(true); // Initial zoom
                zoomIntervalId = setInterval(() => zoomWaveformIn(true), ZOOM_INTERVAL);
            }
        });
        zoomInButton.addEventListener('mouseup', stopContinuousZoom);
        zoomInButton.addEventListener('mouseleave', stopContinuousZoom);
    }

    if (zoomOutButton) {
        zoomOutButton.addEventListener('mousedown', () => {
            if (!zoomOutButton.disabled) {
                zoomWaveformOut(true); // Initial zoom
                zoomIntervalId = setInterval(() => zoomWaveformOut(true), ZOOM_INTERVAL);
            }
        });
        zoomOutButton.addEventListener('mouseup', stopContinuousZoom);
        zoomOutButton.addEventListener('mouseleave', stopContinuousZoom);
    }
}

function stopContinuousZoom() {
    if (zoomIntervalId) {
        clearInterval(zoomIntervalId);
        zoomIntervalId = null;
    }
}

// Start visualizations
function startVisualizations() {
    if (!window.player) {
        window.logmsg('startVisualizations: window.player not defined, retrying', 1);
        let retryCount = 0;
        const maxRetries = 5;
        const retryInterval = 500;
        const retryInit = () => {
            if (window.player) {
                attemptTraceStreamInit();
            } else if (retryCount < maxRetries) {
                retryCount++;
                window.logmsg(`startVisualizations: window.player not ready, retrying in ${retryInterval}ms (${retryCount}/${maxRetries})`, 1);
                setTimeout(retryInit, retryInterval);
            } else {
                window.logmsg('startVisualizations: Max retries reached, visualizations disabled', 1);
            }
        };
        retryInit();
        return;
    }

    if (!window.player._backendAdapter) {
        window.logmsg('startVisualizations: ScriptNodePlayer backend adapter not ready', 1);
        return;
    }

    if (!window.player._isSongReady) {
        window.logmsg('startVisualizations: No song loaded, skipping trace stream initialization', 1);
        return;
    }

    let retryCount = 0;
    const maxRetries = 12;
    const retryInterval = 300;

    function attemptTraceStreamInit() {
        if (initTraceStreams()) {
            // Initialize zoomFactor
            zoomFactor = getPlayerState().zoomFactor || 46.13;
            if (typeof zoomFactor !== 'number' || zoomFactor < 1 || zoomFactor > 8820) {
                zoomFactor = 46.13;
                updatePlayerState({ zoomFactor });
            }
            window.logmsg(`[Viz.js] Initialized ZoomFactor to ${zoomFactor.toFixed(2)}x`, 2);
            isVisualizationActive = true;
            lastRenderTime = performance.now();
            updateViz();
            updateWaveformVisibility(getPlayerState().isWaveformActive);
            setupContinuousZoom();
            // Force initial waveform redraw
            const playerState = getPlayerState();
            if (playerState.isWaveformActive && window.player && window.player._isSongReady) {
                drawVoiceWaveform('voice1-canvas', 0);
                drawVoiceWaveform('voice2-canvas', 1);
                drawVoiceWaveform('voice3-canvas', 2);
            }
        } else if (retryCount < maxRetries) {
            retryCount++;
            window.logmsg(`Trace streams not ready, retrying in ${retryInterval}ms (${retryCount}/${maxRetries})`, 1);
            setTimeout(attemptTraceStreamInit, retryInterval);
        } else {
            window.logmsg('Max retries reached, visualizations disabled', 1);
        }
    }

    attemptTraceStreamInit();
}

window.startVisualizations = startVisualizations;

// Initialize static visualizations
function initStaticVisualizations() {
    renderStaticVisualizations();
    updateZoomButtonStates();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStaticVisualizations);
} else {
    initStaticVisualizations();
}

// Check audio activity
export function isAudioActive() {
    if (!traceStreams || !window.player || !window.player._isSongReady) {
        return false;
    }
    for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
        const buffer = circularBuffers[voiceIdx];
        const newestIdx = writePosition === 0 ? CIRCULAR_BUFFER_SIZE - 1 : writePosition - 1;
        const startIdx = (newestIdx - USABLE_SAMPLES + CIRCULAR_BUFFER_SIZE) % CIRCULAR_BUFFER_SIZE;
        for (let i = 0; i < USABLE_SAMPLES; i++) {
            const idx = (startIdx + i) % CIRCULAR_BUFFER_SIZE;
            if (buffer[idx] !== 0) {
                return true;
            }
        }
    }
    return false;
}

// Reset visualization state
function resetVisualizationState() {
    circularBuffers.forEach(buffer => buffer.fill(0));
    vuLevels.fill(0);
    needleAngles.fill(ANGLE_RANGE[0]);
    needleVelocities.fill(0);
    writePosition = 0;
    traceStreams = null;
    window.logmsg('resetVisualizationState: Cleared visualization state', 2);
}

// Global visualization utilities
window.viz = window.viz || {};
window.viz.resetVisualizationState = resetVisualizationState;
window.viz.isAudioActive = isAudioActive;
window.startVisualizations = startVisualizations;

// Expose zoom and reset functions to global scope for onclick handlers
window.zoomWaveformIn = zoomWaveformIn;
window.zoomWaveformOut = zoomWaveformOut;
window.resetView = resetView;

let lastPhysicsTime = performance.now()