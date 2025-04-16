export let sidPlayer = null;
export let isPlaying = false;
let timerInterval;

export function debug(message) { console.log(`[DEBUG] ${message}`); }

export function setIsPlaying(value) {
    isPlaying = value;
}

export function loadSong(filename, trackNumber, updateSongInfo, updatePlayPauseButton, resetVoiceStates, updateNavigationButtons, updateVsMatchup, autoPlay = true) {
    if (!filename) return;
    let onFail = () => console.error("Failed to load song");
    let onProgress = (total, loaded) => {};
    let options = { track: trackNumber, timeout: -1, traceSID: true };

    if (sidPlayer && isPlaying) {
        sidPlayer.pause();
        setIsPlaying(false);
        stopTimer();
    }

    if (!sidPlayer) {
        updateSongInfo();
        updateVsMatchup();
        updateNavigationButtons();
        updatePlayPauseButton();
        resetVoiceStates();
        return;
    }

    ScriptNodePlayer.loadMusicFromURL(filename, options, onFail, onProgress).then(() => {
        updateSongInfo();
        if (autoPlay) {
            sidPlayer.resume();
            setIsPlaying(true);
            startTimer(updateTimer);
        }
        updatePlayPauseButton();
        resetVoiceStates();
        updateNavigationButtons();
        updateVsMatchup();
    }).catch(error => {
        console.error(`Error loading song ${filename}:`, error);
        onFail();
    }).finally(() => {
        if (!autoPlay) {
            sidPlayer.pause();
            setIsPlaying(false);
            stopTimer();
        }
    });
}

export function initPlayer(updateWinnerButtons, updateFlameButton) {
    const state = window.brackets.getPlayerState();
    let BASIC_ROM, KERNAL_ROM, CHAR_ROM;
    window.backend = new SIDBackendAdapter(BASIC_ROM, CHAR_ROM, KERNAL_ROM);
    let onTrackEnd = () => debug("Track ended - stopping music");

    ScriptNodePlayer.initialize(window.backend, onTrackEnd).then((msg) => {
        sidPlayer = ScriptNodePlayer.getInstance();
        if (state.contenders.length > 0 && state.currentMode === "bout") {
            window.loadSongBound(state.contenders[state.activeContender], -1);
        } else if (state.nowPlayingSong && state.currentMode === "nowPlaying") {
            window.loadSongBound(state.nowPlayingSong, -1);
        } else if (state.peekPlayingSong) {
            window.loadSongBound(state.peekPlayingSong, -1);
        } else {
            debug("No contenders or songs available to load");
        }
        updateWinnerButtons();
        updateFlameButton();
    });
}

export function togglePlayPause(updateRoundInfo, updatePlayPauseButton, updateWinnerButtons, updateFlameButton, initPlayerFn) {
    if (!sidPlayer) {
        initPlayerFn();
        console.log("Notice to dev partners: Ignore ScriptProcessorNode Deprecation warning. We will not be remediating this as part of sID JAm initial development.");
    } else if (isPlaying) {
        sidPlayer.pause();
        setIsPlaying(false);
        stopTimer();
    } else {
        sidPlayer.resume();
        setIsPlaying(true);
        startTimer(updateTimer);
    }
    window.brackets.updatePlayerState({ hasPlayed: true });
    updateRoundInfo();
    updatePlayPauseButton();
    updateWinnerButtons();
    document.getElementById("jamButton").disabled = false;
    document.getElementById("flameButton").disabled = false;
    document.getElementById("prevButton").disabled = false;
    document.getElementById("nextButton").disabled = false;
    updateFlameButton();
}

export function nextTrack(loadSongFn) {
    const state = window.brackets.getPlayerState();
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

export function prevTrack(loadSongFn) {
    const state = window.brackets.getPlayerState();
    if (sidPlayer) {
        const songInfo = sidPlayer.getSongInfo();
        const filename = state.currentMode === "nowPlaying" ? state.nowPlayingSong :
                        state.peekPlayingSong ? state.peekPlayingSong :
                        state.contenders[state.activeContender];
        loadSongFn(filename, songInfo.actualSubsong > 0 ? songInfo.actualSubsong - 1 : 0);
    }
}

export function startTimer(updateTimer) {
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

export function stopTimer() {
    clearInterval(timerInterval);
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