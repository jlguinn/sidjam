// player.js
import * as brackets from './brackets.js';
import * as ui from './ui.js';
import * as ROM_DATA from './rom.js';

export let sidPlayer = null;
export let streamer = null;
export let isPlaying = false;
let timerInterval;
let onTickCallback = null;

/**
 * Creates the single, persistent player instance. Called only once.
 */
export async function initPlayer() {
    if (sidPlayer) return; // Already initialized

    const { BASIC_ROM, KERNAL_ROM, CHAR_ROM } = ROM_DATA.ROM;
    const backend = new SIDBackendAdapter(BASIC_ROM, CHAR_ROM, KERNAL_ROM);
    streamer = new ChannelStreamer(3, true);

    await ScriptNodePlayer.initialize(backend, () => {}, [], false, streamer);
    
    sidPlayer = ScriptNodePlayer.getInstance();
    window.player = sidPlayer;
    window.backend = backend; // Make backend global for timer access
    console.log("Player object created.");
}

/**
 * Loads a new song into the EXISTING player.
 */
export async function loadSong(filename, trackNumber, callbacks) {
    if (!sidPlayer) {
        console.error("loadSong called before player was initialized.");
        return;
    }

    // Always pause before loading.
    sidPlayer.pause();
    isPlaying = false;
    stopTimer(callbacks.updateJamButton);

    if (window.viz && window.viz.resetVisualizationState) {
        window.viz.resetVisualizationState();
    }

    const rootPath = 'sid/HVSC_82-all-of-them/C64Music/';
    const fullFilePath = `${rootPath}${filename.startsWith('/') ? filename.slice(1) : filename}`;

    try {
        await ScriptNodePlayer.loadMusicFromURL(fullFilePath, { track: trackNumber, timeout: -1, traceSID: true });
        
        // Success: Update UI
        callbacks.updateSongInfo();
        callbacks.resetVoiceStates();
        callbacks.updateNavigationButtons();
        callbacks.updateVsMatchup();
        ui.updateBombButton(brackets.getPlayerState());
        callbacks.updateRoundInfo();
        
        // Start visualizations now that a song is loaded and ready.
        if (window.startVisualizations) {
            window.startVisualizations();
        }

        // This block now contains the correct logic.
        if (callbacks.autoPlay) {
            sidPlayer.play();
            isPlaying = true;
            startTimer(updateTimer, callbacks.updateJamButton, callbacks.onTick);
        }
        
        callbacks.updatePlayPauseButton();
        window.logmsg(`Playback Success: ${fullFilePath}`, 1);

    } catch (error) {
        window.logmsg(`Playback Failure: ${fullFilePath}, Error=${error}`, 0);
    }
}

// --- Utility functions ---

export function setIsPlaying(value) {
    isPlaying = value;
}

export function resetVoiceStates() {
    if (window.backend) {
        for (let i = 1; i <= 3; i++) {
            const button = document.getElementById(`voice${i}`);
            const canvas = document.getElementById(`vu${i}-canvas`);
            if (button) button.setAttribute('data-state', 'on');
            if (canvas) canvas.setAttribute('data-state', 'on');
            window.backend.enableVoice(0, i - 1, true);
        }
    }
}

export function startTimer(updateTimer, updateJamButton, tickCallback) {
    stopTimer(updateJamButton);
    updateTimer();
    onTickCallback = tickCallback || null;
    timerInterval = setInterval(updateTimer, 1000);
    if (updateJamButton) updateJamButton(true);
}

export function stopTimer(updateJamButton) {
    clearInterval(timerInterval);
    timerInterval = null;
    onTickCallback = null;
    if (updateJamButton) updateJamButton(false);
}

export function updateTimer() {
    if (window.backend && sidPlayer && !sidPlayer.isPaused()) {
        const currentTime = Math.floor(window.backend.getCurrentPlaytime());
        const minutes = Math.floor(currentTime / 60);
        const seconds = currentTime % 60;
        const timerElement = document.getElementById("timer");
        if (timerElement) {
            timerElement.textContent = "Time: " +
                (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
        }
        if (onTickCallback) {
            onTickCallback(currentTime);
        }
    }
}
export function toggleVoice(voiceNum) {
    if (window.backend) {
        const button = document.getElementById(`voice${voiceNum}`);
        if (!button) return;
        const isOn = button.getAttribute('data-state') === 'on';
        window.backend.enableVoice(0, voiceNum - 1, !isOn);
        
        const canvas = document.getElementById(`vu${voiceNum}-canvas`);
        button.setAttribute('data-state', !isOn ? 'on' : 'off');
        if (canvas) canvas.setAttribute('data-state', !isOn ? 'on' : 'off');
    }
}