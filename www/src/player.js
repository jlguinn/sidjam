export let sidPlayer = null;
export let isPlaying = false;
let timerInterval;

export function debug(message) { console.log(`[DEBUG] ${message}`); }

export function setIsPlaying(value) {
    isPlaying = value;
}


export function loadSong(filename, trackNumber, updateSongInfo, updatePlayPauseButton, resetVoiceStates, updateNavigationButtons, updateVsMatchup, autoPlay = true) {
    if (!filename) return;
    console.log(`[DEBUG] loadSong: ${filename}, autoPlay: ${autoPlay}`);

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
        console.log("[DEBUG] Song loaded successfully");
        updateSongInfo();
        if (autoPlay) {
            sidPlayer.resume();
            setIsPlaying(true);
            startTimer(updateTimer);
            console.log("[DEBUG] Auto-playing song");
        } else {
            console.log("[DEBUG] Song loaded, pausing explicitly");
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
            console.log("[DEBUG] Ensured paused state after load");
        }
    });
}

export function initPlayer(hasPlayed, activeContender, contenders, loadSongFn, updateWinnerButtons, updateFlameButton) {
//    debug("sID JAm starting...");
    let BASIC_ROM, KERNAL_ROM, CHAR_ROM;
    window.backend = new SIDBackendAdapter(BASIC_ROM, CHAR_ROM, KERNAL_ROM);
    let onTrackEnd = () => debug("Track ended - stopping music");

    ScriptNodePlayer.initialize(window.backend, onTrackEnd).then((msg) => {
        // debug("Player initialized: " + msg);
        sidPlayer = ScriptNodePlayer.getInstance();
        if (contenders.length > 0) {
            loadSongFn(contenders[activeContender], -1);
        } else {
            debug("No contenders available to load");
        }
        updateWinnerButtons();
        updateFlameButton();
    });
}

export function togglePlayPause(updateRoundInfo, updatePlayPauseButton, updateWinnerButtons, updateFlameButton, initPlayerFn, setHasPlayed) {
    // debug("Toggle play/pause");
    if (!sidPlayer) {
        initPlayerFn();
        console.log("Notice to dev partners: Ignore ScriptProcessorNode Depracation warning. We will not be remediating this as part of sID JAm initial development. ")
    } else if (isPlaying) {
        sidPlayer.pause();
        setIsPlaying(false);
        stopTimer();
    } else {
        sidPlayer.resume();
        setIsPlaying(true);
        startTimer(updateTimer);
    }
    setHasPlayed(true); // Moved here to ensure it happens before UI updates
    updateRoundInfo();
    updatePlayPauseButton();
    updateWinnerButtons();
    document.getElementById("jamButton").disabled = false;
    document.getElementById("flameButton").disabled = false;
    document.getElementById("prevButton").disabled = false;
    document.getElementById("nextButton").disabled = false;
    updateFlameButton();
}

export function nextTrack(currentMode, nowPlayingSong, contenders, activeContender, loadSongFn) {
    // debug("Next track");
    if (sidPlayer) {
        let songInfo = sidPlayer.getSongInfo();
        if (songInfo.actualSubsong < songInfo.maxSubsong - 1) {
            loadSongFn(currentMode === "nowPlaying" ? nowPlayingSong : contenders[activeContender], songInfo.actualSubsong + 1);
        }
    }
}

export function prevTrack(currentMode, nowPlayingSong, contenders, activeContender, loadSongFn) {
    // debug("Previous track");
    if (sidPlayer) {
        let songInfo = sidPlayer.getSongInfo();
        if (songInfo.actualSubsong > 0) {
            loadSongFn(currentMode === "nowPlaying" ? nowPlayingSong : contenders[activeContender], songInfo.actualSubsong - 1);
        } else {
            loadSongFn(currentMode === "nowPlaying" ? nowPlayingSong : contenders[activeContender], 0);
        }
    }
}

export function startTimer(updateTimer) {
    // debug("Starting timer");
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

export function stopTimer() {
    // debug("Stopping timer");
    clearInterval(timerInterval);
}

export function updateTimer() {
    if (window.backend) {
        let currentTime = Math.floor(window.backend.getCurrentPlaytime());
        let minutes = Math.floor(currentTime / 60);
        let seconds = currentTime % 60;
        document.getElementById("timer").textContent = "Time: " +
            (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    }
}

export function toggleVoice(voiceNum) {
    if (window.backend) {
        let checkbox = document.getElementById(`voice${voiceNum}`);
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

