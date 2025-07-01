// player.js
import * as brackets from './brackets.js';
import * as ui from './ui.js';
import * as ROM_DATA from './rom.js';

export let sidPlayer = null;
export let isPlaying = false;
let timerInterval;

export function debug(message) {
    window.logmsg(`[DEBUG] ${message}`, 2);
}

export function setIsPlaying(value) {
    isPlaying = value;
}

export function resetVisualizationState() {
    if (window.viz && window.viz.resetVisualizationState) {
        window.viz.resetVisualizationState();
    } else {
        window.logmsg('resetVisualizationState: window.viz.resetVisualizationState not defined', 0);
    }
}

export function loadSong(filename, trackNumber, updateSongInfo, updatePlayPauseButton, resetVoiceStates, updateNavigationButtons, updateVsMatchup, updateJamButton, autoPlay = true) {
    if (!filename) return Promise.resolve();

    // Prepend the new root path to the filename
    const rootPath = 'sid/HVSC_82-all-of-them/C64Music/';
    const fullFilePath = `${rootPath}${filename.startsWith('/') ? filename.slice(1) : filename}`;

    let onFail = () => window.logmsg(`Failed to load song: ${fullFilePath}`, 0);
    let onProgress = (total, loaded) => {};
    let options = { track: trackNumber, timeout: -1, traceSID: true };

    // Reset visualization state before loading new song
    resetVisualizationState();

    if (sidPlayer && isPlaying) {
        sidPlayer.pause();
        setIsPlaying(false);
        stopTimer(updateJamButton);
    }

    if (!sidPlayer) {
        updateSongInfo();
        updateVsMatchup();
        updateNavigationButtons();
        updatePlayPauseButton();
        resetVoiceStates();
        return Promise.resolve();
    }

    return ScriptNodePlayer.loadMusicFromURL(fullFilePath, options, onFail, onProgress).then(() => {
        // Log initial load info
        window.logmsg(`Loading SID: ${fullFilePath}`, 1);

        // Update UI and start playback
        updateSongInfo();
        if (autoPlay && !isPlaying) {
            sidPlayer.play();
            setIsPlaying(true);
            startTimer(updateTimer, updateJamButton);
        }
        updatePlayPauseButton();
        resetVoiceStates();
        updateNavigationButtons();
        updateVsMatchup();
        ui.updateFlameButton(brackets.getPlayerState());
        ui.updateRoundInfo(brackets.getPlayerState());

        window.logmsg(`Playback Success: ${fullFilePath}, Loaded and playable`, 1);
    }).catch(error => {
        window.logmsg(`Playback Failure: ${fullFilePath}, Error=${error}`, 0);
        onFail();
    }).finally(() => {
        if (!autoPlay && isPlaying) {
            sidPlayer.pause();
            setIsPlaying(false);
            stopTimer(updateJamButton);
            updatePlayPauseButton(false);
        }
    });
}




export async function initPlayer(getPlayerState, updateWinnerButtons, updateFlameButton, updateJamButton, loadSongBound) {
    const state = getPlayerState();

    let BASIC_ROM = ROM_DATA.ROM.BASIC_ROM;
    let KERNAL_ROM = ROM_DATA.ROM.KERNAL_ROM;
    let CHAR_ROM = ROM_DATA.ROM.CHAR_ROM;
    
    window.backend = new SIDBackendAdapter(BASIC_ROM, CHAR_ROM, KERNAL_ROM);
    let onTrackEnd = () => window.logmsg("Track ended - stopping music");

    await ScriptNodePlayer.initialize(window.backend, onTrackEnd);
    sidPlayer = ScriptNodePlayer.getInstance();
    window.player = sidPlayer; // Ensure viz.js access

    // Load song based on state
    let songLoaded = false;
    if (state.contenders.length > 0 && state.currentMode === "bout") {
        await loadSongBound(state.contenders[state.activeContender], -1);
        songLoaded = true;
    } else if (state.nowPlayingSong && state.currentMode === "nowPlaying") {
        await loadSongBound(state.nowPlayingSong, -1);
        songLoaded = true;
    } else if (state.peekPlayingSong) {
        await loadSongBound(state.peekPlayingSong, -1);
        songLoaded = true;
    } else {
        window.logmsg("No contenders or songs available to load", 0);
    }

    // Start visualizations only if a song was loaded
    if (songLoaded && window.startVisualizations) {
        window.startVisualizations();
    } else if (!songLoaded) {
        window.logmsg('initPlayer: No song loaded, skipping visualizations', 0);
    } else {
        window.logmsg('startVisualizations function not found on window object', 0);
    }

    updateWinnerButtons();
    updateFlameButton();
    updateJamButton();
}

