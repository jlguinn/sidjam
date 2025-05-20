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

window.logmsg("Default logMsg");
window.logmsg("Verbose logMsg", 1);

// Define bound functions at the top to ensure availability
const updateTimerBound = () => player.updateTimer();
const loadSongBound = (filename, trackNumber, autoPlay = true) => player.loadSong(
    filename, trackNumber,
    () => ui.updateSongInfo(player.sidPlayer),
    () => ui.updatePlayPauseButton(player.isPlaying),
    player.resetVoiceStates,
    () => ui.updateNavigationButtons(player.sidPlayer),
    updateVsMatchupBound,
    updateJamButtonBound,
    autoPlay
);
const updateVsMatchupBound = () => {
    ui.updateVsMatchup(brackets.getPlayerState());
    checkSong2Clipping(); 
};
const updateRoundInfoBound = () => ui.updateRoundInfo(brackets.getPlayerState());
const updateWinnerButtonsBound = () => ui.updateWinnerButtons(brackets.getPlayerState(), player.sidPlayer);
const updateFlameButtonBound = () => ui.updateFlameButton(brackets.getPlayerState(), player.sidPlayer);
const updateJamButtonBound = (isPlaying) => ui.updateJamButton(isPlaying, brackets.getPlayerState(), player.sidPlayer);

