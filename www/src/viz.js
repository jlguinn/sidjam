// viz.js
import { getPlayerState } from './brackets.js';
import { streamer } from './player.js'; // Import the streamer instance

// --- Configuration ---
const WAVEFORM_BG_COLOR = '#333333';
const TARGET_FPS = 60;
const FRAME_TIME_LIMIT = 1000 / TARGET_FPS; // ~16.67ms
const DATA_UPDATE_INTERVAL = 50; // Update waveform data every 50ms (20Hz)

// VU Meter specific config
const VU_LABEL_IMG = new Image();
VU_LABEL_IMG.src = '../image/vu_label.png';
const VU_FRAME_IMG = new Image();
VU_FRAME_IMG.src = '../image/vu_frame.png';
const ANGLE_RANGE = [-50, 43]; // In degrees
const NEEDLE_LENGTH = 50;
const VU_METER_COUNT = 3;
const PEAK_FALLOFF = 0.005; // How fast the peak falls per frame.
let smoothedRms = new Float32Array(VU_METER_COUNT).fill(0);

// --- State Variables ---
let isVisualizationActive = false;
let animationFrameId;
let lastRenderTime = 0;
let lastDataUpdateTime = 0;
let waveformData = [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)]; // Increase array size to 4
let needleAngles = new Float32Array(VU_METER_COUNT).fill(ANGLE_RANGE[0]);
let peakLevels = new Float32Array(VU_METER_COUNT).fill(0);
let peakCounters = new Uint8Array(VU_METER_COUNT).fill(0);
const PEAK_HOLD_FRAMES = 60; // How many frames the peak line should 'hold' (60fps = ~1s)

// --- VoiceDisplay Instances ---
let voiceDisplay1, voiceDisplay2, voiceDisplay3, digiDisplay;

// --- Core Animation Loop ---
function animationLoop(timestamp) {
    if (!isVisualizationActive) return;

    animationFrameId = requestAnimationFrame(animationLoop);

    const elapsed = timestamp - lastRenderTime;
    if (elapsed < FRAME_TIME_LIMIT) return;

    const playerState = getPlayerState();
    const now = performance.now();

    // Throttle data fetching to reduce processing load
    if (now - lastDataUpdateTime > DATA_UPDATE_INTERVAL) {
        updateWaveformData();
        updateVUMeterPhysics();
        lastDataUpdateTime = now;
    }

    // Render visualizations if they are active
    // Waveform drawing is now handled by the VoiceDisplay instances themselves.
    if (playerState.isVUActive) {
        drawVUMeter('vu1-canvas', 0);
        drawVUMeter('vu2-canvas', 1);
        drawVUMeter('vu3-canvas', 2);
    }
    if (playerState.isBarActive) {
        drawAmplitudeBar('amp1-canvas', 0);
        drawAmplitudeBar('amp2-canvas', 1);
        drawAmplitudeBar('amp3-canvas', 2);
    }

    lastRenderTime = timestamp;
}

// --- Data Fetching and Processing ---
function updateWaveformData() {
    if (!streamer || !window.player || window.player.isPaused()) {
        // Reset all 4 channels
        waveformData = [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];
        return;
    }
    // Fetch data for all 4 channels
    for (let i = 0; i < 4; i++) {
        waveformData[i] = streamer.getData(i);
    }
}

function calculateRMS(data) {
    if (!data || data.length === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
        sumSquares += data[i] * data[i];
    }
    return Math.sqrt(sumSquares / data.length);
}

