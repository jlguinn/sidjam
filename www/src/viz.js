// viz.js - Real-time oscilloscope waveform and VU meter visualizations for SID JAm

// Static buffer for waveform samples
const BUFFER_SIZE = 150; // ~0.34ms at 44100 Hz, shows ~2.5 cycles at 1 kHz
const TARGET_FPS = 172; // Emulator tick rate
const TIME_LIMIT = 1000 / TARGET_FPS; // Time per frame in ms

// VU meter configuration
/* Tweakable Parameters for Needle Physics
 * - ATTACK_RATE (Baseline: 0.006): Time (seconds) for needle attack (~3–6ms). Lower (e.g., 0.004) for snappier peaks (~2–4ms), higher (e.g., 0.01) for softer (~5–10ms). Range: 0.002–0.02.
 * - DECAY_RATE (Baseline: 0.07): Time (seconds) for needle decay (~50–100ms). Lower (e.g., 0.05) for faster decay (~20–30ms), higher (e.g., 0.1) for floatier (~100–150ms). Range: 0.01–0.2.
 * - OVERSHOOT (Baseline: 0.15): Overshoot percentage for bouncy swings (~4.5°–9°). Lower (e.g., 0.1) for subtler bounce (~3°–6°), higher (e.g., 0.2) for livelier (~6°–12°). Range: 0.05–0.3.
 * - damping (Baseline: 0.95): Damping factor in updateNeedlePhysics. Higher (e.g., 0.98) for tighter 1–2 bounces, lower (e.g., 0.9) for looser 2–3 bounces. Range: 0.7–0.99.
 * - angleDiff Threshold (Baseline: -20): In updateNeedlePhysics, triggers smoothing for large drops. Stricter (e.g., -30) for smoother Voice 2 silence, looser (e.g., -10) for more physics. Range: -10 to -50.
 * Safe Inline Adjustments:
 * - alphaDecay: In updateNeedlePhysics, adjust `Math.min(1.0, dt / DECAY_RATE)` to `Math.min(0.5, dt / DECAY_RATE)` for slower smoothing (~2x decay time).
 * - Dynamic k: In updateNeedlePhysics, modify `k *= 0.5` for large drops to `k *= 0.3` for softer decays or `k *= 0.7` for more bounce.
 * Notes: Test tweaks with ~10s playback, check logs for pegging (>50°) or dips (<-30°). Baseline values optimized for 70s VU meter vibe with ~6 Hz bassline.
 */
const VU_METER_COUNT = 3; // One per voice
const NEEDLE_LENGTH = 40; // Pixels, scaled for 80x60px canvas
const ANGLE_RANGE = [-60, 60]; // Degrees, -100 dB to 0 dB
const ATTACK_RATE = 0.009; // Seconds, for spring strength (~3–6ms attack)
const DECAY_RATE = 0.07; // Seconds, for spring strength (~50–100ms decay)
const OVERSHOOT = 0.15; // 15% overshoot for controlled 70s bounce
const NEEDLE_COLOR = '#FF0000'; // Red needle
const GLOW_COLOR = '#FFFF00'; // Yellow glow
const BACKGROUND_COLOR = '#333333'; // Dark grey
const LOG_INTERVAL = 0.01; // Seconds, log 100 times per second (10ms)
const ZERO_TICK_THRESHOLD = 2; // Stop logging after 2 consecutive all-zero ticks

let logTimer = 0; // Track time for logging
let logCounter = 0; // Frame counter for throttling
let zeroTickCount = 0; // Count consecutive all-zero ticks


const vuLabelImage = new Image();
vuLabelImage.src = '../image/vu_label.png'; // Adjust path if needed
const vuFrameImage = new Image();
vuFrameImage.src = '../image/vu_frame.png'; // Adjust path if needed
let isLabelImageLoaded = false;
let isFrameImageLoaded = false;

vuLabelImage.onload = () => {
    isLabelImageLoaded = true;
    window.logmsg('VU label image loaded successfully', 1);
};
vuLabelImage.onerror = () => {
    window.logmsg('Failed to load VU label image', 1);
};
vuFrameImage.onload = () => {
    isFrameImageLoaded = true;
    window.logmsg('VU frame image loaded successfully', 1);
};
vuFrameImage.onerror = () => {
    window.logmsg('Failed to load VU frame image', 1);
};


const voiceBuffers = [
    new Float32Array(BUFFER_SIZE), // Voice 1
    new Float32Array(BUFFER_SIZE), // Voice 2
    new Float32Array(BUFFER_SIZE)  // Voice 3
];
const vuLevels = new Float32Array(VU_METER_COUNT); // RMS amplitude
const needleAngles = new Float32Array(VU_METER_COUNT); // Current angle
const needleVelocities = new Float32Array(VU_METER_COUNT); // Physics velocity

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
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Check player state
    const player = window.player;
    if (!player || !player._isSongReady) {
        voiceBuffers.forEach(buffer => buffer.fill(0));
        vuLevels.fill(0);
        needleAngles.fill(ANGLE_RANGE[0]);
        needleVelocities.fill(0);
        return;
    }

    // Draw waveform (use last buffer state, even if paused)
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