// Export and make loadPlayerState globally accessible
export async function loadPlayerState() {
    try {
        const response = await fetch(`dbcontrol/get_player_state.php?user_id=${window.user.id}`);
        if (!response.ok) throw new Error(`Failed to load player_state: ${response.statusText}`);
        const data = await response.json();
        if (data.success && data.player_state) {
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
    const state = brackets.getPlayerState();
    const player_state = {
        contenders: state.contenders,
        peekBracket: state.peekBracket,
        activeBracket: state.activeBracket,
        currentMode: state.currentMode,
        nowPlayingSong: state.nowPlayingSong,
        theme: ui.getCurrentThemeIndex(),
        isWaveformActive: state.isWaveformActive,
        isVUActive: state.isVUActive,
        zoomFactor: state.zoomFactor
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

function checkSong2Clipping() {
    const song2 = document.getElementById('song2');
    const authLink = document.getElementById('auth-link');
    const preferencesLink = document.getElementById('preferences-link');

    if (!song2) {
        window.logmsg('song2 element not found', 0);
        return;
    }

    const tempElement = document.createElement('span');
    tempElement.style.visibility = 'hidden';
    tempElement.style.position = 'absolute';
    tempElement.style.whiteSpace = 'nowrap';
    tempElement.style.font = window.getComputedStyle(song2).font;
    tempElement.textContent = song2.textContent;
    document.body.appendChild(tempElement);

    const intrinsicWidth = tempElement.offsetWidth;
    document.body.removeChild(tempElement);

    const clippingThreshold = 194;
    const displayValue = intrinsicWidth > clippingThreshold ? 'none' : 'block';
    if (authLink) authLink.style.display = displayValue;
    if (preferencesLink) preferencesLink.style.display = displayValue;
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
    const newState = !brackets.getPlayerState().isVUActive;
    brackets.updatePlayerState({ isVUActive: newState });
    ui.updateVUMeterVisibility(newState);
    savePlayerState();
};

window.togglePlayPause = async () => {
    const wasPlaying = player.isPlaying;
    await player.togglePlayPause(
        updateRoundInfoBound,
        () => ui.updatePlayPauseButton(player.isPlaying),
        updateWinnerButtonsBound,
        updateFlameButtonBound,
        updateJamButtonBound,
        () => player.initPlayer(
            brackets.getPlayerState,
            updateWinnerButtonsBound,
            updateFlameButtonBound,
            updateJamButtonBound,
            loadSongBound
        ),
        brackets.updatePlayerState
    );
    if (player.isPlaying && !wasPlaying) {
        window.logmsg("[>]", 1);
    } else if (!player.isPlaying && wasPlaying) {
        window.logmsg("[||]", 1);
    }
    const ellipsisButton = document.getElementById("ellipsis-button");
    if (ellipsisButton) {
        ellipsisButton.disabled = false;
    } else {
        window.logmsg('Ellipsis button not found in the DOM', 0);
    }
    updateVsMatchupBound();
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
    player.nextTrack(
        brackets.getPlayerState,
        loadSongBound
    );
};

window.prevTrack = () => {
    window.logmsg("[|<]", 1);
    player.prevTrack(
        brackets.getPlayerState,
        loadSongBound
    );
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
    const filterText = filterInput.value;
    populateSongList(filterText);
}

function handleEscapeKey(event) {
    window.logmsg("[esc]", 1);
    if (event.key === "Escape") {
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

    let queryParams = `filter=${encodeURIComponent(filter)}&offset=${currentOffset}&limit=${SONGS_PER_FETCH}&user_id=${window.user.id}`;
    if (state.peekBracket !== "All" && state.peekBracket !== "Eliminated") {
        let [wins, losses] = state.peekBracket.split(' - ').map(Number);
        queryParams += `&wins=${wins}&losses=${losses}`;
    } else if (state.peekBracket === "Eliminated") {
        queryParams += "&wins=-1&losses=2";
    }

    fetch(`dbcontrol/get_sidtunes.php?${queryParams}`)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch songs: ${response.status}`);
            return response.json();
        })
        .then(data => {
            const { files, offset, limit, hasMore } = data;
            hasMoreSongs = hasMore;

            if (files.length === 0 && currentOffset === 0) {
                const li = document.createElement("li");
                li.textContent = "No contenders found";
                li.className = "no-results";
                songList.appendChild(li);
            } else {
                files.forEach(file => {
                    const li = document.createElement("li");
                    li.textContent = file.replace('/sid/C64Music', '');
                    if (state.peekPlayingSong === file) {
                        li.classList.add("playing");
                    }
                    li.onclick = () => {
                        window.logmsg(`(>)\n ${file.replace('/sid/C64Music', '')}`, 1);
                        playSongOnDemand(file);
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
            window.logmsg(`Error fetching songs: ${error}`, 0);
            isLoading = false;
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
        if (li.textContent === state.peekPlayingSong) {
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
        window.logmsg('Update email form elements not found in the DOM', 0);
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
        window.logmsg('Update email confirmation elements not found in the DOM', 0);
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
        window.logmsg('Update email confirmation elements not found in the DOM', 0);
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
        window.logmsg('Confirm email elements not found in the DOM', 0);
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
        window.logmsg(`Error in confirmUpdateEmail: ${error}`, 0);
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
        window.logmsg('Play/Pause button not found in the DOM', 0);
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
        window.logmsg('Song info element not found in the DOM', 0);
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
        window.logmsg(`Error in handleLogout: ${error}`, 0);
        alert('An error occurred. Please try again.');
    }
};

window.showDeleteAccountConfirmation = function() {
    const deleteAccountSection = document.getElementById('deleteAccountSection');
    const deleteAccountConfirmation = document.getElementById('deleteAccountConfirmation');
    if (!deleteAccountSection || !deleteAccountConfirmation) {
        window.logmsg('Delete account confirmation elements not found in the DOM', 0);
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
        window.logmsg('Delete account confirmation elements not found in the DOM', 0);
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
        window.logmsg('Delete account form elements not found in the DOM', 0);
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
        window.logmsg(`Error in handleDeleteAccount: ${error}`, 0);
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
        window.logmsg('Profile bitmap container not found for flashing', 0);
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
    // Debug to confirm bound functions
    debug(`Bound functions defined: updateRoundInfoBound=${typeof updateRoundInfoBound}, updateVsMatchupBound=${typeof updateVsMatchupBound}`);

    const authLink = document.getElementById('auth-link');
    const preferencesLink = document.getElementById('preferences-link');
    const profileIcon = document.getElementById('profile-icon');
    const userInfo = document.getElementById('user-info');

    window.hasShownPrompt = false;
    window.showPromptMessage = false;

    window.logmsg('Preloading flame sprite sheet', 2);

    if (authLink) {
        authLink.removeEventListener('click', window.toggleAuthPopUp);
        authLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.toggleAuthPopUp();
        });
    }

    if (preferencesLink) {
        preferencesLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.togglePreferencesPopUp();
        });
    }

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

    if (userInfo) {
        userInfo.addEventListener('click', (e) => {
            window.logmsg(`user-info clicked, target: ${e.target.id}`);
        });
    }

    const waveformToggleButton = document.getElementById('wave-toggle-button');
    if (waveformToggleButton) {
        waveformToggleButton.addEventListener('click', window.toggleWaveform);
    } else {
        window.logmsg('Waveform toggle button not found in the DOM', 0);
    }

    const vuToggleButton = document.getElementById('vu-toggle-button');
    if (vuToggleButton) {
        vuToggleButton.addEventListener('click', window.toggleVUMeters);
    } else {
        window.logmsg('VU toggle button not found in the DOM', 0);
    }

    // Add zoom button event listeners and disable initially
    window.logmsg('Adding zoom button listeners...');
    const zoomOutButton = document.getElementById('zoom-out-button');
    const zoomInButton = document.getElementById('zoom-in-button');
    const resetButton = document.getElementById('reset-view-button');
    if (zoomOutButton) {
        window.logmsg('Adding zoom out listener', 2);
        zoomOutButton.addEventListener('click', () => {
            window.logmsg('[-]', 1);
            zoomWaveformOut();
            savePlayerState();
        });
        zoomOutButton.disabled = true;
    } else {
        window.logmsg('Zoom out button not found in the DOM', 0);
    }
    if (zoomInButton) {
        window.logmsg('Adding zoom in listener', 2);
        zoomInButton.addEventListener('click', () => {
            window.logmsg('[+]', 1);
            zoomWaveformIn();
            savePlayerState();
        });
        zoomInButton.disabled = true;
    } else {
        window.logmsg('Zoom in button not found in the DOM', 0);
    }
    if (resetButton) {
        window.logmsg('Adding reset view listener', 2);
        resetButton.addEventListener('click', () => {
            window.logmsg('[⭯]', 1);
            resetView();
            savePlayerState();
        });
        resetButton.disabled = true;
    } else {
        window.logmsg('Reset view button not found in the DOM', 0);
    }

    if (!window.user || !window.user.id) {
        window.logmsg('window.user.id not defined on DOM load', 0);
        return;
    }

    try {
        const songsResponse = await fetch('dbcontrol/get_sidtunes.php?full_list=true');
        if (!songsResponse.ok) throw new Error(`Failed to load sidtunes: ${songsResponse.statusText}`);
        const tunesData = await songsResponse.json();
        window.sidJamData.sidFiles = tunesData.map(tune => tune.fullpath);
        if (!window.sidJamData.sidFiles || window.sidJamData.sidFiles.length === 0) throw new Error('No songs loaded from sidtunes');
        window.sidJamData.pathToId = {};
        tunesData.forEach(tune => {
            window.sidJamData.pathToId[tune.fullpath] = tune.id;
        });

        const resultsResponse = await fetch(`dbcontrol/get_results.php?user_id=${window.user.id}`);
        if (!resultsResponse.ok) throw new Error(`Failed to load results: ${resultsResponse.statusText}`);
        window.sidJamData.cachedResults = await resultsResponse.json();

        const player_state = await loadPlayerState();
        // Validate player_state paths
        let isValidState = true;
        if (player_state) {
            const validPaths = new Set(window.sidJamData.sidFiles);
            // Check contenders and nowPlayingSong
            if (player_state.contenders) {
                player_state.contenders.forEach((path, index) => {
                    if (path && !validPaths.has(path)) {
                        window.logmsg(`Invalid contender path in saved state: ${path}`, 0);
                        isValidState = false;
                    }
                });
            }
            if (player_state.nowPlayingSong && !validPaths.has(player_state.nowPlayingSong)) {
                window.logmsg(`Invalid nowPlayingSong path in saved state: ${player_state.nowPlayingSong}`, 0);
                isValidState = false;
            }
        }

        if (player_state && isValidState && player_state.contenders && player_state.currentMode === "bout" && player_state.contenders[0] && player_state.contenders[1]) {
            brackets.updatePlayerState({
                contenders: player_state.contenders,
                peekBracket: player_state.activeBracket,
                activeBracket: player_state.activeBracket,
                currentMode: "bout",
                nowPlayingSong: null,
                nowPlayingSongBracket: null,
                activeContender: 0,
                hasJammed: false,
                bothContendersSelected: false,
                isFlameActive: false,
                isWaveformActive: player_state.isWaveformActive !== undefined ? player_state.isWaveformActive : true,
                isVUActive: player_state.isVUActive !== undefined ? player_state.isVUActive : true,
                zoomFactor: player_state.zoomFactor !== undefined ? player_state.zoomFactor : 46.13
            });
            ui.setCurrentThemeIndex(player_state.theme || 0);
            brackets.updateBracketDropdown();
            const bracketSelect = document.getElementById("bracket-select");
            if (bracketSelect) {
                bracketSelect.value = player_state.activeBracket.replace(" - ", "-");
            }
            if (typeof updateVsMatchupBound === 'function') updateVsMatchupBound();
            if (typeof updateRoundInfoBound === 'function') updateRoundInfoBound();
            if (typeof updateWinnerButtonsBound === 'function') updateWinnerButtonsBound();
            if (typeof updateFlameButtonBound === 'function') updateFlameButtonBound();
            ui.updateWaveformVisibility(brackets.getPlayerState().isWaveformActive);
        } else if (player_state && isValidState && player_state.currentMode === "nowPlaying" && player_state.nowPlayingSong) {
            const nowPlayingSongBracket = brackets.getSongBracket(player_state.nowPlayingSong);
            brackets.updatePlayerState({
                contenders: player_state.contenders || [],
                peekBracket: player_state.peekBracket,
                activeBracket: player_state.activeBracket,
                currentMode: "nowPlaying",
                nowPlayingSong: player_state.nowPlayingSong,
                nowPlayingSongBracket: nowPlayingSongBracket,
                isWaveformActive: player_state.isWaveformActive !== undefined ? player_state.isWaveformActive : true,
                isVUActive: player_state.isVUActive !== undefined ? player_state.isVUActive : true,
                zoomFactor: player_state.zoomFactor !== undefined ? player_state.zoomFactor : 46.13
            });
            ui.setCurrentThemeIndex(player_state.theme || 0);
            loadSongBound(player_state.nowPlayingSong, -1, false);
            brackets.updateBracketDropdown();
            const bracketSelect = document.getElementById("bracket-select");
            if (bracketSelect) {
                bracketSelect.value = player_state.peekBracket.replace(" - ", "-");
            }
            if (typeof updateVsMatchupBound === 'function') updateVsMatchupBound();
            if (typeof updateRoundInfoBound === 'function') updateRoundInfoBound();
            if (typeof updateWinnerButtonsBound === 'function') updateWinnerButtonsBound();
            if (typeof updateFlameButtonBound === 'function') updateFlameButtonBound();
            ui.updateWaveformVisibility(brackets.getPlayerState().isWaveformActive);
        } else {
            window.logmsg("Initializing with default player state due to invalid or missing saved state", 0);
            brackets.updatePlayerState({
                contenders: [],
                peekBracket: "0 - 0",
                activeBracket: "0 - 0",
                currentMode: "bout",
                activeContender: 0,
                roundCount: 1,
                winner: null,
                hasPlayed: false,
                hasJammed: false,
                bothContendersSelected: false,
                isFlameActive: false,
                nowPlayingSong: null,
                nowPlayingSongBracket: null,
                isWaveformActive: true,
                isVUActive: true,
                zoomFactor: 46.13
            });
            ui.setCurrentThemeIndex(0);
            brackets.updateBracketDropdown();
            brackets.pickContenders(updateRoundInfoBound, updateVsMatchupBound, updateWinnerButtonsBound, updateFlameButtonBound);
            ui.updateWaveformVisibility(true);
            ui.updateVUMeterVisibility(true);
        }
    } catch (error) {
        window.logmsg(`Error loading data: ${error}`, 0);
        brackets.updatePlayerState({
            contenders: [],
            peekBracket: "0 - 0",
            activeBracket: "0 - 0",
            currentMode: "bout",
            activeContender: 0,
            roundCount: 1,
            winner: null,
            hasPlayed: false,
            hasJammed: false,
            bothContendersSelected: false,
            isFlameActive: false,
            nowPlayingSong: null,
            nowPlayingSongBracket: null,
            isWaveformActive: true,
            isVUActive: true,
            zoomFactor: 46.13
        });
        ui.setCurrentThemeIndex(0);
        brackets.updateBracketDropdown();
        brackets.pickContenders(updateRoundInfoBound, updateVsMatchupBound, updateWinnerButtonsBound, updateFlameButtonBound);
        ui.updateWaveformVisibility(true);
        ui.updateVUMeterVisibility(true);
    }

    const playPauseButton = document.getElementById("playPauseButton");
    if (playPauseButton) {
        playPauseButton.disabled = false;
    } else {
        window.logmsg('Play/Pause button not found in the DOM', 0);
    }

    for (let i = 1; i <= 3; i++) {
        const voiceButton = document.getElementById(`voice${i}`);
        if (voiceButton) {
            voiceButton.addEventListener('click', () => player.toggleVoice(i));
        } else {
            window.logmsg(`Voice button ${i} not found in the DOM`, 0);
        }
    }

    ui.applyTheme(brackets.getPlayerState().currentMode);
    const theme = baseColorSchemes[ui.getCurrentThemeIndex()];
    const playerState = brackets.getPlayerState();
    renderWinnerButtonBitmap(0, playerState);
    renderWinnerButtonBitmap(1, playerState);

    const winnerButtonLeft = document.getElementById('winner-left');
    const winnerButtonRight = document.getElementById('winner-right');
    if (winnerButtonLeft && winnerButtonRight) {
        winnerButtonLeft.disabled = true;
        winnerButtonRight.disabled = true;
    } else {
        window.logmsg('Winner buttons not found in the DOM', 0);
    }

    const button = document.getElementById("colorButton");
    if (button) {
        const currentTheme = baseColorSchemes[ui.getCurrentThemeIndex()];
        const nextIndex = (ui.getCurrentThemeIndex() + 1) % baseColorSchemes.length;
        const nextTheme = baseColorSchemes[nextIndex];
        button.style.backgroundColor = nextTheme.exterior;
        const icon = button.querySelector('.color-toggle__icon');
        if (icon) {
            icon.style.backgroundColor = nextTheme.interior;
        } else {
            window.logmsg('Color toggle icon not found in #colorButton', 0);
        }
        button.title = `Switch Theme \n  From: ${currentTheme.name}\n  To: ${nextTheme.name}`;
    } else {
        window.logmsg('Color toggle button not found in the DOM', 0);
    }

    checkSong2Clipping();
}
    
const authOverlay = document.getElementById('authOverlay');
if (authOverlay) {
    authOverlay.addEventListener('click', function(event) {
        if (event.target === this) {
            window.toggleAuthPopUp();
        }
    });
} else {
    window.logmsg('Auth overlay not found in the DOM', 0);
}

const preferencesOverlay = document.getElementById('preferencesOverlay');
if (preferencesOverlay) {
    preferencesOverlay.addEventListener('click', function(event) {
        if (event.target === this) {
            window.togglePreferencesPopUp();
        }
    });
} else {
    window.logmsg('Preferences overlay not found in the DOM', 0);
}

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
        debug(`Current playerState: ${JSON.stringify(brackets.getPlayerState())}`);
    });
} else {
    window.logmsg('Log player state button not found in the DOM', 0);
}