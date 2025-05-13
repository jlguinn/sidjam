// sidviz.js - Visualization POC for SID playback and waveform visualizations

// Waveform visualization configuration (unchanged)
const BUFFER_SIZE = 3000; // ~68ms at 44100 Hz
const TARGET_FPS = 60; // Match rendering loop
const TIME_LIMIT = 1000 / TARGET_FPS; // ~16.67ms at 60 FPS
const BACKGROUND_COLOR = '#333333'; // Dark grey for waveform canvas

const voiceBuffers = [
    new Float32Array(BUFFER_SIZE), // Voice 1
    new Float32Array(BUFFER_SIZE), // Voice 2
    new Float32Array(BUFFER_SIZE)  // Voice 3
];

let sidPlayer = null;
let isPlaying = false;
let traceStreams = null;
let isVisualizationActive = false;
let lastRenderTime = 0;
let isPlayerInitialized = false;

// Logging function
function logmsg(message, level = 0) {
    console.log(`[SIDViz] ${message}`);
}

// Initialize static waveforms
function drawStaticWaveform(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        logmsg(`drawStaticWaveform: Canvas ${canvasId} not found`, 0);
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

// Draw dynamic waveform for a given voice
function drawVoiceWaveform(canvasId, voiceIdx) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        logmsg(`drawVoiceWaveform: Canvas ${canvasId} not found`, 0);
        return;
    }
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // 250
    const height = canvas.height; // 100
    const midY = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    if (!sidPlayer || !sidPlayer._isSongReady) {
        voiceBuffers.forEach(buffer => buffer.fill(0));
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

    const buffer = voiceBuffers[voiceIdx];
    let maxAmplitude = 0;
    for (let i = 0; i < BUFFER_SIZE; i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(buffer[i]));
    }
    const scale = maxAmplitude > 0 ? (0.8 * height / 2) / maxAmplitude : 1;

    const sampleRange = BUFFER_SIZE;
    const sampleStep = sampleRange / (width - 1);

    for (let x = 0; x < width; x++) {
        const t = x / (width - 1);
        const sampleIdx = t * sampleRange;
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

// Update voice buffers
function updateVoiceBuffers() {
    if (!sidPlayer || !sidPlayer._isSongReady) {
        voiceBuffers.forEach(buffer => buffer.fill(0));
        return;
    }

    if (sidPlayer.isPaused()) {
        return;
    }

    const adapter = sidPlayer._backendAdapter;
    if (!adapter || !adapter.isAdapterReady()) {
        logmsg('updateVoiceBuffers: SIDBackendAdapter not ready', 0);
        voiceBuffers.forEach(buffer => buffer.fill(0));
        return;
    }

    if (!traceStreams || traceStreams.length < 3) {
        logmsg('updateVoiceBuffers: Trace streams not initialized', 0);
        voiceBuffers.forEach(buffer => buffer.fill(0));
        return;
    }

    const Module = window.backend_SID.Module;
    try {
        for (let voiceIdx = 0; voiceIdx < 3; voiceIdx++) {
            const stream = traceStreams[voiceIdx];
            for (let i = 0; i < BUFFER_SIZE; i++) {
                const sample = Module.HEAP16[stream + i] / 32768;
                voiceBuffers[voiceIdx][i] = sample;
            }
        }
    } catch (error) {
        logmsg(`updateVoiceBuffers: Error fetching waveform data: ${error.message}`, 0);
        voiceBuffers.forEach(buffer => buffer.fill(0));
    }
}

// Animation loop
function updateViz() {
    if (!isVisualizationActive) {
        logmsg('updateViz: Visualization loop stopped', 2);
        return;
    }

    const now = performance.now();
    const renderTime = now - lastRenderTime;

    if (renderTime >= TIME_LIMIT) {
        updateVoiceBuffers();
        drawVoiceWaveform('voice1-canvas', 0);
        drawVoiceWaveform('voice2-canvas', 1);
        drawVoiceWaveform('voice3-canvas', 2);
        lastRenderTime = now;
    }

    requestAnimationFrame(updateViz);
}

// Initialize trace streams
function initTraceStreams() {
    if (!sidPlayer || !sidPlayer._backendAdapter) {
        logmsg('initTraceStreams: ScriptNodePlayer not ready', 0);
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
            return true;
        } else {
            logmsg(`initTraceStreams: Insufficient trace streams: ${numStreams}`, 0);
            return false;
        }
    } catch (error) {
        logmsg(`initTraceStreams: Error initializing trace streams: ${error.message}`, 0);
        return false;
    }
}

