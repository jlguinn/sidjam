import * as brackets from './brackets.js';
import * as ui from './ui.js';

export let sidPlayer = null;
export let isPlaying = false;
let timerInterval;

export function debug(message) { console.log(`[DEBUG] ${message}`); }

export function setIsPlaying(value) {
    isPlaying = value;
}

export function loadSong(filename, trackNumber, updateSongInfo, updatePlayPauseButton, resetVoiceStates, updateNavigationButtons, updateVsMatchup, updateJamButton, autoPlay = true) {
    if (!filename) return Promise.resolve();
    let onFail = () => console.error("Failed to load song");
    let onProgress = (total, loaded) => {};
    let options = { track: trackNumber, timeout: -1, traceSID: true };

    if (sidPlayer && isPlaying) {
        sidPlayer.pause();
        setIsPlaying(false);
        stopTimer(updateJamButton); // Pass updateJamButton to stopTimer
    }

    if (!sidPlayer) {
        updateSongInfo();
        updateVsMatchup();
        updateNavigationButtons();
        updatePlayPauseButton();
        resetVoiceStates();
        return Promise.resolve();
    }

    return ScriptNodePlayer.loadMusicFromURL(filename, options, onFail, onProgress).then(() => {
        if (window.backend.getRAM && window.backend.getRAM(0x0801) !== 0) {
            console.log(`[sID JAm] Detected unplayable BASIC SID file: ${filename}`);
            const state = brackets.getPlayerState();
            if (state.currentMode === "bout" && state.activeBracket === "0 - 0" && state.roundCount === 1) {
                state.isUnplayableSID = true;
                state.isFlameActive = true;
                brackets.updatePlayerState({
                    isUnplayableSID: true,
                    isFlameActive: true
                });
                document.getElementById("winner0").disabled = true;
                document.getElementById("winner1").disabled = true;
            }
        }

        updateSongInfo();
        if (autoPlay) {
            sidPlayer.resume();
            setIsPlaying(true);
            startTimer(updateTimer, updateJamButton); // Pass updateJamButton to startTimer
        }
        updatePlayPauseButton();
        resetVoiceStates();
        updateNavigationButtons();
        updateVsMatchup();
        ui.updateFlameButton(brackets.getPlayerState(), sidPlayer);
        ui.updateRoundInfo(brackets.getPlayerState());
    }).catch(error => {
        console.error(`Error loading song ${filename}:`, error);
        onFail();
    }).finally(() => {
        if (!autoPlay) {
            sidPlayer.pause();
            setIsPlaying(false);
            stopTimer(updateJamButton); // Pass updateJamButton to stopTimer
        }
    });
}

export async function initPlayer(getPlayerState, updateWinnerButtons, updateFlameButton, updateJamButton, loadSongBound) {
    const state = getPlayerState();
    let BASIC_ROM, KERNAL_ROM, CHAR_ROM;
    window.backend = new SIDBackendAdapter(BASIC_ROM, CHAR_ROM, KERNAL_ROM);
    let onTrackEnd = () => window.logmsg("Track ended - stopping music");

    await ScriptNodePlayer.initialize(window.backend, onTrackEnd);
    sidPlayer = ScriptNodePlayer.getInstance();
    window.player = sidPlayer; // Ensure viz.js access

    if (state.contenders.length > 0 && state.currentMode === "bout") {
        await loadSongBound(state.contenders[state.activeContender], -1);
    } else if (state.nowPlayingSong && state.currentMode === "nowPlaying") {
        await loadSongBound(state.nowPlayingSong, -1);
    } else if (state.peekPlayingSong) {
        await loadSongBound(state.peekPlayingSong, -1);
    } else {
        window.logmsg("No contenders or songs available to load");
    }

    updateWinnerButtons();
    updateFlameButton();
    updateJamButton(); // Ensure initial state is set
}

export async function togglePlayPause(updateRoundInfo, updatePlayPauseButton, updateWinnerButtons, updateFlameButton, updateJamButton, initPlayerFn, updatePlayerState) {
    if (!sidPlayer) {
        await initPlayerFn();
        console.log("Note: Please ignore ScriptProcessorNode Deprecation warning. We will not be remediating at this time.");
        window.logmsg("[>]", 1);
        // Directly start the animation if playback is active
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
    document.getElementById("jamButton").disabled = false;
    document.getElementById("flameButton").disabled = false;
    document.getElementById("prevButton").disabled = false;
    document.getElementById("nextButton").disabled = false;
    document.getElementById("reviveButton").classList.remove("disabled");
    updateFlameButton();
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
    console.log("startTimer: Starting timer and animation"); // Debug log
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
    if (updateJamButton) {
        updateJamButton(true); // Start animation
    }
}

export function stopTimer(updateJamButton) {
    console.log("stopTimer: Stopping timer and animation"); // Debug log
    clearInterval(timerInterval);
    timerInterval = null;
    if (updateJamButton) {
        updateJamButton(false); // Stop animation
    }
}

export function updateTimer() {
    if (window.backend) {
        const currentTime = Math.floor(window.backend.getCurrentPlaytime());
        const minutes = Math.floor(currentTime / 60);
        const seconds = currentTime % 60;
        document.getElementById("timer").textContent = "Time: " +
            (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    }
}

export function toggleVoice(voiceNum) {
    if (window.backend) {
        const checkbox = document.getElementById(`voice${voiceNum}`);
        window.backend.enableVoice(0, voiceNum - 1, checkbox.checked);
    }
}

export function resetVoiceStates() {
    if (window.backend) {
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`voice${i}`).checked = true;
            window.backend.enableVoice(0, i - 1, true);
        }
    }
}