export async function togglePlayPause(updateRoundInfo, updatePlayPauseButton, updateWinnerButtons, updateFlameButton, updateJamButton, initPlayerFn, updatePlayerState) {
    if (!sidPlayer) {
        await initPlayerFn();
        window.logmsg("Note: Please ignore ScriptNodePlayer Deprecation warning. We will not be remediating at this time.",1);
        window.logmsg("[>]", 1);
        if (isPlaying && updateJamButton) {
            updateJamButton(true);
        }
    } else if (isPlaying) {
        sidPlayer.pause();
        setIsPlaying(false);
        stopTimer(updateJamButton);
    } else {
        sidPlayer.resume();
        setIsPlaying(true);
        startTimer(updateTimer, updateJamButton);
    }

    updatePlayerState({ hasPlayed: true });
    updateRoundInfo();
    updatePlayPauseButton();
    updateWinnerButtons();

    const jamButton = document.getElementById("jamButton");
    const flameButton = document.getElementById("flameButton");
    const reviveButton = document.getElementById("reviveButton");

    if (jamButton) {
        jamButton.disabled = false;
    } else {
        window.logmsg('Jam button not found in the DOM', 0);
    }

    if (flameButton) {
        flameButton.disabled = false;
    } else {
        window.logmsg('Flame button not found in the DOM', 0);
    }

    if (reviveButton) {
        reviveButton.classList.remove("disabled");
    } else {
        window.logmsg('Revive button not found in the DOM', 0);
    }

    // Enable zoom buttons
    const zoomOutButton = document.getElementById('zoom-out-button');
    const zoomInButton = document.getElementById('zoom-in-button');
    if (zoomOutButton) {
        zoomOutButton.disabled = false;
    } else {
        window.logmsg('Zoom out button not found in the DOM', 0);
    }
    if (zoomInButton) {
        zoomInButton.disabled = false;
    } else {
        window.logmsg('Zoom in button not found in the DOM', 0);
    }


    updateFlameButton();
    ui.updateNavigationButtons(sidPlayer);
}

export function nextTrack(getPlayerState, loadSongFn) {
    const state = getPlayerState();
    if (sidPlayer) {
        const songInfo = sidPlayer.getSongInfo();
        if (songInfo.actualSubsong < songInfo.maxSubsong - 1) {
            const filename = state.currentMode === "nowPlaying" ? state.nowPlayingSong :
                            state.peekPlayingSong ? state.peekPlayingSong :
                            state.contenders[state.activeContender];
            loadSongFn(filename, songInfo.actualSubsong + 1);
        }
    }
}

export function prevTrack(getPlayerState, loadSongFn) {
    const state = getPlayerState();
    if (sidPlayer) {
        const songInfo = sidPlayer.getSongInfo();
        const filename = state.currentMode === "nowPlaying" ? state.nowPlayingSong :
                        state.peekPlayingSong ? state.peekPlayingSong :
                        state.contenders[state.activeContender];
        loadSongFn(filename, songInfo.actualSubsong > 0 ? songInfo.actualSubsong - 1 : 0);
    }
}

export function startTimer(updateTimer, updateJamButton) {
    window.logmsg("startTimer: Starting timer and animation", 2);
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
    if (updateJamButton) {
        updateJamButton(true);
    }
}

export function stopTimer(updateJamButton) {
    window.logmsg("stopTimer: Stopping timer and animation", 2);
    clearInterval(timerInterval);
    timerInterval = null;
    if (updateJamButton) {
        updateJamButton(false);
    }
}

export function updateTimer() {
    if (window.backend) {
        const currentTime = Math.floor(window.backend.getCurrentPlaytime());
        const minutes = Math.floor(currentTime / 60);
        const seconds = currentTime % 60;
        const timerElement = document.getElementById("timer");
        if (timerElement) {
            timerElement.textContent = "Time: " +
                (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
        } else {
            window.logmsg('Timer element not found in the DOM', 0);
        }
    }
}

export function toggleVoice(voiceNum) {
    if (window.backend) {
        const button = document.getElementById(`voice${voiceNum}`);
        const canvas = document.getElementById(`vu${voiceNum}-canvas`);
        if (!button || !canvas) {
            window.logmsg(`Voice ${voiceNum} button or canvas not found in the DOM`, 0);
            return;
        }
        const isOn = button.getAttribute('data-state') === 'on';
        const newState = !isOn;
        const stateAttr = newState ? 'on' : 'off';
        button.setAttribute('data-state', stateAttr);
        canvas.setAttribute('data-state', stateAttr);
        window.backend.enableVoice(0, voiceNum - 1, newState);
    }
}

export function resetVoiceStates() {
    if (window.backend) {
        for (let i = 1; i <= 3; i++) {
            const button = document.getElementById(`voice${i}`);
            const canvas = document.getElementById(`vu${i}-canvas`);
            if (!button || !canvas) {
                window.logmsg(`Voice ${i} button or canvas not found in the DOM`, 0);
                continue;
            }
            button.setAttribute('data-state', 'on');
            canvas.setAttribute('data-state', 'on');
            window.backend.enableVoice(0, i - 1, true);
        }
    }
}