// Initialize player
async function initPlayer(filename) {
    if (isPlayerInitialized) {
        logmsg('Player already initialized', 1);
        if (filename) {
            await loadTrack(filename);
        }
        return;
    }

    try {
        // Initialize backend without ROMs (WebSID may not require them)
        window.backend = new SIDBackendAdapter();
        let onTrackEnd = () => logmsg("Track ended");

        await ScriptNodePlayer.initialize(window.backend, onTrackEnd);
        sidPlayer = ScriptNodePlayer.getInstance();
        if (!sidPlayer) {
            throw new Error('ScriptNodePlayer.getInstance() returned null');
        }
        window.player = sidPlayer;
        isPlayerInitialized = true;
        logmsg('ScriptNodePlayer initialized successfully', 1);

        // Enable controls
        document.getElementById('playPauseButton').disabled = false;
        document.getElementById('voice1').disabled = false;
        document.getElementById('voice2').disabled = false;
        document.getElementById('voice3').disabled = false;

        // Load default track if provided
        if (filename) {
            await loadTrack(filename);
        }

        // Start visualizations
        let retryCount = 0;
        const maxRetries = 12;
        const retryInterval = 300;

        function attemptTraceStreamInit() {
            if (initTraceStreams()) {
                voiceBuffers.forEach(buffer => buffer.fill(0));
                               isVisualizationActive = true;
                lastRenderTime = performance.now();
                updateViz();
            } else if (retryCount < maxRetries) {
                retryCount++;
                logmsg(`Trace streams not ready, retrying in ${retryInterval}ms (${retryCount}/${maxRetries})`, 1);
                setTimeout(attemptTraceStreamInit, retryInterval);
            } else {
                logmsg('Max retries reached, visualizations disabled', 0);
            }
        }

        attemptTraceStreamInit();
    } catch (error) {
        logmsg(`initPlayer: Failed to initialize player: ${error.message}`, 0);
    }
}

// Load a track
window.loadTrack = async function(filename) {
    if (!filename) {
        logmsg('No track selected', 0);
        return;
    }

    if (!isPlayerInitialized) {
        logmsg('Player not initialized, initializing now', 1);
        await initPlayer(filename);
        return;
    }

    if (sidPlayer && isPlaying) {
        sidPlayer.pause();
        isPlaying = false;
        updatePlayPauseButton();
    }

    let onFail = () => logmsg(`Failed to load track: ${filename}`, 0);
    let onProgress = (total, loaded) => {};
    let options = { track: -1, timeout: -1, traceSID: true };

    try {
        logmsg(`Attempting to load track: ${filename}`, 1);
        await sidPlayer.loadMusicFromURL(filename, options, onFail, onProgress);
        logmsg(`Loaded track: ${filename}`, 1);
        sidPlayer.play();
        isPlaying = true;
        updatePlayPauseButton();
    } catch (error) {
        logmsg(`Error loading track ${filename}: ${error.message}`, 0);
        onFail();
    }
};

// Toggle play/pause
window.togglePlayPause = async function() {
    if (!isPlayerInitialized) {
        logmsg('Player not initialized, initializing now', 1);
        await initPlayer();
        if (sidPlayer) {
            sidPlayer.play();
            isPlaying = true;
        }
    } else if (isPlaying) {
        sidPlayer.pause();
        isPlaying = false;
    } else {
        sidPlayer.resume();
        isPlaying = true;
    }
    updatePlayPauseButton();
};

// Update play/pause button
function updatePlayPauseButton() {
    const button = document.getElementById("playPauseButton");
    if (!button) {
        logmsg('Play/Pause button not found', 0);
        return;
    }
    button.className = `control-button control-button--${isPlaying ? 'pause' : 'play'}`;
    button.setAttribute('aria-label', isPlaying ? 'Pause Track' : 'Play Track');
}

// Toggle voice mute
window.toggleVoice = function(voiceNum) {
    if (window.backend && isPlayerInitialized) {
        const button = document.getElementById(`voice${voiceNum}`);
        if (!button) {
            logmsg(`Voice ${voiceNum} button not found`, 0);
            return;
        }
        const isOn = button.getAttribute('data-state') === 'on';
        const newState = !isOn;
        button.setAttribute('data-state', newState ? 'on' : 'off');
        window.backend.enableVoice(0, voiceNum - 1, newState);
        logmsg(`Voice ${voiceNum} ${newState ? 'enabled' : 'muted'}`, 1);
    } else {
        logmsg(`Cannot toggle voice ${voiceNum}: Player not initialized`, 0);
    }
};

// Reset voice states
function resetVoiceStates() {
    if (window.backend && isPlayerInitialized) {
        for (let i = 1; i <= 3; i++) {
            const button = document.getElementById(`voice${i}`);
            if (!button) {
                logmsg(`Voice ${i} button not found`, 0);
                continue;
            }
            button.setAttribute('data-state', 'on');
            window.backend.enableVoice(0, i - 1, true);
        }
    }
}

// Initialize static visualizations
function initStaticVisualizations() {
    drawStaticWaveform('voice1-canvas');
    drawStaticWaveform('voice2-canvas');
    drawStaticWaveform('voice3-canvas');
}

// Initialize on page load
async function onPageLoad() {
    initStaticVisualizations();
    // Load default track
    const defaultTrack = "/sid/C64Music/Musicians/H/Hubbard_Rob/Commando.sid";
    await initPlayer(defaultTrack);
}

// Wait for DOM content to load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onPageLoad);
} else {
    onPageLoad();
}