function updateVUMeterPhysics() {
    for (let i = 0; i < VU_METER_COUNT; i++) {
        let targetAngle;

        // If the player is paused, force the target to the resting position.
        if (!window.player || window.player.isPaused()) {
            targetAngle = ANGLE_RANGE[0];
        } else {
            // Otherwise, calculate the angle from the audio data as normal.
            const rms = calculateRMS(waveformData[i]);
            const level = Math.min(rms, 1.0);
            const db = level > 0 ? 20 * Math.log10(level) : -100;

            // The scaling factor below was changed from 130 to 110 to give the needle a fuller swing.
            targetAngle = ANGLE_RANGE[0] + ((db + 100) / 110) * (ANGLE_RANGE[1] - ANGLE_RANGE[0]);
            targetAngle = Math.max(ANGLE_RANGE[0], Math.min(ANGLE_RANGE[1], targetAngle));
        }
         
        // make needle fall back gracefully.
        // The second value (the decay) has been increased from 0.07 to 0.35 for a more lively needle.
        const smoothing = needleAngles[i] < targetAngle ? 0.9 : 0.35;
        needleAngles[i] += (targetAngle - needleAngles[i]) * smoothing;
    }
}

// --- Drawing Functions ---

function drawVUMeter(canvasId, voiceIdx) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const pivotX = width / 2;
    const pivotY = height * 0.9;

    ctx.clearRect(0, 0, width, height);
    if (VU_LABEL_IMG.complete) ctx.drawImage(VU_LABEL_IMG, 0, 0, width, height);

    const angleRad = (needleAngles[voiceIdx] * Math.PI) / 180;
    const endX = pivotX + NEEDLE_LENGTH * Math.sin(angleRad);
    const endY = pivotY - NEEDLE_LENGTH * Math.cos(angleRad);
    
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (VU_FRAME_IMG.complete) ctx.drawImage(VU_FRAME_IMG, 0, 0, width, height);
}

function drawAmplitudeBar(canvasId, voiceIdx) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    let rms = 0; // Default to 0

    // Only calculate RMS if the player is active and not paused.
    if (window.player && !window.player.isPaused()) {
        rms = calculateRMS(waveformData[voiceIdx]);
    }

    const currentLevel = Math.min(rms, 1.0);
    const db = currentLevel > 0 ? 20 * Math.log10(currentLevel) : -100;
    const normalizedLevel = Math.max(0, (db + 100) / 110);
    const barHeight = normalizedLevel * height;

    // --- Peak Hold Logic ---
    if (normalizedLevel >= peakLevels[voiceIdx]) {
        // New peak reached
        peakLevels[voiceIdx] = normalizedLevel;
        peakCounters[voiceIdx] = PEAK_HOLD_FRAMES; // Reset hold timer
    } else {
        // No new peak, decrement hold timer
        if (peakCounters[voiceIdx] > 0) {
            peakCounters[voiceIdx]--;
        } else {
            // Timer expired, let the peak fall
            peakLevels[voiceIdx] = normalizedLevel;
        }
    }
    const peakY = height - (peakLevels[voiceIdx] * height);
    // --- End Peak Hold Logic ---

    // 1. Draw black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw main amplitude bar
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#00FF00');
    gradient.addColorStop(0.5, '#FFFF00');
    gradient.addColorStop(1, '#FF0000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - barHeight, width, barHeight);
    
    // 3. Draw peak hold bar
    if (peakLevels[voiceIdx] > 0) {
        ctx.fillStyle = '#FFFFFF'; // White peak line
        ctx.fillRect(0, peakY, width, 2); // 2px high line
    }
}

// --- Public Control Functions ---
export function toggleWaveformFreeze(shouldFreeze) {
    const displays = [voiceDisplay1, voiceDisplay2, voiceDisplay3, digiDisplay];
    
    if (!displays[0]) return; // Not initialized yet

    if (shouldFreeze) {
        // Stop the redraw loop by replacing the redraw function with an empty one
        displays.forEach(d => {
            if (d) d.redraw = () => {};
        });
    } else {
        // Restore the original redraw function from the prototype to restart the loop
        displays.forEach(d => {
            if (d) {
                d.redraw = VoiceDisplay.prototype.redraw;
                d.redraw(); // Kick it off again
            }
        });
    }
}


