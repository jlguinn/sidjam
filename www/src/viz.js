import { updateWaveformVisibility, updateVUMeterVisibility } from './ui.js';
import { getPlayerState } from './brackets.js';

// viz.js - Real-time oscilloscope waveform and VU meter visualizations for SID JAm

// Static buffer for waveform samples
const BUFFER_SIZE = 150; // ~0.34ms at 44100 Hz, shows ~2.5 cycles at 1 kHz
const TARGET_FPS = 60; // Adjusted to match rendering loop (previously 172)
const TIME_LIMIT = 1000 / TARGET_FPS; // Time per frame in ms (~16.67ms at 60 FPS)

// VU meter configuration
const VU_METER_COUNT = 3; // One per voice
const NEEDLE_LENGTH = 50; // Pixels, scaled for 100x57px canvas
const ANGLE_RANGE = [-50, 50]; // Degrees, -100 dB to 0 dB
const ATTACK_RATE = 0.009; // Seconds, for spring strength (~3–6ms attack)
const DECAY_RATE = 0.07; // Seconds, for spring strength (~50–100ms decay)
const OVERSHOOT = 0.15; // 15% overshoot for controlled 70s bounce
const BACKGROUND_COLOR = '#333333'; // Dark grey (for waveform canvas)
const FALLBACK_COLOR = '#555555'; // Fallback color if images fail to load
const LOG_INTERVAL = 0.1; // Seconds, log 10 times per second (100ms, reduced from 0.01)
const ZERO_TICK_THRESHOLD = 2; // Stop logging after 2 consecutive all-zero ticks

let logTimer = 0; // Track time for logging
let logCounter = 0; // Frame counter for throttling
let zeroTickCount = 0; // Count consecutive all-zero ticks

const vuLabelImage = new Image();
vuLabelImage.src = '../image/vu_label.png';
const vuFrameImage = new Image();
vuFrameImage.src = '../image/vu_frame.png';
let isLabelImageLoaded = false;
let isFrameImageLoaded = false;

vuLabelImage.onload = () => {
    isLabelImageLoaded = true;
    // window.logmsg('VU label image loaded successfully', 1);
    renderStaticVUMeters();
};
vuLabelImage.onerror = () => {
    window.logmsg('Failed to load VU label image', 0);
};
vuFrameImage.onload = () => {
    isFrameImageLoaded = true;
    // window.logmsg('VU frame image loaded successfully', 1);
    renderStaticVUMeters();
};
vuFrameImage.onerror = () => {
    window.logmsg('Failed to load VU frame image', 0);
};

const voiceBuffers = [
    new Float32Array(BUFFER_SIZE), // Voice 1
    new Float32Array(BUFFER_SIZE), // Voice 2
    new Float32Array(BUFFER_SIZE)  // Voice 3
];
const vuLevels = new Float32Array(VU_METER_COUNT); // RMS amplitude
const needleAngles = new Float32Array(VU_METER_COUNT); // Current angle
const needleVelocities = new Float32Array(VU_METER_COUNT); // Physics velocity

let traceStreams = null;
let isVisualizationActive = false; // Flag to control animation loop

// Draw static oscilloscope waveform (flatline)
function drawStaticWaveform(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        // window.logmsg(`drawStaticWaveform: Canvas with ID ${canvasId} not found`, 0);
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

// Draw static VU meter (needle at zero)
function drawStaticVUMeter(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        window.logmsg(`drawStaticVUMeter: VU canvas with ID ${canvasId} not found`, 0);
        return;
    }
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // 100
    const height = canvas.height; // 57
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
    ctx.strokeStyle = '#000000'; // Black needle
    ctx.lineWidth = 1; // Skinny needle
    ctx.stroke();

    if (isFrameImageLoaded) {
        ctx.drawImage(vuFrameImage, 0, 0, width, height);
    }
}

// Render static visualizations for all canvases
function renderStaticVisualizations() {
    drawStaticWaveform('voice1-canvas');
    drawStaticWaveform('voice2-canvas');
    drawStaticWaveform('voice3-canvas');
    renderStaticVUMeters();
    // Apply initial visibility states
    const playerState = getPlayerState();
    updateWaveformVisibility(playerState.isWaveformActive);
    updateVUMeterVisibility(playerState.isVUActive);
}

// Render static VU meters (called separately to handle image loading)
function renderStaticVUMeters() {
    const isVUActive = getPlayerState().isVUActive;
    if (isVUActive) {
        drawStaticVUMeter('vu1-canvas');
        drawStaticVUMeter('vu2-canvas');
        drawStaticVUMeter('vu3-canvas');
    }
}

