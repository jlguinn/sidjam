// viz.js
import { getPlayerState, updatePlayerState } from './brackets.js';
import { streamer } from './player.js'; // Import the streamer instance

// --- Configuration ---
const WAVEFORM_BG_COLOR = '#333333';
const WAVEFORM_STROKE_COLOR = '#00FF00';
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

// --- State Variables ---
let isVisualizationActive = false;
let animationFrameId;
let lastRenderTime = 0;
let lastDataUpdateTime = 0;
let waveformData = [new Float32Array(0), new Float32Array(0), new Float32Array(0)];
let needleAngles = new Float32Array(VU_METER_COUNT).fill(ANGLE_RANGE[0]);
let zoomFactor = 46.13; // Default zoom

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
        updateVUMeterPhysics(playerState);
        lastDataUpdateTime = now;
    }

    // Render visualizations if they are active
    if (playerState.isWaveformActive) {
        drawVoiceWaveform('voice1-canvas', 0);
        drawVoiceWaveform('voice2-canvas', 1);
        drawVoiceWaveform('voice3-canvas', 2);
    }
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
        waveformData = [new Float32Array(0), new Float32Array(0), new Float32Array(0)];
        return;
    }
    for (let i = 0; i < 3; i++) {
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
        const rms = calculateRMS(waveformData[i]);
        const level = Math.min(rms * 2.0, 1.0); // Apply scaling factor
        const db = level > 0 ? 20 * Math.log10(level) : -100;
        
        // Map dB to angle
        let targetAngle = ANGLE_RANGE[0] + ((db + 100) / 130) * (ANGLE_RANGE[1] - ANGLE_RANGE[0]);
        targetAngle = Math.max(ANGLE_RANGE[0], Math.min(ANGLE_RANGE[1], targetAngle));

        // Simple exponential smoothing for needle movement
        const smoothing = needleAngles[i] < targetAngle ? 0.9 : 0.07; // Fast attack, slow decay
        needleAngles[i] += (targetAngle - needleAngles[i]) * smoothing;
    }
}


// --- Drawing Functions ---

function drawVoiceWaveform(canvasId, voiceIdx) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const midY = height / 2;
    const data = waveformData[voiceIdx];

    ctx.fillStyle = WAVEFORM_BG_COLOR;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = WAVEFORM_STROKE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    if (!data || data.length === 0) {
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();
        return;
    }

    const visibleSamples = Math.floor(data.length / zoomFactor);
    const step = width / visibleSamples;

    let maxAmplitude = 0;
    for (let i = 0; i < visibleSamples; i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(data[i]));
    }
    const scale = maxAmplitude > 0 ? (height / 2) * 0.9 / maxAmplitude : 1;

    ctx.moveTo(0, midY);
    for (let i = 0; i < visibleSamples; i++) {
        const y = midY - data[i] * scale;
        ctx.lineTo(i * step, y);
    }
    ctx.stroke();
}

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
    const rms = calculateRMS(waveformData[voiceIdx]);
    const level = Math.min(rms * 2.0, 1.0);
    const db = level > 0 ? 20 * Math.log10(level) : -100;
    const normalizedLevel = Math.max(0, (db + 100) / 110);
    const barHeight = normalizedLevel * height;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#00FF00');
    gradient.addColorStop(0.5, '#FFFF00');
    gradient.addColorStop(1, '#FF0000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - barHeight, width, barHeight);
}

// --- Public Control Functions ---

export function startVisualizations() {
    if (isVisualizationActive) return;
    window.logmsg('Starting visualizations...', 2);
    isVisualizationActive = true;
    
    const state = getPlayerState();
    zoomFactor = state.zoomFactor || 46.13;
    
    // Ensure images are loaded before first draw
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
    waveformData = [new Float32Array(0), new Float32Array(0), new Float32Array(0)];
    needleAngles.fill(ANGLE_RANGE[0]);
    // Redraw static state
    drawVoiceWaveform('voice1-canvas', 0);
    drawVoiceWaveform('voice2-canvas', 1);
    drawVoiceWaveform('voice3-canvas', 2);
    drawVUMeter('vu1-canvas', 0);
    drawVUMeter('vu2-canvas', 1);
    drawVUMeter('vu3-canvas', 2);
    drawAmplitudeBar('amp1-canvas', 0);
    drawAmplitudeBar('amp2-canvas', 1);
    drawAmplitudeBar('amp3-canvas', 2);
    window.logmsg('Visualization state reset.', 2);
}

// --- Zoom Controls ---
function updateZoom() {
    updatePlayerState({ zoomFactor });
    updateZoomButtonStates();
}

export function zoomWaveformIn() {
    zoomFactor = Math.min(zoomFactor * 1.125, 8820);
    updateZoom();
}

export function zoomWaveformOut() {
    zoomFactor = Math.max(zoomFactor / 1.125, 1);
    updateZoom();
}

export function resetView() {
    zoomFactor = 46.13;
    updateZoom();
}

function updateZoomButtonStates() {
    const zoomOutButton = document.getElementById('zoom-out-button');
    const zoomInButton = document.getElementById('zoom-in-button');
    const resetButton = document.getElementById('reset-view-button');
    if (!zoomOutButton || !zoomInButton || !resetButton) return;
    
    zoomOutButton.disabled = zoomFactor <= 1;
    zoomInButton.disabled = zoomFactor >= 8820;
    resetButton.disabled = Math.abs(zoomFactor - 46.13) < 0.01;
}

// --- Initialization ---
function initialize() {
    // Expose functions to global scope for HTML onclick handlers
    window.zoomWaveformIn = zoomWaveformIn;
    window.zoomWaveformOut = zoomWaveformOut;
    window.resetView = resetView;
    window.startVisualizations = startVisualizations;

    // Expose for player.js
    window.viz = { resetVisualizationState };

    // Initial draw of static elements
    resetVisualizationState(); 
    updateZoomButtonStates();
}

initialize();