let hasWaveformRendererStarted = false;
export function startWaveformRendering() {
    if (hasWaveformRendererStarted) return; // Ensure it only runs once

    // --- Create VoiceDisplay renderers NOW that the streamer is ready ---
    const useSyncMode = true; // This enables the stable waveform!

    voiceDisplay1 = new VoiceDisplay('voice1-canvas', streamer, () => streamer.getData(0), useSyncMode);
    voiceDisplay2 = new VoiceDisplay('voice2-canvas', streamer, () => streamer.getData(1), useSyncMode);
    voiceDisplay3 = new VoiceDisplay('voice3-canvas', streamer, () => streamer.getData(2), useSyncMode);
    digiDisplay = new VoiceDisplay('digi-canvas', streamer, () => streamer.getData(3), useSyncMode);

    // Customize colors
    voiceDisplay1.setStrokeColor('#00FF00');
    voiceDisplay2.setStrokeColor('#00FF00');
    voiceDisplay3.setStrokeColor('#00FF00');
    digiDisplay.setStrokeColor('#B22222');

    // Kick off the rendering loops
    voiceDisplay1.redraw();
    voiceDisplay2.redraw();
    voiceDisplay3.redraw();
    digiDisplay.redraw();

    hasWaveformRendererStarted = true;
}

export function startVisualizations() {
    if (isVisualizationActive) return;
    window.logmsg('Starting visualizations...', 2);
    isVisualizationActive = true;
    
    Promise.all([
        VU_LABEL_IMG.decode().catch(() => {}),
        VU_FRAME_IMG.decode().catch(() => {})
    ]).then(() => {
        lastRenderTime = performance.now();
        animationLoop(lastRenderTime);
    });
}

export function stopVisualizations() {
    if (!isVisualizationActive) return;
    window.logmsg('Stopping visualizations.', 2);
    isVisualizationActive = false;
    cancelAnimationFrame(animationFrameId);
}

export function resetVisualizationState() {
    stopVisualizations();
    waveformData = [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];
    needleAngles.fill(ANGLE_RANGE[0]);

    // Clear the waveform canvases and draw initial flat lines
    const canvases = ['voice1-canvas', 'voice2-canvas', 'voice3-canvas', 'digi-canvas'];
    canvases.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const { width, height } = canvas;

            // 1. Set background color
            ctx.fillStyle = (id === 'digi-canvas') ? '#808080' : WAVEFORM_BG_COLOR;
            ctx.fillRect(0, 0, width, height);

            // 2. Draw the initial flat line
            const isDigi = (id === 'digi-canvas');
            const midY = height / 2;
            const lineY = isDigi ? 4 : midY; // Digi at top (4px from top), others in middle
            const color = isDigi ? '#B22222' : '#00FF00'; // Brick-red for digi, green for others

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.moveTo(0, lineY);
            ctx.lineTo(width, lineY);
            ctx.stroke();
        }
    });

    // Redraw static state for meters
    drawVUMeter('vu1-canvas', 0);
    drawVUMeter('vu2-canvas', 1);
    drawVUMeter('vu3-canvas', 2);
    drawAmplitudeBar('amp1-canvas', 0);
    drawAmplitudeBar('amp2-canvas', 1);
    drawAmplitudeBar('amp3-canvas', 2);
    window.logmsg('Visualization state reset.', 2);
}

function initialize() {
    // Expose functions to global scope for HTML onclick handlers
    window.startVisualizations = startVisualizations;

    // Expose for player.js
    window.viz = { resetVisualizationState };

    // Wait for critical images to load before performing the initial draw.
    Promise.all([
        VU_LABEL_IMG.decode().catch(() => {}),
        VU_FRAME_IMG.decode().catch(() => {})
    ]).then(() => {
        // Initial draw of static elements.
        resetVisualizationState();

        // Set the digi canvas background color. This was missed in the last update.
        document.getElementById('digi-canvas').style.backgroundColor = '#808080';
        
        // NOTE: The VoiceDisplay setup is now handled by startWaveformRendering().
    });
}

initialize();