// Draw VU meter for a given voice
function drawVUMeter(canvasId, voiceIdx) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        window.logmsg(`VU canvas with ID ${canvasId} not found`, 1);
        return;
    }
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // Now 120
    const height = canvas.height; // Now 70
    const pivotX = width / 2; // Now 60
    const pivotY = height * 0.9; // Now 70 * 0.9 = 63px (previously 52.2px)

    ctx.clearRect(0, 0, width, height);
    if (isLabelImageLoaded) {
        ctx.drawImage(vuLabelImage, 0, 0, width, height);
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
        window.logmsg('SIDBackendAdapter not ready for waveform data', 1);
        voiceBuffers.forEach(buffer => buffer.fill(0));
        vuLevels.fill(0);
        return;
    }

    if (!traceStreams || traceStreams.length < 3) {
        window.logmsg('Trace streams not initialized or insufficient', 1);
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
        window.logmsg(`Error fetching waveform data: ${error.message}`, 1);
        voiceBuffers.forEach(buffer => buffer.fill(0));
        vuLevels.fill(0);
    }
}

// Update needle physics
function updateNeedlePhysics() {
    const dt = 1 / 60; // Time step for 60 FPS (~0.0167s)
    const kAttack = 100 / ATTACK_RATE; // Strong spring for attack
    const kDecay = 50 / DECAY_RATE; // Moderate spring for decay
    const damping = 0.95; // Tighter damping for control

    logTimer += dt;
    logCounter++;
    if (logTimer >= LOG_INTERVAL) {
        // Check if all voices are zero
        const allZero = vuLevels.every(level => level === 0);
        if (allZero) {
            zeroTickCount++;
        } else {
            zeroTickCount = 0; // Reset if any voice is active
        }

        // Log only if we haven't hit the zero-tick threshold
        if (zeroTickCount < ZERO_TICK_THRESHOLD) {
            for (let i = 0; i < VU_METER_COUNT; i++) {
                const db = vuLevels[i] > 0 ? 20 * Math.log10(vuLevels[i]) : -100; // -100 dB to 0 dB
                const targetAngle = ANGLE_RANGE[0] + (db + 100) / 100 * (ANGLE_RANGE[1] - ANGLE_RANGE[0]); // Map -100 dB to 0 dB
                // window.logmsg(`Voice ${i + 1}: Angle=${needleAngles[i].toFixed(1)}°, Magnitude=${vuLevels[i].toFixed(3)}, TargetAngle=${targetAngle.toFixed(1)}°`, 2);
            }
        }

        logTimer = 0; // Reset timer
        logCounter = 0;
    }

    const player = window.player;
    if (!player || !player._isSongReady) {
        return; // Skip physics updates
    }

    for (let i = 0; i < VU_METER_COUNT; i++) {
        // Map amplitude to angle (logarithmic scale)
        const level = vuLevels[i];
        const db = level > 0 ? 20 * Math.log10(level) : -100; // -100 dB to 0 dB
        const targetAngle = ANGLE_RANGE[0] + (db + 100) / 100 * (ANGLE_RANGE[1] - ANGLE_RANGE[0]); // Map -100 dB to 0 dB

        const angleDiff = targetAngle - needleAngles[i];
        if (angleDiff < -20) { // Smoothing for very large drops
            const alphaDecay = Math.min(1.0, dt / DECAY_RATE);
            needleAngles[i] = needleAngles[i] + alphaDecay * (targetAngle - needleAngles[i]);
            needleVelocities[i] = 0; // Reset velocity
        } else {
            // Use physics for attack and small decays
            const currentAngle = needleAngles[i];
            const velocity = needleVelocities[i];
            const k = currentAngle < targetAngle ? kAttack : kDecay;
            const acceleration = k * angleDiff * (1 + OVERSHOOT) - damping * velocity;
            needleVelocities[i] += acceleration * dt;
            needleAngles[i] += needleVelocities[i] * dt;
        }

        // Clamp angle
        needleAngles[i] = Math.max(ANGLE_RANGE[0], Math.min(ANGLE_RANGE[1], needleAngles[i]));
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
                traceStreams.push(streamsArray[i] >> 1);
            }
            // window.logmsg(`Initialized ${traceStreams.length} trace streams`, 1);
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

// Animation loop
let lastRenderTime = 0;
let refreshCounter = 0;

function updateViz() {
    const now = performance.now();
    const renderTime = now - lastRenderTime;

    // Update at 60 FPS
    if (renderTime >= 1000 / 60) {
        updateVoiceBuffers();
        updateNeedlePhysics();
        drawVoiceWaveform('voice1-canvas', 0);
        drawVoiceWaveform('voice2-canvas', 1);
        drawVoiceWaveform('voice3-canvas', 2);
        drawVUMeter('vu1-canvas', 0);
        drawVUMeter('vu2-canvas', 1);
        drawVUMeter('vu3-canvas', 2);
        lastRenderTime = now;
    }

    requestAnimationFrame(updateViz);
}

// Initialize visualizations
function initVisualizations() {
    window.logmsg('Initializing real-time oscilloscope and VU meter visualizations', 1);
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

    if (!initTraceStreams()) {
        window.logmsg('Failed to initialize trace streams, visualizations disabled', 1);
        return;
    }
    window.logmsg(`External ticker enabled: ${!!window.player._externalTicker}`, 1);

    voiceBuffers.forEach(buffer => buffer.fill(0));
    vuLevels.fill(0);
    needleAngles.fill(ANGLE_RANGE[0]);
    needleVelocities.fill(0);
    updateViz();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVisualizations);
} else {
    initVisualizations();
}