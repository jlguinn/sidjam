// script.js
window.sidJamData = {
    sidFiles: [],
    cachedResults: {},
    pathToId: {}
};

import { renderWinnerButtonBitmap, renderProfileBitmap } from './bitmap.js';
import * as ui from './ui.js';
import * as brackets from './brackets.js';
import { baseColorSchemes } from './themes.js';
import * as player from './player.js';
import { renderSpriteAnimation } from './spriteAnimator.js';
import { zoomWaveformIn, zoomWaveformOut, resetView } from './viz.js';

function debug(message) { window.logmsg(`[DEBUG] ${message}`, 2); }

// Define bound functions at the top to ensure availability
const updateTimerBound = () => player.updateTimer();
const loadSongBound = (filename, trackNumber, autoPlay = true) => player.loadSong(
    filename, 
    trackNumber,
    {
        updateSongInfo: () => ui.updateSongInfo(player.sidPlayer),
        updatePlayPauseButton: () => ui.updatePlayPauseButton(player.isPlaying),
        resetVoiceStates: player.resetVoiceStates,
        updateNavigationButtons: () => ui.updateNavigationButtons(player.sidPlayer),
        updateVsMatchup: updateVsMatchupBound,
        updateJamButton: updateJamButtonBound,
        updateRoundInfo: updateRoundInfoBound,
        autoPlay: autoPlay
    }
);

const updateVsMatchupBound = () => {
    ui.updateVsMatchup(brackets.getPlayerState());
};
const updateRoundInfoBound = () => ui.updateRoundInfo(brackets.getPlayerState());
const updateWinnerButtonsBound = () => ui.updateWinnerButtons(brackets.getPlayerState(), player.sidPlayer);
const updateFlameButtonBound = () => ui.updateFlameButton(brackets.getPlayerState(), player.sidPlayer);
const updateJamButtonBound = (isPlaying) => ui.updateJamButton(isPlaying, brackets.getPlayerState(), player.sidPlayer);


function wildcardToSqlLike(pattern) {
    // No longer needed client-side, but kept for reference
    if (!pattern) return '';
    return pattern;
}

export async function loadPlayerState() {
    try {
        const response = await fetch(`dbcontrol/get_player_state.php?user_id=${window.user.id}`);
        if (!response.ok) throw new Error(`Failed to load player_state: ${response.statusText}`);
        const data = await response.json();
        if (data.success && data.player_state) {
            // Ensure isBarActive defaults to false if not present
            data.player_state.isBarActive = data.player_state.isBarActive !== undefined ? data.player_state.isBarActive : false;
            return data.player_state;
        }
        return null;
    } catch (error) {
        window.logmsg(`Error loading player_state: ${error}`, 0);
        return null;
    }
}

window.loadPlayerState = loadPlayerState;

async function savePlayerState() {
    const playerState = brackets.getPlayerState();
    const player_state = {
        contenders: playerState.contenders,
        peekBracket: playerState.peekBracket,
        activeBracket: playerState.activeBracket,
        currentMode: playerState.currentMode,
        nowPlayingSong: playerState.nowPlayingSong,
        theme: ui.getCurrentThemeIndex(),
        isWaveformActive: playerState.isWaveformActive,
        isVUActive: playerState.isVUActive,
        isBarActive: playerState.isBarActive,
        zoomFactor: playerState.zoomFactor
        // vuMetrics: playerState.vuMetrics
    };

    try {
        const response = await fetch('dbcontrol/save_state.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_state })
        });
        const result = await response.json();
        if (!result.success) {
            window.logmsg(`Failed to save state: ${result.message}`, 0);
        }
    } catch (error) {
        window.logmsg(`Error saving state: ${error}`, 0);
    }
}

window.toggleWaveform = () => {
    window.logmsg("[Waveform]", 1);
    const newState = !brackets.getPlayerState().isWaveformActive;
    brackets.updatePlayerState({ isWaveformActive: newState });
    ui.updateWaveformVisibility(newState);
    savePlayerState();
};

window.toggleVUMeters = () => {
    window.logmsg("[VUMeters]", 1);
    const state = brackets.getPlayerState();
    let newVUActive, newBarActive;

    // Cycle through states:
    // 1. VU on, Bar off (default)
    // 2. VU off, Bar off
    // 3. VU off, Bar on
    // 4. VU on, Bar on
    if (state.isVUActive && !state.isBarActive) {
        // State 1 -> State 2
        newVUActive = false;
        newBarActive = false;
    } else if (!state.isVUActive && !state.isBarActive) {
        // State 2 -> State 3
        newVUActive = false;
        newBarActive = true;
    } else if (!state.isVUActive && state.isBarActive) {
        // State 3 -> State 4
        newVUActive = true;
        newBarActive = true;
    } else {
        // State 4 -> State 1
        newVUActive = true;
        newBarActive = false;
    }

    brackets.updatePlayerState({ isVUActive: newVUActive, isBarActive: newBarActive });
    ui.updateVUMeterState(); // Update UI
    savePlayerState();
};

// script.js

