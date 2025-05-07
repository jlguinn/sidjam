// player.js
import * as brackets from './brackets.js';
import * as ui from './ui.js';

export let sidPlayer = null;
export let isPlaying = false;
let timerInterval;

export function debug(message) {
    window.logmsg(`[DEBUG] ${message}`, 2);
}

export function setIsPlaying(value) {
    isPlaying = value;
}

export function loadSong(filename, trackNumber, updateSongInfo, updatePlayPauseButton, resetVoiceStates, updateNavigationButtons, updateVsMatchup, updateJamButton, autoPlay = true) {
    if (!filename) return Promise.resolve();

    let onFail = () => window.logmsg("Failed to load song", 0);
    let onProgress = (total, loaded) => {};
    let options = { track: trackNumber, timeout: -1, traceSID: true };

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

    // Helper function to check for audio activity using viz.js
    async function checkAudioActivity(durationMs = 3000) {
        if (!window.viz || !window.viz.isAudioActive) {
            window.logmsg(`No audio activity checker available for ${filename}`, 0);
            return true; // Assume playable if viz.js checker is unavailable
        }

        const checkIntervalMs = 100; // Check every 100ms
        const endTime = Date.now() + durationMs;

        while (Date.now() < endTime) {
            if (!isPlaying) {
                window.logmsg(`Audio check aborted for ${filename}: Playback paused by user`, 0);
                return true; // Assume playable if user pauses
            }
            const hasAudio = window.viz.isAudioActive();
            if (hasAudio) {
                window.logmsg(`Audio activity detected for ${filename} at ${durationMs - (endTime - Date.now())}ms`, 0);
                return true; // Audio detected, file is playable
            }
            await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
        }

        window.logmsg(`No audio activity for ${filename} after ${durationMs}ms`, 0);
        return false; // No audio detected, file is unplayable
    }

    return ScriptNodePlayer.loadMusicFromURL(filename, options, onFail, onProgress).then(async () => {
        // Log initial load info
        window.logmsg(`Loading SID: ${filename}, RAM[0x0801]=${window.backend.getRAM ? window.backend.getRAM(0x0801) : 'N/A'}`, 0);

        // Log player state context
        const state = brackets.getPlayerState();
        window.logmsg(`Player State for ${filename}: Mode=${state.currentMode}, Bracket=${state.activeBracket}, Round=${state.roundCount}, FlameActive=${state.isFlameActive}`, 0);

        let isUnplayable = false;
        if (window.backend.getRAM && window.backend.getRAM(0x0801) !== 0) {
            // Start playback for audio monitoring
            sidPlayer.play();
            setIsPlaying(true);
            startTimer(updateTimer, updateJamButton);
            updatePlayPauseButton(true);

            // Perform 3-second audio check
            const hasAudio = await checkAudioActivity(3000);

            if (!hasAudio) {
                // No audio detected, confirm unplayable
                isUnplayable = true;
                window.logmsg(`Unplayable SID Confirmed: ${filename}, RAM[0x0801]=${window.backend.getRAM(0x0801)}, No audio for 3s`, 0);
            } else {
                // Audio detected, cancel unplayable flag
                window.logmsg(`Playable SID: ${filename}, RAM[0x0801]=${window.backend.getRAM(0x0801)}, Audio detected`, 0);
            }
        } else {
            // Skip audio check for RAM[0x0801]=0
            window.logmsg(`No audio check needed for ${filename}: RAM[0x0801]=0`, 0);
        }

        if (isUnplayable && state.currentMode === "bout" && state.activeBracket === "0 - 0" && state.roundCount === 1) {
            state.isUnplayableSID = true;
            state.isFlameActive = true;
            brackets.updatePlayerState({
                isUnplayableSID: true,
                isFlameActive: true
            });
            const winnerLeft = document.getElementById("winner-left");
            const winnerRight = document.getElementById("winner-right");
            if (winnerLeft && winnerRight) {
                winnerLeft.disabled = true;
                winnerRight.disabled = true;
            } else {
                window.logmsg('Winner buttons not found in the DOM', 0);
            }
            ui.updateFlameButton(state); // Show "Flame Activated"
        }

        // Update UI and start playback (if not already started)
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
        ui.updateFlameButton(state);
        ui.updateRoundInfo(state);

        window.logmsg(`Playback Success: ${filename}, Loaded and playable`, 0);
    }).catch(error => {
        window.logmsg(`Playback Failure: ${filename}, Error=${error}`, 0);
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
    let BASIC_ROM, KERNAL_ROM, CHAR_ROM;
    window.backend = new SIDBackendAdapter(BASIC_ROM, CHAR_ROM, KERNAL_ROM);
    let onTrackEnd = () => window.logmsg("Track ended - stopping music");

    await ScriptNodePlayer.initialize(window.backend, onTrackEnd);
    sidPlayer = ScriptNodePlayer.getInstance();
    window.player = sidPlayer; // Ensure viz.js access

    // Start visualizations after player initialization
    if (window.startVisualizations) {
        window.startVisualizations();
    } else {
        window.logmsg('startVisualizations function not found on window object', 0);
    }

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
    updateJamButton();
}

export async function togglePlayPause(updateRoundInfo, updatePlayPauseButton, updateWinnerButtons, updateFlameButton, updateJamButton, initPlayerFn, updatePlayerState) {
    if (!sidPlayer) {
        await initPlayerFn();
        console.log("Note: Please ignore ScriptNodePlayer Deprecation warning. We will not be remediating at this time.");
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