// Draw dynamic oscilloscope waveform for a given voice
function drawVoiceWaveform(canvasId, voiceIdx) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        window.logmsg(`drawVoiceWaveform: Canvas with ID ${canvasId} not found`, 0);
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
    if (!player || !player._isSongReady) {
        voiceBuffers.forEach(buffer => buffer.fill(0));
        vuLevels.fill(0);
        needleAngles.fill(ANGLE_RANGE[0]);
        needleVelocities.fill(0);
        return;
    }

    ctx.beginPath();
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;

    const buffer = voiceBuffers[voiceIdx];
    let maxAmplitude = 0;
    for (let i = 0; i < BUFFER_SIZE; i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(buffer[i]));
    }
    const scale = maxAmplitude > 0 ? (0.8 * height / 2) / maxAmplitude : 1;

    for (let x = 0; x < width; x++) {
        const t = x / (width - 1);
        const sampleIdx = t * (BUFFER_SIZE - 1);
        const i0 = Math.floor(sampleIdx);
        const i1 = Math.min(i0 + 1, BUFFER_SIZE - 1);
        const frac = sampleIdx - i0;
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

// Draw dynamic VU meter for a given voice
function drawVUMeter(canvasId, voiceIdx) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        window.logmsg(`drawVUMeter: VU canvas with ID ${canvasId} not found`, 0);
        return;
    }
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // 100
    const height = canvas.height; // 57
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

// Update voice buffers and VU levels
function updateVoiceBuffers() {
    const player = window.player;
    if (!player || !player._isSongReady) {
        voiceBuffers.forEach(buffer => buffer.fill(0));
        vuLevels.fill(0);
        needleAngles.fill(ANGLE_RANGE[0]);
        needleVelocities.fill(0);
        return;
    }

    if (player.isPaused()) {
        vuLevels.fill(0); // Set to 0 for needle decay, keep voiceBuffers
        return;
    }

    const adapter = player._backendAdapter;
    if (!adapter || !adapter.isAdapterReady()) {
        window.logmsg('updateVoiceBuffers: SIDBackendAdapter not ready for waveform data', 0);
        voiceBuffers.forEach(buffer => buffer.fill(0));
        vuLevels.fill(0);
        return;
    }

    if (!traceStreams || traceStreams.length < 3) {
        window.logmsg('updateVoiceBuffers: Trace streams not initialized or insufficient', 0);
        voiceBuffers.forEach(buffer => buffer.fill(0));
        vuLevels.fill(0);
        return;
    }

    const Module = window.backend_SID.Module;
    try {
        const SAMPLE_WINDOW = 20;
        for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
            const stream = traceStreams[voiceIdx];
            let triggerIdx = 0;
            for (let i = 0; i < SAMPLE_WINDOW - 1; i++) {
                const sample0 = Module.HEAP16[stream + i] / 32768;
                const sample1 = Module.HEAP16[stream + i + 1] / 32768;
                if (sample0 <= 0 && sample1 > 0) {
                    triggerIdx = i + 1;
                    break;
                }
            }
            let rmsSum = 0;
            for (let i = 0; i < BUFFER_SIZE; i++) {
                const idx = triggerIdx + i;
                const sample = Module.HEAP16[stream + idx] / 32768;
                voiceBuffers[voiceIdx][i] = sample;
                rmsSum += sample * sample;
            }
            const rms = Math.sqrt(rmsSum / BUFFER_SIZE) * 0.2; // Moderate scaling for SID amplitudes
            vuLevels[voiceIdx] = Math.min(rms, 1.0);
        }
    } catch (error) {
        window.logmsg(`updateVoiceBuffers: Error fetching waveform data: ${error.message}`, 0);
        voiceBuffers.forEach(buffer => buffer.fill(0));
        vuLevels.fill(0);
    }
}

// Update needle physics
function updateNeedlePhysics() {
    const dt = 1 / TARGET_FPS; // Time step aligned with TARGET_FPS
    const kAttack = 100 / ATTACK_RATE; // Strong spring for attack
    const kDecay = 50 / DECAY_RATE; // Moderate spring for decay
    const damping = 0.95; // Tighter damping for control

    logTimer += dt;
    logCounter++;
    if (logTimer >= LOG_INTERVAL) {
        const allZero = vuLevels.every(level => level === 0);
        if (allZero) {
            zeroTickCount++;
        } else {
            zeroTickCount = 0;
        }

        if (zeroTickCount < ZERO_TICK_THRESHOLD) {
            for (let i = 0; i < VU_METER_COUNT; i++) {
                const db = vuLevels[i] > 0 ? 20 * Math.log10(vuLevels[i]) : -100;
                const targetAngle = ANGLE_RANGE[0] + (db + 100) / 100 * (ANGLE_RANGE[1] - ANGLE_RANGE[0]);
                // window.logmsg(`Voice ${i + 1}: Angle=${needleAngles[i].toFixed(1)}°, Magnitude=${vuLevels[i].toFixed(3)}, TargetAngle=${targetAngle.toFixed(1)}°`, 2);
            }
        }

        logTimer = 0;
        logCounter = 0;
    }

    const player = window.player;
    if (!player || !player._isSongReady) {
        return;
    }

    for (let i = 0; i < VU_METER_COUNT; i++) {
        const level = vuLevels[i];
        const db = level > 0 ? 20 * Math.log10(level) : -100;
        const targetAngle = ANGLE_RANGE[0] + (db + 100) / 100 * (ANGLE_RANGE[1] - ANGLE_RANGE[0]);

        const angleDiff = targetAngle - needleAngles[i];
        if (angleDiff < -20) {
            const alphaDecay = Math.min(1.0, dt / DECAY_RATE);
            needleAngles[i] = needleAngles[i] + alphaDecay * (targetAngle - needleAngles[i]);
            needleVelocities[i] = 0;
        } else {
            const currentAngle = needleAngles[i];
            const velocity = needleVelocities[i];
            const k = currentAngle < targetAngle ? kAttack : kDecay;
            const acceleration = k * angleDiff * (1 + OVERSHOOT) - damping * velocity;
            needleVelocities[i] += acceleration * dt;
            needleAngles[i] += needleVelocities[i] * dt;
        }

        needleAngles[i] = Math.max(ANGLE_RANGE[0], Math.min(ANGLE_RANGE[1], needleAngles[i]));
    }
}