window.togglePlayPause = async () => {
    // If the player object doesn't exist yet, this is the first play click.
    if (!player.sidPlayer) {
        console.log("First play click: Initializing player and loading song...");
        
        // 1. Initialize the player and create the audio context from a user gesture.
        await player.initPlayer();
        
        // 2. Determine which song to play based on the current mode.
        const state = brackets.getPlayerState();
        let songToPlay = null;

        if (state.currentMode === 'nowPlaying' && state.nowPlayingSong) {
            songToPlay = state.nowPlayingSong;
        } else {
            // Default to the first contender if not in "Now Playing" or if song is missing.
            songToPlay = state.contenders[0];
        }

        if (songToPlay) {
            // 3. Load the CORRECT song and tell it to autoplay.
            await player.loadSong(songToPlay, -1, {
                autoPlay: true,
                updateSongInfo: () => ui.updateSongInfo(player.sidPlayer),
                updatePlayPauseButton: () => ui.updatePlayPauseButton(player.isPlaying),
                resetVoiceStates: player.resetVoiceStates,
                updateNavigationButtons: () => ui.updateNavigationButtons(player.sidPlayer),
                updateVsMatchup: updateVsMatchupBound,
                updateJamButton: updateJamButtonBound,
                updateRoundInfo: updateRoundInfoBound
            });

            // 4. Update state and enable all controls.
            brackets.updatePlayerState({ hasPlayed: true });
            document.getElementById('prevButton').disabled = false;
            document.getElementById('nextButton').disabled = false;
            document.getElementById('jamButton').disabled = false;
            document.getElementById('ellipsis-button').disabled = false;
            ui.updateNavigationButtons(player.sidPlayer);
            updateWinnerButtonsBound();
        }
        return; // End the function here for the first play.
    }

    // --- If player already exists, this is a NORMAL play/pause toggle ---
    if (player.isPlaying) {
        player.sidPlayer.pause();
        player.setIsPlaying(false);
        player.stopTimer(updateJamButtonBound);
    } else {
        player.sidPlayer.play();
        player.setIsPlaying(true);
        player.startTimer(player.updateTimer, updateJamButtonBound);
    }
    ui.updatePlayPauseButton(player.isPlaying);
};

window.jamToggle = () => {
    window.logmsg("[jAM]", 1);
    brackets.jamToggle(
        player.sidPlayer,
        loadSongBound,
        () => ui.applyTheme(brackets.getPlayerState().currentMode),
        updateVsMatchupBound,
        updateRoundInfoBound,
        updateWinnerButtonsBound,
        updateFlameButtonBound,
        brackets.updateBracketDropdown
    ).then(() => savePlayerState());
};

window.setWinner = (index) => {
    window.logmsg(index === 0 ? "[ < Winner]" : "[Winner >]", 1);
    brackets.updateWinner(
        index,
        updateRoundInfoBound,
        updateWinnerButtonsBound,
        updateFlameButtonBound
    );
};

window.toggleFlame = () => {
    window.logmsg("[Flame]", 1);
    brackets.toggleFlame(
        updateFlameButtonBound,
        updateVsMatchupBound,
        updateWinnerButtonsBound
    );
};

window.toggleRevive = () => {
    window.logmsg("[Revive]", 1);
    brackets.toggleRevive(
        ui.updateReviveButton,
        () => ui.updateSongTitleHighlight(brackets.getPlayerState().currentMode, brackets.getPlayerState().isReviveActive)
    );
};

window.nextTrack = () => {
    window.logmsg("[>|]", 1);
    // ADDED: Check if the player exists
    if (!player.sidPlayer) return;

    const songInfo = player.sidPlayer.getSongInfo();
    // ADDED: Check if there is a next track
    if (songInfo.actualSubsong < songInfo.maxSubsong - 1) {
        const state = brackets.getPlayerState();
        // ADDED: Determine the current song's filename from the player state
        const currentSongFilename = state.currentMode === 'nowPlaying'
            ? state.nowPlayingSong
            : state.contenders[state.activeContender];
        
        if (currentSongFilename) {
            // REPLACED: Call the existing load function with the new track number
            loadSongBound(currentSongFilename, songInfo.actualSubsong + 1, true);
        }
    }
};

window.prevTrack = () => {
    window.logmsg("[|<]", 1);
    if (!player.sidPlayer) return;

    const songInfo = player.sidPlayer.getSongInfo();
    const state = brackets.getPlayerState();
    const currentSongFilename = state.currentMode === 'nowPlaying'
        ? state.nowPlayingSong
        : state.contenders[state.activeContender];

    if (currentSongFilename) {
        // MODIFIED: If on the first track (index 0), target track becomes 0 (restarting it).
        // Otherwise, target track is the previous track's index.
        const targetTrack = songInfo.actualSubsong > 0 ? songInfo.actualSubsong - 1 : 0;
        loadSongBound(currentSongFilename, targetTrack, true);
    }
};

window.changeBracket = () => {
    const bracketSelect = document.getElementById("bracket-select");
    if (!bracketSelect) {
        window.logmsg('Bracket select element not found in the DOM', 0);
        return;
    }
    const newBracket = bracketSelect.value.replace('-', ' - ');
    window.logmsg(`[Bracket: ${newBracket}]`, 1);
    brackets.changeBracket(
        updateFlameButtonBound,
        loadSongBound,
        updateRoundInfoBound,
        updateVsMatchupBound,
        updateWinnerButtonsBound
    );
    if (brackets.getPlayerState().currentMode === "bout") savePlayerState();
};

window.toggleColorScheme = () => {
    window.logmsg("[Theme]", 1);
    ui.toggleColorScheme(brackets.getPlayerState().currentMode);
    savePlayerState();
};

window.toggleSongList = toggleSongList;

function toggleSongList() {
    const overlay = document.getElementById("songListOverlay");
    const filterInput = document.getElementById("filterInput");
    const songListWrapper = document.getElementById("songListWrapper");
    const songList = document.getElementById("songList");

    if (!overlay || !filterInput || !songListWrapper || !songList) {
        window.logmsg('Song list elements not found in the DOM', 0);
        return;
    }

    if (overlay.style.display === "block") {
        const state = brackets.getPlayerState();

        if (state.peekPlayingSong) {
            if (player.sidPlayer) {
                player.sidPlayer.pause();
                player.setIsPlaying(false);
                player.stopTimer();
                debug("Stopped peeked song");
            }

            let songToLoad = null;
            let shouldAutoPlay = true;
            if (state.currentMode === "bout" && state.contenders.length > 0) {
                songToLoad = state.contenders[state.activeContender];
                shouldAutoPlay = state.hasPlayed;
            } else if (state.currentMode === "nowPlaying" && state.nowPlayingSong) {
                songToLoad = state.nowPlayingSong;
                shouldAutoPlay = true;
            }

            brackets.updatePlayerState({
                peekPlayingSong: null,
            });

            if (songToLoad) {
                loadSongBound(songToLoad, -1, shouldAutoPlay);
            }
        } else {
            brackets.updatePlayerState({
                peekPlayingSong: null,
            });
        }

        overlay.style.display = "none";
        currentOffset = 0;
        currentFilter = "";
        hasMoreSongs = true;
        songList.innerHTML = '';
        songListWrapper.dataset.observerSet = "";
        document.removeEventListener('keydown', handleEscapeKey);
        filterInput.removeEventListener('input', handleFilterInput);

        ui.applyTheme(state.currentMode);
        updateVsMatchupBound();
        updateRoundInfoBound();
        updateWinnerButtonsBound();
        updateFlameButtonBound();
    } else {
        overlay.style.display = "block";
        filterInput.value = "";
        currentOffset = 0;
        currentFilter = "";
        hasMoreSongs = true;
        songList.innerHTML = '';
        songListWrapper.dataset.observerSet = "";
        songListWrapper.scrollTop = 0;
        populateSongList("");
        document.addEventListener('keydown', handleEscapeKey);
        filterInput.addEventListener('input', handleFilterInput);
    }
}

