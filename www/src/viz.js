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

// --- State Variables ---
let isVisualizationActive = false;
let animationFrameId;
let lastRenderTime = 0;
let lastDataUpdateTime = 0;
let waveformData = [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];
let needleAngles = new Float32Array(VU_METER_COUNT).fill(ANGLE_RANGE[0]);

// Peak-hold state
let peakLevels = new Float32Array(VU_METER_COUNT).fill(0);
let peakCounters = new Uint8Array(VU_METER_COUNT).fill(0);
const PEAK_HOLD_FRAMES = 60; // How many frames the peak line should 'hold' (60fps = ~1s)
const PEAK_FALLOFF = 0.005; // How fast the peak falls per frame.

// --- VoiceDisplay Instances ---
let voiceDisplay1, voiceDisplay2, voiceDisplay3, digiDisplay;

// --- Core Animation Loop ---
function animationLoop(timestamp) {
    if (!isVisualizationActive) return;
    animationFrameId = requestAnimationFrame(animationLoop);

    if (!hasWaveformRendererStarted && window.player && !window.player.isPaused()) {
        startWaveformRendering();
    }

    const elapsed = timestamp - lastRenderTime;
    if (elapsed < FRAME_TIME_LIMIT) return;

    const playerState = getPlayerState();
    const now = performance.now();

    if (now - lastDataUpdateTime > DATA_UPDATE_INTERVAL) {
        updateWaveformData();
        updateVUMeterPhysics();
        lastDataUpdateTime = now;
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
        waveformData = [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];
        return;
    }
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
        
        // Get the mute button for the current voice (voices are 1-indexed in the DOM)
        const voiceButton = document.getElementById(`voice${i + 1}`);
        const isMuted = voiceButton && voiceButton.getAttribute('data-state') === 'off';

        if (!window.player || window.player.isPaused() || isMuted) { // Check if muted here
            targetAngle = ANGLE_RANGE[0]; // Force to resting position
        } else {
            const rms = calculateRMS(waveformData[i]);
            
            // Add a threshold to prevent blips from low-level noise during silence
            const rmsThreshold = 0.005; 
            if (rms < rmsThreshold) {
                targetAngle = ANGLE_RANGE[0];
            } else {
                const level = Math.min(rms, 1.0);
                const db = level > 0 ? 20 * Math.log10(level) : -100;
                targetAngle = ANGLE_RANGE[0] + ((db + 100) / 110) * (ANGLE_RANGE[1] - ANGLE_RANGE[0]);
                targetAngle = Math.max(ANGLE_RANGE[0], Math.min(ANGLE_RANGE[1], targetAngle));
            }
        }
         
        // Use a faster smoothing when needle is returning to rest
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
    
    const voiceButton = document.getElementById(`voice${voiceIdx + 1}`);
    const isMuted = voiceButton && voiceButton.getAttribute('data-state') === 'off';
    
    let rms = 0;
    if (window.player && !window.player.isPaused() && !isMuted) {
        rms = calculateRMS(waveformData[voiceIdx]);
    } else {
        peakLevels[voiceIdx] = 0;
    }

    const rmsThreshold = 0.005;
    const normalizedLevel = (rms < rmsThreshold) ? 0 : Math.max(0, (20 * Math.log10(Math.min(rms, 1.0)) + 100) / 110);
    const barHeight = normalizedLevel * height;

    // ... (the rest of the function remains the same)
    if (normalizedLevel >= peakLevels[voiceIdx]) {
        peakLevels[voiceIdx] = normalizedLevel;
        peakCounters[voiceIdx] = PEAK_HOLD_FRAMES; 
    } else {
        if (peakCounters[voiceIdx] > 0) {
            peakCounters[voiceIdx]--;
        } else {
            peakLevels[voiceIdx] = Math.max(normalizedLevel, peakLevels[voiceIdx] - PEAK_FALLOFF);
        }
    }
    const peakY = height - (peakLevels[voiceIdx] * height);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#00FF00');
    gradient.addColorStop(0.5, '#FFFF00');
    gradient.addColorStop(1, '#FF0000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - barHeight, width, barHeight);
    
    if (peakLevels[voiceIdx] > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, peakY, width, 2);
    }
}

// --- Public Control Functions ---

export function toggleWaveformFreeze(shouldFreeze) {
    const displays = [voiceDisplay1, voiceDisplay2, voiceDisplay3, digiDisplay];
    if (!displays[0]) return;

    if (shouldFreeze) {
        displays.forEach(d => { if (d) d.redraw = () => {}; });
    } else {
        displays.forEach(d => {
            if (d) {
                d.redraw = VoiceDisplay.prototype.redraw;
                d.redraw();
            }
        });
    }
}

let hasWaveformRendererStarted = false;
function startWaveformRendering() {
    if (hasWaveformRendererStarted) return;

    const useSyncMode = true;
    voiceDisplay1 = new VoiceDisplay('voice1-canvas', streamer, () => streamer.getData(0), useSyncMode);
    voiceDisplay2 = new VoiceDisplay('voice2-canvas', streamer, () => streamer.getData(1), useSyncMode);
    voiceDisplay3 = new VoiceDisplay('voice3-canvas', streamer, () => streamer.getData(2), useSyncMode);
    digiDisplay = new VoiceDisplay('digi-canvas', streamer, () => streamer.getData(3), useSyncMode);

    voiceDisplay1.setStrokeColor('#00FF00');
    voiceDisplay2.setStrokeColor('#00FF00');
    voiceDisplay3.setStrokeColor('#00FF00');
    digiDisplay.setStrokeColor('#B22222');

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
    peakLevels.fill(0);
    peakCounters.fill(0);

    const canvases = ['voice1-canvas', 'voice2-canvas', 'voice3-canvas', 'digi-canvas'];
    canvases.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const { width, height } = canvas;

            ctx.fillStyle = (id === 'digi-canvas') ? '#808080' : WAVEFORM_BG_COLOR;
            ctx.fillRect(0, 0, width, height);

            const isDigi = (id === 'digi-canvas');
            const lineY = isDigi ? 2 : height / 2;
            const color = isDigi ? '#B22222' : '#00FF00';

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.moveTo(0, lineY);
            ctx.lineTo(width, lineY);
            ctx.stroke();
        }
    });

    drawVUMeter('vu1-canvas', 0);
    drawVUMeter('vu2-canvas', 1);
    drawVUMeter('vu3-canvas', 2);
    drawAmplitudeBar('amp1-canvas', 0);
    drawAmplitudeBar('amp2-canvas', 1);
    drawAmplitudeBar('amp3-canvas', 2);
    window.logmsg('Visualization state reset.', 2);
}

function initialize() {
    window.startVisualizations = startVisualizations;
    window.viz = { resetVisualizationState };

    Promise.all([
        VU_LABEL_IMG.decode().catch(() => {}),
        VU_FRAME_IMG.decode().catch(() => {})
    ]).then(() => {
        resetVisualizationState();
        document.getElementById('digi-canvas').style.backgroundColor = '#808080';
    });
}

initialize();