// Initialize trace streams
function initTraceStreams() {
    const player = window.player;
    if (!player || !player._backendAdapter) {
        window.logmsg('initTraceStreams: ScriptNodePlayer not ready for trace streams', 0);
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
            }
            // window.logmsg(`Initialized ${traceStreams.length} trace streams`, 1);
            return true;
        } else {
            window.logmsg(`Insufficient trace streams: ${numStreams}`, 0);
            return false;
        }
    } catch (error) {
        window.logmsg(`initTraceStreams: Error initializing trace streams: ${error.message}`, 0);
        return false;
    }
}

// Animation loop
let lastRenderTime = 0;

function updateViz() {
    if (!isVisualizationActive) {
        window.logmsg('updateViz: Visualization loop stopped: isVisualizationActive is false', 2);
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
        if (isWaveformActive) {
            drawVoiceWaveform('voice1-canvas', 0);
            drawVoiceWaveform('voice2-canvas', 1);
            drawVoiceWaveform('voice3-canvas', 2);
        }
        if (isVUActive) {
            drawVUMeter('vu1-canvas', 0);
            drawVUMeter('vu2-canvas', 1);
            drawVUMeter('vu3-canvas', 2);
        }
        lastRenderTime = now;
    }

    requestAnimationFrame(updateViz);
}

// Start dynamic visualizations (called from player.js)
function startVisualizations() {
    // window.logmsg('Starting real-time oscilloscope and VU meter visualizations', 1);
    if (!window.player) {
        window.logmsg('startVisualizations: window.player not defined, retrying initialization', 0);
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
                window.logmsg('startVisualizations: Max retries reached for window.player initialization, visualizations disabled', 0);
            }
        };
        retryInit();
        return;
    }

    if (!window.player._backendAdapter) {
        window.logmsg('startVisualizations: ScriptNodePlayer backend adapter not ready', 0);
        return;
    }

    let retryCount = 0;
    const maxRetries = 12;
    const retryInterval = 300;

    function attemptTraceStreamInit() {
        if (initTraceStreams()) {
            // window.logmsg(`External ticker enabled: ${!!window.player._externalTicker}`, 1);
            voiceBuffers.forEach(buffer => buffer.fill(0));
            vuLevels.fill(0);
            needleAngles.fill(ANGLE_RANGE[0]);
            needleVelocities.fill(0);
            isVisualizationActive = true;
            lastRenderTime = performance.now();
            updateViz();
            // Apply initial waveform visibility
            updateWaveformVisibility(getPlayerState().isWaveformActive);
        } else if (retryCount < maxRetries) {
            retryCount++;
            window.logmsg(`Trace streams not ready, retrying in ${retryInterval}ms (${retryCount}/${maxRetries})`, 1);
            setTimeout(attemptTraceStreamInit, retryInterval);
        } else {
            window.logmsg('Max retries reached, visualizations disabled', 0);
        }
    }

    attemptTraceStreamInit();
}

// Make startVisualizations globally accessible
window.startVisualizations = startVisualizations;

// Initialize static visualizations on page load
function initStaticVisualizations() {
    // window.logmsg('Initializing static oscilloscope and VU meter visualizations', 1);
    renderStaticVisualizations();
}

// Start static visualizations immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStaticVisualizations);
} else {
    initStaticVisualizations();
}


export function isAudioActive() {
    if (!traceStreams || !window.player || !window.player._isSongReady) {
        return false; // No audio if player or streams aren't ready
    }
    for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
        const buffer = voiceBuffers[voiceIdx];
        for (let i = 0; i < BUFFER_SIZE; i++) {
            if (buffer[i] !== 0) {
                return true; // Non-zero sample indicates audio
            }
        }
    }
    return false; // No audio detected
}

// Make isAudioActive globally accessible
window.viz = window.viz || {};
window.viz.isAudioActive = isAudioActive;