function handleFilterInput() {
    const filterInput = document.getElementById("filterInput");
    if (!filterInput) {
        window.logmsg('Filter input not found in the DOM', 0);
        return;
    }
    const filterText = filterInput.value.trim();
    window.logmsg(`Applying filter: ${filterText}`, 2);
    populateSongList(filterText);
}

function handleEscapeKey(event) {
    if (event.key === "Escape") {
        window.logmsg("[esc]", 1);
        toggleSongList();
    }
}

let currentOffset = 0;
let currentFilter = '';
let isLoading = false;
let hasMoreSongs = true;

const SONGS_PER_FETCH = 500;

let currentObserver = null;

function populateSongList(filter) {
    const songList = document.getElementById("songList");
    const songListWrapper = document.getElementById("songListWrapper");
    const state = brackets.getPlayerState();

    if (!songList || !songListWrapper) {
        window.logmsg('Song list or wrapper not found in the DOM', 0);
        return;
    }

    if (filter !== currentFilter) {
        currentOffset = 0;
        currentFilter = filter;
        hasMoreSongs = true;
        songList.innerHTML = '';
        if (currentObserver) {
            currentObserver.disconnect();
            currentObserver = null;
        }
        songListWrapper.dataset.observerSet = "";
    }

    if (!hasMoreSongs || isLoading) return;

    isLoading = true;

    // Pass raw filter and bracket to backend
    let queryParams = `filter=${encodeURIComponent(filter)}&offset=${currentOffset}&limit=${SONGS_PER_FETCH}&user_id=${window.user.id}&bracket=${encodeURIComponent(state.peekBracket)}`;
    if (state.peekBracket !== "All" && state.peekBracket !== "Eliminated" && state.peekBracket !== "Leaderboard") {
        let [wins, losses] = state.peekBracket.split(' - ').map(Number);
        queryParams += `&wins=${wins}&losses=${losses}`;
    } else if (state.peekBracket === "Eliminated") {
        queryParams += "&wins=-1&losses=2";
    }

    window.logmsg(`Fetching songs with filter: ${filter}, offset: ${currentOffset}, limit: ${SONGS_PER_FETCH}, bracket: ${state.peekBracket}`, 2);
    fetch(`dbcontrol/get_sidtunes.php?${queryParams}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch songs: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(`Server error: ${data.error}`);
            }
            const { files, offset, limit, hasMore } = data;
            hasMoreSongs = hasMore;
            window.logmsg(`Received ${files.length} songs, hasMore: ${hasMore}, total contenders: ${currentOffset + files.length}`, 2);

            if (files.length === 0 && currentOffset === 0) {
                const li = document.createElement("li");
                li.textContent = "No contenders found";
                li.className = "no-results";
                songList.appendChild(li);
            } else {
                files.forEach(file => {
                    const li = document.createElement("li");
                    const displayText = `(${file.wins} - ${file.losses}) ${file.fullpath.replace('/sid/C64Music', '')}`;
                    li.textContent = displayText;
                    const relativePath = file.fullpath.replace('/sid/C64Music', '');
                    if (state.peekPlayingSong === file.fullpath) {
                        li.classList.add("playing");
                    }
                    li.onclick = () => {
                        window.logmsg(`(>)\n ${displayText}`, 1);
                        playSongOnDemand(file.fullpath);
                    };
                    songList.appendChild(li);
                });

                if (hasMoreSongs) {
                    const sentinel = document.createElement("li");
                    sentinel.id = "sentinel";
                    songList.appendChild(sentinel);

                    if (currentObserver) {
                        currentObserver.disconnect();
                        currentObserver = null;
                    }

                    const observer = new IntersectionObserver((entries) => {
                        if (entries[0].isIntersecting && !isLoading) {
                            populateSongList(currentFilter);
                        }
                    }, { root: songListWrapper, threshold: 0.1 });
                    observer.observe(sentinel);
                    currentObserver = observer;
                    songListWrapper.dataset.observerSet = "true";
                }
            }

            currentOffset = offset + limit;
            isLoading = false;
        })
        .catch(error => {
            window.logmsg(`Error fetching songs: ${error.message}`, 0);
            isLoading = false;
            const li = document.createElement("li");
            li.textContent = "Error loading songs";
            li.className = "no-results";
            songList.appendChild(li);
        });
}


function updatePlayingIndicator() {
    const songList = document.getElementById("songList");
    if (!songList) {
        window.logmsg('Song list not found in the DOM', 0);
        return;
    }
    songList.querySelectorAll("li").forEach(li => {
        const state = brackets.getPlayerState();
        // Split at " /" to get the relative path (e.g., "/DEMOS/0-9/1_45_Tune.sid")
        const textParts = li.textContent.split(" /");
        if (textParts.length < 2) {
            window.logmsg(`Invalid li textContent: ${li.textContent}`, 0);
            li.classList.remove("playing");
            return;
        }
        const relativePath = "/" + textParts[1].trim();
        if (state.peekPlayingSong === relativePath) {
            li.classList.add("playing");
        } else {
            li.classList.remove("playing");
        }
    });
}

function playSongOnDemand(filename) {
    const state = brackets.getPlayerState();
    if (state.peekPlayingSong === filename) {
        enterNowPlayingMode(filename);
        return;
    }
    const songBracket = brackets.getSongBracket(filename);
    brackets.updatePlayerState({ 
        peekPlayingSong: filename,
        nowPlayingSongBracket: songBracket
    });
    if (player.sidPlayer && player.isPlaying) {
        player.sidPlayer.pause();
        player.setIsPlaying(false);
        player.stopTimer();
    }
    loadSongBound(filename, -1, true);
    populateSongList(document.getElementById("filterInput")?.value || "");
    updatePlayingIndicator();
}

function enterNowPlayingMode(song) {
    const state = brackets.getPlayerState();
    const songBracket = brackets.getSongBracket(song);
    brackets.updatePlayerState({
        currentMode: "nowPlaying",
        nowPlayingSong: song,
        peekPlayingSong: null,
        nowPlayingSongBracket: songBracket
    });
    if (player.sidPlayer && player.isPlaying) {
        player.sidPlayer.pause();
        player.setIsPlaying(false);
        player.stopTimer();
    }
    loadSongBound(song, -1, true);
    ui.applyTheme("nowPlaying");
    toggleSongList();
    updateVsMatchupBound();
    updateRoundInfoBound();
    updateWinnerButtonsBound();
    updateFlameButtonBound();
    savePlayerState();
}

window.toggleAuthPopUp = (function() {
    let isToggling = false;
    return function() {
        if (isToggling) return;
        isToggling = true;
        setTimeout(() => { isToggling = false; }, 300);

        const overlay = document.getElementById('authOverlay');
        if (!overlay) {
            window.logmsg('Auth overlay not found in the DOM', 0);
            return;
        }
        if (overlay.style.display === 'block') {
            overlay.style.display = 'none';
            document.removeEventListener('keydown', handleAuthEscapeKey);
            document.getElementById('signInEmail').value = '';
            document.getElementById('signInPassword').value = '';
            document.getElementById('registerUsername').value = '';
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('registerConfirmPassword').value = '';
            document.getElementById('forgotPasswordEmail').value = '';
            const signInError = document.getElementById('signInError');
            const registerError = document.getElementById('registerError');
            const forgotPasswordMessage = document.getElementById('forgotPasswordMessage');
            if (signInError) signInError.textContent = '';
            if (registerError) registerError.textContent = '';
            if (forgotPasswordMessage) forgotPasswordMessage.textContent = '';
        } else {
            overlay.style.display = 'block';
            window.showAuthTab('signIn');
            document.addEventListener('keydown', handleAuthEscapeKey);
        }
    };
})();

function handleAuthEscapeKey(event) {
    if (event.key === "Escape") {
        window.toggleAuthPopUp();
    }
}

window.showAuthTab = function(tab) {
    const tabs = ['signIn', 'register', 'forgotPassword'];
    tabs.forEach(t => {
        const tabElement = document.getElementById(`${t}Tab`);
        const formElement = document.getElementById(`${t}Form`);
        if (t === tab) {
            if (tabElement) tabElement.classList.add('active');
            if (formElement) {
                formElement.classList.add('active');
                formElement.style.display = 'block';
            }
        } else {
            if (tabElement) tabElement.classList.remove('active');
            if (formElement) {
                formElement.classList.remove('active');
                formElement.style.display = 'none';
            }
        }
    });

    const signInError = document.getElementById('signInError');
    const registerError = document.getElementById('registerError');
    const forgotPasswordMessage = document.getElementById('forgotPasswordMessage');
    if (signInError) signInError.textContent = '';
    if (registerError) registerError.textContent = '';
    if (forgotPasswordMessage) forgotPasswordMessage.textContent = '';

    const signInEmail = document.getElementById('signInEmail');
    const signInPassword = document.getElementById('signInPassword');
    const registerUsername = document.getElementById('registerUsername');
    const registerEmail = document.getElementById('registerEmail');
    const registerPassword = document.getElementById('registerPassword');
    const registerConfirmPassword = document.getElementById('registerConfirmPassword');
    const forgotPasswordEmail = document.getElementById('forgotPasswordEmail');
    if (signInEmail) signInEmail.value = '';
    if (signInPassword) signInPassword.value = '';
    if (registerUsername) registerUsername.value = '';
    if (registerEmail) registerEmail.value = '';
    if (registerPassword) registerPassword.value = '';
    if (registerConfirmPassword) registerConfirmPassword.value = '';
    if (forgotPasswordEmail) forgotPasswordEmail.value = '';
};

window.handleSignIn = async function(event) {
    event.preventDefault();
    const signInEmail = document.getElementById('signInEmail');
    const signInPassword = document.getElementById('signInPassword');
    const errorElement = document.getElementById('signInError');
    if (!signInEmail || !signInPassword || !errorElement) {
        window.logmsg('Sign-in form elements not found in the DOM', 0);
        return;
    }
    const email = signInEmail.value;
    const password = signInPassword.value;

    try {
        const response = await fetch('dbcontrol/signin.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
        });
        const result = await response.json();
        if (result.success) {
            window.location.reload();
        } else {
            errorElement.textContent = result.message || 'Invalid email or password';
        }
    } catch (error) {
        window.logmsg(`Error in handleSignIn: ${error}`, 0);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

window.handleRegister = async function(event) {
    event.preventDefault();
    const registerUsername = document.getElementById('registerUsername');
    const registerEmail = document.getElementById('registerEmail');
    const registerPassword = document.getElementById('registerPassword');
    const registerConfirmPassword = document.getElementById('registerConfirmPassword');
    const errorElement = document.getElementById('registerError');
    if (!registerUsername || !registerEmail || !registerPassword || !registerConfirmPassword || !errorElement) {
        window.logmsg('Register form elements not found in the DOM', 0);
        return;
    }
    const username = registerUsername.value;
    const email = registerEmail.value;
    const password = registerPassword.value;
    const confirmPassword = registerConfirmPassword.value;

    if (password.length < 8) {
        errorElement.textContent = 'Password must be at least 8 characters long';
        return;
    }

    if (password !== confirmPassword) {
        errorElement.textContent = 'Passwords do not match';
        return;
    }

    try {
        const response = await fetch('dbcontrol/register.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
        });
        const result = await response.json();
        if (result.success) {
            window.location.reload();
        } else {
            errorElement.textContent = result.message || 'Registration failed';
        }
    } catch (error) {
        window.logmsg(`Error in handleRegister: ${error}`, 0);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

window.handleForgotPassword = async function(event) {
    event.preventDefault();
    const forgotPasswordEmail = document.getElementById('forgotPasswordEmail');
    const messageElement = document.getElementById('forgotPasswordMessage');
    if (!forgotPasswordEmail || !messageElement) {
        window.logmsg('Forgot password form elements not found in the DOM', 0);
        return;
    }
    const email = forgotPasswordEmail.value;

    try {
        const response = await fetch('dbcontrol/send_reset_email.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `email=${encodeURIComponent(email)}`
        });
        const result = await response.json();

        if (result.success) {
            messageElement.style.color = 'green';
            messageElement.textContent = result.message || 'If this email address was registered, a password reset link will be sent.';
        } else {
            messageElement.style.color = 'red';
            messageElement.textContent = result.message || 'Failed to send reset email';
        }
    } catch (error) {
        window.logmsg(`Error in handleForgotPassword: ${error}`, 0);
        messageElement.style.color = 'red';
        messageElement.textContent = 'An error occurred. Please try again.';
    }
};

window.togglePreferencesPopUp = function() {
    const overlay = document.getElementById('preferencesOverlay');
    if (!overlay) {
        window.logmsg('Preferences overlay not found in the DOM', 0);
        return;
    }
    if (overlay.style.display === 'block') {
        const updatePasswordSuccess = document.getElementById('updatePasswordSuccess');
        const updateUsernameSuccess = document.getElementById('updateUsernameSuccess');
        const updateEmailSuccess = document.getElementById('updateEmailSuccess');
        if (updatePasswordSuccess?.style.display === 'block' ||
            updateUsernameSuccess?.style.display === 'block' ||
            updateEmailSuccess?.style.display === 'block') {
            window.location.reload();
        }
        overlay.style.display = 'none';
        document.removeEventListener('keydown', handlePreferencesEscapeKey);
    } else {
        overlay.style.display = 'block';
        window.showPreferencesTab('password');
        document.addEventListener('keydown', handlePreferencesEscapeKey);
    }
};

function handlePreferencesEscapeKey(event) {
    if (event.key === "Escape") {
        window.togglePreferencesPopUp();
    }
}

window.closePreferencesAndReload = function() {
    window.togglePreferencesPopUp();
    window.location.reload();
};

window.showPreferencesTab = function(tab) {
    const tabs = ['password', 'username', 'email', 'advanced'];
    tabs.forEach(t => {
        const tabElement = document.getElementById(`${t}Tab`);
        const formElement = document.getElementById(`${t}Form`);
        if (t === tab) {
            if (tabElement) tabElement.classList.add('active');
            if (formElement) {
                formElement.classList.add('active');
                formElement.style.display = 'block';
            }
        } else {
            if (tabElement) tabElement.classList.remove('active');
            if (formElement) {
                formElement.classList.remove('active');
                formElement.style.display = 'none';
            }
        }
    });

    const updatePasswordError = document.getElementById('updatePasswordError');
    const updateUsernameError = document.getElementById('updateUsernameError');
    const updateEmailError = document.getElementById('updateEmailError');
    const deleteAccountError = document.getElementById('deleteAccountError');
    if (updatePasswordError) updatePasswordError.textContent = '';
    if (updateUsernameError) updateUsernameError.textContent = '';
    if (updateEmailError) updateEmailError.textContent = '';
    if (deleteAccountError) deleteAccountError.textContent = '';

    const updatePasswordSection = document.getElementById('updatePasswordSection');
    const updatePasswordSuccess = document.getElementById('updatePasswordSuccess');
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmNewPassword = document.getElementById('confirmNewPassword');
    if (updatePasswordSection) updatePasswordSection.style.display = 'block';
    if (updatePasswordSuccess) updatePasswordSuccess.style.display = 'none';
    if (currentPassword) currentPassword.value = '';
    if (newPassword) newPassword.value = '';
    if (confirmNewPassword) confirmNewPassword.value = '';

    const updateUsernameSection = document.getElementById('updateUsernameSection');
    const updateUsernameSuccess = document.getElementById('updateUsernameSuccess');
    const updateUsernameConfirmation = document.getElementById('updateUsernameConfirmation');
    const newUsername = document.getElementById('newUsername');
    if (updateUsernameSection) updateUsernameSection.style.display = 'block';
    if (updateUsernameSuccess) updateUsernameSuccess.style.display = 'none';
    if (updateUsernameConfirmation) updateUsernameConfirmation.style.display = 'none';
    if (newUsername) newUsername.value = '';

    const updateEmailSection = document.getElementById('updateEmailSection');
    const updateEmailSuccess = document.getElementById('updateEmailSuccess');
    const newEmail = document.getElementById('newEmail');
    if (updateEmailSection) updateEmailSection.style.display = 'block';
    if (updateEmailSuccess) updateEmailSuccess.style.display = 'none';
    if (newEmail) newEmail.value = '';
    window.hideUpdateEmailConfirmation();

    window.hideDeleteAccountConfirmation();
};

window.handleUpdatePassword = async function(event) {
    event.preventDefault();
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmNewPassword = document.getElementById('confirmNewPassword');
    const errorElement = document.getElementById('updatePasswordError');
    if (!currentPassword || !newPassword || !confirmNewPassword || !errorElement) {
        window.logmsg('Update password form elements not found in the DOM', 0);
        return;
    }
    const currentPasswordValue = currentPassword.value;
    const newPasswordValue = newPassword.value;
    const confirmNewPasswordValue = confirmNewPassword.value;

    if (newPasswordValue !== confirmNewPasswordValue) {
        errorElement.textContent = 'New passwords do not match';
        return;
    }

    try {
        const response = await fetch('dbcontrol/update_password.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ currentPassword: currentPasswordValue, newPassword: newPasswordValue })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('updatePasswordSection').style.display = 'none';
            document.getElementById('updatePasswordSuccess').style.display = 'block';
        } else {
            errorElement.textContent = data.message;
        }
    } catch (error) {
        window.logmsg(`Error in handleUpdatePassword: ${error}`, 0);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

window.handleUpdateUsername = async function(event) {
    event.preventDefault();
    const newUsername = document.getElementById('newUsername');
    const errorElement = document.getElementById('updateUsernameError');
    if (!newUsername || !errorElement) {
        window.logmsg('Update username form elements not found in the DOM', 0);
        return;
    }
    const newUsernameValue = newUsername.value;

    if (newUsernameValue.length < 3) {
        errorElement.textContent = 'Username must be at least 3 characters long';
        return;
    }

    window.newUsernameToUpdate = newUsernameValue;
    window.showUpdateUsernameConfirmation();
};

window.showUpdateUsernameConfirmation = function() {
    const updateUsernameSection = document.getElementById('updateUsernameSection');
    const updateUsernameConfirmation = document.getElementById('updateUsernameConfirmation');
    const confirmNewUsername = document.getElementById('confirmNewUsername');
    const confirmUsernameError = document.getElementById('confirmUsernameError');
    if (!updateUsernameSection || !updateUsernameConfirmation || !confirmNewUsername || !confirmUsernameError) {
        window.logmsg('Update username confirmation elements not found in the DOM', 0);
        return;
    }
    updateUsernameSection.style.display = 'none';
    updateUsernameConfirmation.style.display = 'block';
    confirmNewUsername.textContent = window.newUsernameToUpdate;
    confirmUsernameError.textContent = '';
};

window.hideUpdateUsernameConfirmation = function() {
    const updateUsernameConfirmation = document.getElementById('updateUsernameConfirmation');
    const updateUsernameSection = document.getElementById('updateUsernameSection');
    const updateUsernameError = document.getElementById('updateUsernameError');
    if (!updateUsernameConfirmation || !updateUsernameSection || !updateUsernameError) {
        window.logmsg('Update username confirmation elements not found in the DOM', 0);
        return;
    }
    updateUsernameConfirmation.style.display = 'none';
    updateUsernameSection.style.display = 'block';
    updateUsernameError.textContent = '';
};

window.confirmUpdateUsername = async function() {
    const newUsername = window.newUsernameToUpdate;
    const errorElement = document.getElementById('confirmUsernameError');
    const updateUsernameConfirmation = document.getElementById('updateUsernameConfirmation');
    const updateUsernameSuccess = document.getElementById('updateUsernameSuccess');
    if (!errorElement || !updateUsernameConfirmation || !updateUsernameSuccess) {
        window.logmsg('Confirm username elements not found in the DOM', 0);
        return;
    }

    try {
        const response = await fetch('dbcontrol/update_username.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ newUsername })
        });
        const data = await response.json();
        if (data.success) {
            updateUsernameConfirmation.style.display = 'none';
            updateUsernameSuccess.style.display = 'block';
        } else {
            errorElement.textContent = data.message;
        }
    } catch (error) {
        window.logmsg(`Error in confirmUpdateUsername: ${error}`, 0);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

window.handleUpdateEmail = async function(event) {
    event.preventDefault();
    const newEmail = document.getElementById('newEmail');
    const errorElement = document.getElementById('updateEmailError');
    if (!newEmail || !errorElement) {
        window.logmsg('Update email form elements not found in the DOM', 1);
        return;
    }
    const newEmailValue = newEmail.value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmailValue)) {
        errorElement.textContent = 'Please enter a valid email address';
        return;
    }

    window.newEmailToUpdate = newEmailValue;
    window.showUpdateEmailConfirmation();
};

window.showUpdateEmailConfirmation = function() {
    const updateEmailSection = document.getElementById('updateEmailSection');
    const updateEmailConfirmation = document.getElementById('updateEmailConfirmation');
    const confirmNewEmail = document.getElementById('confirmNewEmail');
    const confirmPassword = document.getElementById('confirmPassword');
    const confirmEmailError = document.getElementById('confirmEmailError');
    if (!updateEmailSection || !updateEmailConfirmation || !confirmNewEmail || !confirmPassword || !confirmEmailError) {
        window.logmsg('Update email confirmation elements not found in the DOM', 1);
        return;
    }
    updateEmailSection.style.display = 'none';
    updateEmailConfirmation.style.display = 'block';
    confirmNewEmail.textContent = window.newEmailToUpdate;
    confirmPassword.value = '';
    confirmEmailError.textContent = '';
};

window.hideUpdateEmailConfirmation = function() {
    const updateEmailConfirmation = document.getElementById('updateEmailConfirmation');
    const updateEmailSection = document.getElementById('updateEmailSection');
    const updateEmailError = document.getElementById('updateEmailError');
    if (!updateEmailConfirmation || !updateEmailSection || !updateEmailError) {
        window.logmsg('Update email confirmation elements not found in the DOM', 1);
        return;
    }
    updateEmailConfirmation.style.display = 'none';
    updateEmailSection.style.display = 'block';
    updateEmailError.textContent = '';
};

window.confirmUpdateEmail = async function(event) {
    event.preventDefault();
    const confirmPassword = document.getElementById('confirmPassword');
    const errorElement = document.getElementById('confirmEmailError');
    const currentEmail = document.getElementById('currentEmail');
    const updateEmailConfirmation = document.getElementById('updateEmailConfirmation');
    const updateEmailSuccess = document.getElementById('updateEmailSuccess');
    if (!confirmPassword || !errorElement || !currentEmail || !updateEmailConfirmation || !updateEmailSuccess) {
        window.logmsg('Confirm email elements not found in the DOM', 1);
        return;
    }
    const confirmPasswordValue = confirmPassword.value;
    const newEmail = window.newEmailToUpdate;

    try {
        const response = await fetch('dbcontrol/update_email.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ newEmail, confirmPassword: confirmPasswordValue })
        });
        const data = await response.json();
        if (data.success) {
            currentEmail.textContent = newEmail;
            updateEmailConfirmation.style.display = 'none';
            updateEmailSuccess.style.display = 'block';
        } else {
            errorElement.textContent = data.message;
        }
    } catch (error) {
        window.logmsg(`Error in confirmUpdateEmail: ${error}`, 1);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

window.stopPlayer = function() {
    if (window.sidPlayer) {
        window.sidPlayer.stop();
        window.sidPlayer = null;
    }
    const playButton = document.getElementById('playPauseButton');
    if (playButton) {
        playButton.style.backgroundImage = "url('../image/play.png')";
        playButton.setAttribute('aria-label', 'Play');
    } else {
        window.logmsg('Play/Pause button not found in the DOM', 1);
    }
};

window.resetPlayer = function() {
    window.allTunes = [];
    window.peekBracket = 0;
    window.currentSongIndex = 0;
    window.sidPlayer = null;

    const songInfo = document.getElementById('songInfo');
    if (songInfo) {
        songInfo.textContent = 'Press Play';
    } else {
        window.logmsg('Song info element not found in the DOM', 1);
    }

    brackets.updatePlayerState({ hasPlayed: false, isFlameActive: false });
    ui.updateFlameButton(brackets.getPlayerState(), null);
};

window.updateUIForLogout = function() {
    const preferencesLink = document.getElementById('preferencesLink');
    const profileIcon = document.getElementById('profileIcon');
    const authLink = document.getElementById('authLink');
    const userGreeting = document.getElementById('userGreeting');

    if (preferencesLink) preferencesLink.style.display = 'none';
    if (profileIcon) profileIcon.style.display = 'none';
    if (authLink) {
        authLink.style.display = 'inline';
        authLink.textContent = 'Sign In';
    }
    if (userGreeting) userGreeting.textContent = '';
};

window.handleLogout = async function(event) {
    event.preventDefault();

    window.stopPlayer();

    try {
        const response = await fetch('dbcontrol/logout.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const data = await response.json();

        if (data.success) {
            window.location.reload();
        } else {
            alert(data.message);
        }
    } catch (error) {
        window.logmsg(`Error in handleLogout: ${error}`, 1);
        alert('An error occurred. Please try again.');
    }
};

window.showDeleteAccountConfirmation = function() {
    const deleteAccountSection = document.getElementById('deleteAccountSection');
    const deleteAccountConfirmation = document.getElementById('deleteAccountConfirmation');
    if (!deleteAccountSection || !deleteAccountConfirmation) {
        window.logmsg('Delete account confirmation elements not found in the DOM', 1);
        return;
    }
    deleteAccountSection.style.display = 'none';
    deleteAccountConfirmation.style.display = 'block';
};

window.hideDeleteAccountConfirmation = function() {
    const deleteAccountSection = document.getElementById('deleteAccountSection');
    const deleteAccountConfirmation = document.getElementById('deleteAccountConfirmation');
    const deleteAccountError = document.getElementById('deleteAccountError');
    if (!deleteAccountSection || !deleteAccountConfirmation || !deleteAccountError) {
        window.logmsg('Delete account confirmation elements not found in the DOM', 1);
        return;
    }
    deleteAccountSection.style.display = 'block';
    deleteAccountConfirmation.style.display = 'none';
    deleteAccountError.textContent = '';
};

window.handleDeleteAccount = async function(event) {
    event.preventDefault();
    const deletePassword = document.getElementById('deletePassword');
    const errorElement = document.getElementById('deleteAccountError');
    if (!deletePassword || !errorElement) {
        window.logmsg('Delete account form elements not found in the DOM', 1);
        return;
    }
    const password = deletePassword.value;

    window.stopPlayer();

    try {
        const response = await fetch('dbcontrol/delete_account.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `password=${encodeURIComponent(password)}`
        });
        const result = await response.json();
        if (result.success) {
            window.location.reload();
        } else {
            errorElement.textContent = result.message || 'Failed to delete account';
        }
    } catch (error) {
        window.logmsg(`Error in handleDeleteAccount: ${error}`);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

function getComplementaryColor(hexColor) {
    hexColor = hexColor.replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    const compR = (255 - r).toString(16).padStart(2, '0');
    const compG = (255 - g).toString(16).padStart(2, '0');
    const compB = (255 - b).toString(16).padStart(2, '0');
    return `#${compR}${compG}${compB}`;
}

window.flashProfileIcon = function() {
    const bitmapContainer = document.getElementById('profile-bitmap');
    if (!bitmapContainer) {
        window.logmsg('Profile bitmap container not found for flashing', 1);
        return;
    }

    let currentColor = null;
    const pixels = bitmapContainer.children;
    for (let i = 0; i < pixels.length; i++) {
        const bgColor = window.getComputedStyle(pixels[i]).backgroundColor;
        if (bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            const rgb = bgColor.match(/\d+/g);
            currentColor = `#${parseInt(rgb[0]).toString(16).padStart(2, '0')}${parseInt(rgb[1]).toString(16).padStart(2, '0')}${parseInt(rgb[2]).toString(16).padStart(2, '0')}`;
            break;
        }
    }

    if (!currentColor) {
        currentColor = baseColorSchemes[ui.getCurrentThemeIndex()].exteriorTextColor || '#000000';
        renderProfileBitmap(window.isLoggedIn || false, currentColor);
    }

    const complementaryColor = getComplementaryColor(currentColor);
    let flashCount = 0;
    const maxFlashes = 14;
    const flashDuration = 500;

    function flash() {
        if (flashCount >= maxFlashes) {
            renderProfileBitmap(window.isLoggedIn || false, currentColor);
            return;
        }

        const colorToUse = flashCount % 2 === 0 ? complementaryColor : currentColor;
        renderProfileBitmap(window.isLoggedIn || false, colorToUse);
        flashCount++;
        setTimeout(flash, flashDuration);
    }
    flash();
};

async function initializeApp() {
    window.logmsg('sID JAm application initializing...');
    const profileIcon = document.getElementById('profile-icon');
    if (profileIcon) {
        profileIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.isLoggedIn) {
                window.togglePreferencesPopUp();
            } else {
                window.toggleAuthPopUp();
            }
        });
    }

    try {
        // Player is NOT initialized here. We wait for the user's click.
        
        // Fetch all necessary data (sidtunes, results, etc.)
        const songsResponse = await fetch(`dbcontrol/get_sidtunes.php?full_list=true&user_id=${window.user.id}`);
        if (!songsResponse.ok) throw new Error(`Failed to load sidtunes: ${songsResponse.statusText}`);
        const tunesData = await songsResponse.json();
        window.sidJamData.sidFiles = tunesData.map(tune => tune.fullpath);
        window.sidJamData.pathToId = {};
        window.sidJamData.pathToRecord = {};
        tunesData.forEach(tune => {
            window.sidJamData.pathToId[tune.fullpath] = tune.id;
            window.sidJamData.pathToRecord[tune.fullpath] = { wins: tune.wins, losses: tune.losses };
        });

        const leaderboardResponse = await fetch('dbcontrol/get_sidtunes.php?full_list=true&bracket=Leaderboard');
        if (!leaderboardResponse.ok) throw new Error(`Failed to load Leaderboard tunes: ${leaderboardResponse.statusText}`);
        const leaderboardData = await leaderboardResponse.json();
        leaderboardData.forEach(tune => {
            window.sidJamData.pathToRecord[tune.fullpath] = { wins: tune.wins, losses: tune.losses };
        });

        const resultsResponse = await fetch(`dbcontrol/get_results.php?user_id=${window.user.id}`);
        if (!resultsResponse.ok) throw new Error(`Failed to load results: ${resultsResponse.statusText}`);
        window.sidJamData.cachedResults = await resultsResponse.json();

        // Determine initial state.
        const player_state = await loadPlayerState();
        
        let isValidState = true;
        if (player_state) {
            const validPaths = new Set(window.sidJamData.sidFiles);
            if (player_state.contenders?.some(path => path && !validPaths.has(path))) {
                window.logmsg("Invalidating saved state due to missing contender path.", 1);
                isValidState = false;
            }
            if (player_state.nowPlayingSong && !validPaths.has(player_state.nowPlayingSong)) {
                window.logmsg("Invalidating saved state due to missing nowPlayingSong path.", 1);
                isValidState = false;
            }
        }

        if (player_state && isValidState) {
            brackets.updatePlayerState({ ...player_state });
        } else {
            if (!player_state || !isValidState) {
                window.logmsg("No valid saved state found. Starting a new bout.", 1);
            }
            brackets.pickContenders(updateRoundInfoBound, updateVsMatchupBound, updateWinnerButtonsBound, updateFlameButtonBound);
        }

        updateVsMatchupBound();
        updateRoundInfoBound();
        brackets.updateBracketDropdown();
        
    } catch (error) {
        window.logmsg(`Error during data initialization: ${error}`, 0);
        brackets.pickContenders(updateRoundInfoBound, updateVsMatchupBound, updateWinnerButtonsBound, updateFlameButtonBound);
        updateVsMatchupBound();
        updateRoundInfoBound();
    }

    // SET INITIAL UI STATE (NO SONG LOADED)
    document.getElementById('playPauseButton').disabled = false;
    document.getElementById('prevButton').disabled = true;
    document.getElementById('nextButton').disabled = true;
    document.getElementById('jamButton').disabled = true;
    document.getElementById('ellipsis-button').disabled = true;
    const winnerLeft = document.getElementById('winner-left');
    const winnerRight = document.getElementById('winner-right');
    if (winnerLeft) winnerLeft.classList.add('disabled');
    if (winnerRight) winnerRight.classList.add('disabled');
    
    ui.applyTheme(brackets.getPlayerState().currentMode);
    updateWinnerButtonsBound();
    updateFlameButtonBound();
    renderWinnerButtonBitmap(0, brackets.getPlayerState());
    renderWinnerButtonBitmap(1, brackets.getPlayerState());
    
    console.log("Application ready. Waiting for user to press Play.");
}
    
document.addEventListener('DOMContentLoaded', () => {
    const helpButton = document.getElementById('help-button'); // This is the button that *opens* the help
    if (helpButton) {
        helpButton.addEventListener('click', () => {
            window.logmsg('Help button clicked, opening help.html in new tab', 1);
            window.open('help.html', '_blank'); // Opens help.html in a new tab
        });
    } else {
        window.logmsg('Help button with ID "help-button" not found in the DOM.', 0);
    }
        document.querySelectorAll('.voice-button').forEach(button => {
        button.addEventListener('click', (event) => {
            // Extract the voice number (1, 2, or 3) from the button's ID
            const voiceNum = event.currentTarget.id.replace('voice', '');
            if (voiceNum) {
                player.toggleVoice(voiceNum);
            }
        });
    });
});


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeApp();
    });
} else {
    initializeApp();
}

const logPlayerStateButton = document.getElementById('log-player-state');
if (logPlayerStateButton) {
    logPlayerStateButton.addEventListener('click', () => {
        console.log(`Current playerState: ${JSON.stringify(brackets.getPlayerState())}`);
    });
}