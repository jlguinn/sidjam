/* script.js (2) */
window.sidJamData = {
    sidFiles: [],
    cachedResults: {},
    pathToId: {}
};

import * as player from './player.js';
import * as ui from './ui.js';
import { baseColorSchemes } from './themes.js';
import * as brackets from './brackets.js';

function debug(message) { console.log(`[DEBUG] ${message}`); }

async function savePlayerState() {
    const state = brackets.getPlayerState();
    const player_state = {
        contenders: state.contenders,
        currentBracket: state.currentBracket,
        activeBracket: state.activeBracket,
        currentMode: state.currentMode,
        nowPlayingSong: state.nowPlayingSong,
        theme: ui.currentThemeIndex
    };

    try {
        const response = await fetch('dbcontrol/save_state.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_state })
        });
        const result = await response.json();
        if (!result.success) {
            console.error('Failed to save state:', result.message);
        } else {
            console.log('[DEBUG] Player state saved:', JSON.stringify(player_state));
        }
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

function checkSong2Clipping() {
    const song2 = document.getElementById('song2');
    const authLink = document.getElementById('auth-link');
    const preferencesLink = document.getElementById('preferences-link');

    if (!song2) {
        console.error('song2 element not found');
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

    const clippingThreshold = 190;
    if (intrinsicWidth > clippingThreshold) {
        if (authLink) authLink.style.display = 'none';
        if (preferencesLink) preferencesLink.style.display = 'none';
    } else {
        if (authLink) authLink.style.display = 'block';
        if (preferencesLink) preferencesLink.style.display = 'block';
    }
}

const profileBitmap = [
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,1,1,0,0,0,0,0,0,0,1,1,0,0],
    [0,1,0,0,0,0,1,1,1,0,0,0,0,1,0],
    [1,0,0,0,1,1,1,1,1,1,1,0,0,0,1],
    [1,0,0,0,1,1,1,1,1,1,1,0,0,0,1],
    [0,1,0,1,0,0,0,0,0,0,0,1,0,1,0],
    [1,1,0,1,0,0,0,1,0,0,0,1,0,1,1],
    [1,1,0,1,0,0,1,1,1,0,0,1,0,1,1],
    [1,1,0,1,1,1,1,1,1,1,1,1,0,1,1],
    [0,1,0,0,1,1,1,1,1,1,1,0,0,1,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

window.renderProfileBitmap = function(textColor) {
    const bitmapContainer = document.getElementById('profile-bitmap');
    if (!bitmapContainer) {
        console.error('Profile bitmap container not found.');
        return;
    }
    bitmapContainer.innerHTML = '';

    for (let row = 0; row < 18; row++) {
        for (let col = 0; col < 15; col++) {
            const pixel = document.createElement('div');
            pixel.style.width = '4px';
            pixel.style.height = '4px';
            pixel.style.backgroundColor = profileBitmap[row][col] === 1 ? textColor : 'transparent';
            bitmapContainer.appendChild(pixel);
        }
    }
};

const updateTimerBound = () => player.updateTimer();

const loadSongBound = (filename, trackNumber, autoPlay = true) => player.loadSong(
    filename, trackNumber,
    () => ui.updateSongInfo(player.sidPlayer),
    () => ui.updatePlayPauseButton(player.isPlaying),
    player.resetVoiceStates,
    () => ui.updateNavigationButtons(player.sidPlayer),
    updateVsMatchupBound,
    autoPlay
);

const updateVsMatchupBound = () => {
    const state = brackets.getPlayerState();
    ui.updateVsMatchup(
        state.currentMode, state.nowPlayingSong, state.contenders, state.activeContender, state.hasPlayed, state.isFlameActive
    );
    checkSong2Clipping();
};

const updateRoundInfoBound = () => ui.updateRoundInfo(
    brackets.getPlayerState().currentMode, brackets.getPlayerState().hasPlayed, brackets.getPlayerState().bothContendersSelected,
    brackets.getPlayerState().winner, brackets.getPlayerState().contenders, brackets.getPlayerState().roundCount
);

const updateWinnerButtonsBound = () => ui.updateWinnerButtons(
    brackets.getPlayerState().hasPlayed, brackets.getPlayerState().roundCount, brackets.getPlayerState().hasJammed,
    brackets.getPlayerState().isFlameActive, player.sidPlayer
);

const updateFlameButtonBound = () => ui.updateFlameButton(
    brackets.getPlayerState().currentMode, brackets.getPlayerState().currentBracket, brackets.getPlayerState().nowPlayingSong,
    brackets.getPlayerState().winner, brackets.getPlayerState().bothContendersSelected, brackets.getPlayerState().isFlameActive,
    brackets.getPlayerState().hasPlayed, brackets.getPlayerState().contenders, player.sidPlayer
);

window.togglePlayPause = () => {
    player.togglePlayPause(
        updateRoundInfoBound,
        () => ui.updatePlayPauseButton(player.isPlaying),
        updateWinnerButtonsBound,
        updateFlameButtonBound,
        () => player.initPlayer(
            brackets.getPlayerState().hasPlayed, brackets.getPlayerState().activeContender, brackets.getPlayerState().contenders,
            loadSongBound, updateWinnerButtonsBound, updateFlameButtonBound
        ),
        () => brackets.updatePlayerState({ hasPlayed: true })
    );
    document.getElementById("ellipsis-button").disabled = false;
};

window.jamToggle = () => {
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

window.setWinner = (index) => brackets.updateWinner(
    index,
    updateRoundInfoBound,
    updateWinnerButtonsBound,
    updateFlameButtonBound
);

window.toggleFlame = () => brackets.toggleFlame(
    updateFlameButtonBound,
    updateVsMatchupBound,
    updateWinnerButtonsBound
);

window.toggleRevive = () => brackets.toggleRevive(
    ui.updateReviveButton,
    () => ui.updateSongTitleHighlight(brackets.getPlayerState().currentMode, brackets.getPlayerState().isReviveActive)
);

window.nextTrack = () => player.nextTrack(
    brackets.getPlayerState().currentMode, brackets.getPlayerState().nowPlayingSong, brackets.getPlayerState().contenders,
    brackets.getPlayerState().activeContender, loadSongBound
);

window.prevTrack = () => player.prevTrack(
    brackets.getPlayerState().currentMode, brackets.getPlayerState().nowPlayingSong, brackets.getPlayerState().contenders,
    brackets.getPlayerState().activeContender, loadSongBound
);

window.changeBracket = () => {
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
    ui.toggleColorScheme(brackets.getPlayerState().currentMode);
    savePlayerState();
};

window.toggleSongList = toggleSongList;

function toggleSongList() {
    const overlay = document.getElementById("songListOverlay");
    const filterInput = document.getElementById("filterInput");
    const songListWrapper = document.getElementById("songListWrapper");

    if (overlay.style.display === "block") {
        const state = brackets.getPlayerState();
        if (state.peekPlayingSong) {
            if (player.sidPlayer) {
                player.sidPlayer.pause();
                player.setIsPlaying(false);
                player.stopTimer();
                console.log("[DEBUG] Stopped peeked song");
            }
            brackets.updatePlayerState({
                contenders: state.contenders,
                activeContender: 0,
                currentMode: "bout",
                peekPlayingSong: null
            });
            loadSongBound(state.contenders[0], -1, false);
        }
        overlay.style.display = "none";
        currentOffset = 0;
        currentFilter = "";
        hasMoreSongs = true;
        document.getElementById("songList").innerHTML = '';
        songListWrapper.dataset.observerSet = "";
        document.removeEventListener('keydown', handleEscapeKey);
        filterInput.removeEventListener('input', handleFilterInput);
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
        document.getElementById("songList").innerHTML = '';
        songListWrapper.dataset.observerSet = "";
        songListWrapper.scrollTop = 0; // Always reset scroll
        populateSongList("");
        document.addEventListener('keydown', handleEscapeKey);
        filterInput.addEventListener('input', handleFilterInput);
    }
}

function handleFilterInput() {
    const filterText = document.getElementById("filterInput").value;
    populateSongList(filterText);
}

function handleEscapeKey(event) {
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
    if (state.currentBracket !== "All" && state.currentBracket !== "Eliminated") {
        let [wins, losses] = state.currentBracket.split(' - ').map(Number);
        queryParams += `&wins=${wins}&losses=${losses}`;
    } else if (state.currentBracket === "Eliminated") {
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
                    li.onclick = () => playSongOnDemand(file);
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
            console.error('Error fetching songs:', error);
            isLoading = false;
        });
}

function updatePlayingIndicator() {
    const songList = document.getElementById("songList");
    songList.querySelectorAll("li").forEach(li => {
        const state = brackets.getPlayerState();
        if (li.textContent === state.peekPlayingSong?.replace('/sid/C64Music', '')) {
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
    brackets.updatePlayerState({ peekPlayingSong: filename });
    if (player.sidPlayer && player.isPlaying) {
        player.sidPlayer.pause();
        player.setIsPlaying(false);
        player.stopTimer();
    }
    loadSongBound(filename, -1, true);
    populateSongList(document.getElementById("filterInput").value);
    updatePlayingIndicator();
}

function enterNowPlayingMode(song) {
    const state = brackets.getPlayerState();
    brackets.updatePlayerState({
        currentMode: "nowPlaying",
        nowPlayingSong: song,
        peekPlayingSong: null
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
            document.getElementById('signInError').textContent = '';
            document.getElementById('registerError').textContent = '';
            document.getElementById('forgotPasswordMessage').textContent = '';
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
            formElement.classList.add('active');
            formElement.style.display = 'block';
        } else {
            if (tabElement) tabElement.classList.remove('active');
            formElement.classList.remove('active');
            formElement.style.display = 'none';
        }
    });

    document.getElementById('signInError').textContent = '';
    document.getElementById('registerError').textContent = '';
    document.getElementById('forgotPasswordMessage').textContent = '';

    document.getElementById('signInEmail').value = '';
    document.getElementById('signInPassword').value = '';
    document.getElementById('registerUsername').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerConfirmPassword').value = '';
    document.getElementById('forgotPasswordEmail').value = '';
};

window.handleSignIn = async function(event) {
    event.preventDefault();
    const email = document.getElementById('signInEmail').value;
    const password = document.getElementById('signInPassword').value;
    const errorElement = document.getElementById('signInError');

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
        console.error('Error in handleSignIn:', error);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

window.handleRegister = async function(event) {
    event.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const errorElement = document.getElementById('registerError');

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
        console.error('Error in handleRegister:', error);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

window.handleForgotPassword = async function(event) {
    event.preventDefault();
    const email = document.getElementById('forgotPasswordEmail').value;
    const messageElement = document.getElementById('forgotPasswordMessage');

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
        console.error('Error in handleForgotPassword:', error);
        messageElement.style.color = 'red';
        messageElement.textContent = 'An error occurred. Please try again.';
    }
};

window.togglePreferencesPopUp = function() {
    const overlay = document.getElementById('preferencesOverlay');
    if (overlay.style.display === 'block') {
        if (document.getElementById('updatePasswordSuccess').style.display === 'block' ||
            document.getElementById('updateUsernameSuccess').style.display === 'block' ||
            document.getElementById('updateEmailSuccess').style.display === 'block') {
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
            tabElement.classList.add('active');
            formElement.classList.add('active');
            formElement.style.display = 'block';
        } else {
            tabElement.classList.remove('active');
            formElement.classList.remove('active');
            formElement.style.display = 'none';
        }
    });

    document.getElementById('updatePasswordError').textContent = '';
    document.getElementById('updateUsernameError').textContent = '';
    document.getElementById('updateEmailError').textContent = '';
    document.getElementById('deleteAccountError').textContent = '';

    document.getElementById('updatePasswordSection').style.display = 'block';
    document.getElementById('updatePasswordSuccess').style.display = 'none';
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';

    document.getElementById('updateUsernameSection').style.display = 'block';
    document.getElementById('updateUsernameSuccess').style.display = 'none';
    document.getElementById('updateUsernameConfirmation').style.display = 'none';
    document.getElementById('newUsername').value = '';

    document.getElementById('updateEmailSection').style.display = 'block';
    document.getElementById('updateEmailSuccess').style.display = 'none';
    document.getElementById('newEmail').value = '';
    window.hideUpdateEmailConfirmation();

    window.hideDeleteAccountConfirmation();
};

window.handleUpdatePassword = async function(event) {
    event.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    const errorElement = document.getElementById('updatePasswordError');

    if (newPassword !== confirmNewPassword) {
        errorElement.textContent = 'New passwords do not match';
        return;
    }

    try {
        const response = await fetch('dbcontrol/update_password.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ currentPassword, newPassword })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('updatePasswordSection').style.display = 'none';
            document.getElementById('updatePasswordSuccess').style.display = 'block';
        } else {
            errorElement.textContent = data.message;
        }
    } catch (error) {
        console.error('Error in handleUpdatePassword:', error);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

window.handleUpdateUsername = async function(event) {
    event.preventDefault();
    const newUsername = document.getElementById('newUsername').value;
    const errorElement = document.getElementById('updateUsernameError');

    if (newUsername.length < 3) {
        errorElement.textContent = 'Username must be at least 3 characters long';
        return;
    }

    window.newUsernameToUpdate = newUsername;
    window.showUpdateUsernameConfirmation();
};

window.showUpdateUsernameConfirmation = function() {
    document.getElementById('updateUsernameSection').style.display = 'none';
    document.getElementById('updateUsernameConfirmation').style.display = 'block';
    document.getElementById('confirmNewUsername').textContent = window.newUsernameToUpdate;
    document.getElementById('confirmUsernameError').textContent = '';
};

window.hideUpdateUsernameConfirmation = function() {
    document.getElementById('updateUsernameConfirmation').style.display = 'none';
    document.getElementById('updateUsernameSection').style.display = 'block';
    document.getElementById('updateUsernameError').textContent = '';
};

window.confirmUpdateUsername = async function() {
    const newUsername = window.newUsernameToUpdate;
    const errorElement = document.getElementById('confirmUsernameError');

    try {
        const response = await fetch('dbcontrol/update_username.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ newUsername })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('updateUsernameConfirmation').style.display = 'none';
            document.getElementById('updateUsernameSuccess').style.display = 'block';
        } else {
            errorElement.textContent = data.message;
        }
    } catch (error) {
        console.error('Error in confirmUpdateUsername:', error);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

window.handleUpdateEmail = async function(event) {
    event.preventDefault();
    const newEmail = document.getElementById('newEmail').value;
    const errorElement = document.getElementById('updateEmailError');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        errorElement.textContent = 'Please enter a valid email address';
        return;
    }

    window.newEmailToUpdate = newEmail;
    window.showUpdateEmailConfirmation();
};

window.showUpdateEmailConfirmation = function() {
    document.getElementById('updateEmailSection').style.display = 'none';
    document.getElementById('updateEmailConfirmation').style.display = 'block';
    document.getElementById('confirmNewEmail').textContent = window.newEmailToUpdate;
    document.getElementById('confirmPassword').value = '';
    document.getElementById('confirmEmailError').textContent = '';
};

window.hideUpdateEmailConfirmation = function() {
    document.getElementById('updateEmailConfirmation').style.display = 'none';
    document.getElementById('updateEmailSection').style.display = 'block';
    document.getElementById('updateEmailError').textContent = '';
};

window.confirmUpdateEmail = async function(event) {
    event.preventDefault();
    const confirmPassword = document.getElementById('confirmPassword').value;
    const newEmail = window.newEmailToUpdate;
    const errorElement = document.getElementById('confirmEmailError');

    try {
        const response = await fetch('dbcontrol/update_email.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ newEmail, confirmPassword })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('currentEmail').textContent = newEmail;
            document.getElementById('updateEmailConfirmation').style.display = 'none';
            document.getElementById('updateEmailSuccess').style.display = 'block';
        } else {
            errorElement.textContent = data.message;
        }
    } catch (error) {
        console.error('Error in confirmUpdateEmail:', error);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

window.stopPlayer = function() {
    if (window.sidPlayer) {
        window.sidPlayer.stop();
        window.sidPlayer = null;
    }
    const playButton = document.getElementById('playButton');
    if (playButton) {
        playButton.src = '/image/play.png';
        playButton.alt = 'Play';
    }
};

window.resetPlayer = function() {
    window.allTunes = [];
    window.currentBracket = 0;
    window.currentSongIndex = 0;
    window.sidPlayer = null;

    const songInfo = document.getElementById('songInfo');
    const flameButton = document.getElementById('flameButton');
    if (songInfo) {
        songInfo.textContent = 'Press Play';
    }
    if (flameButton) {
        flameButton.src = '/image/Flame-01-june.jpg';
        flameButton.alt = 'Flame Inactive';
    }

    brackets.updatePlayerState({ hasPlayed: false, isFlameActive: false });
};

window.updateUIForLogout = function() {
    const preferencesLink = document.getElementById('preferencesLink');
    const profileIcon = document.getElementById('profileIcon');

    if (preferencesLink) preferencesLink.style.display = 'none';
    if (profileIcon) profileIcon.style.display = 'none';

    const authLink = document.getElementById('authLink');
    if (authLink) {
        authLink.style.display = 'inline';
        authLink.textContent = 'Sign In';
    }

    const userGreeting = document.getElementById('userGreeting');
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
        console.error('Error in handleLogout:', error);
        alert('An error occurred. Please try again.');
    }
};

window.showDeleteAccountConfirmation = function() {
    document.getElementById('deleteAccountSection').style.display = 'none';
    document.getElementById('deleteAccountConfirmation').style.display = 'block';
};

window.hideDeleteAccountConfirmation = function() {
    document.getElementById('deleteAccountSection').style.display = 'block';
    document.getElementById('deleteAccountConfirmation').style.display = 'none';
    document.getElementById('deleteAccountError').textContent = '';
};

window.handleDeleteAccount = async function(event) {
    event.preventDefault();
    const password = document.getElementById('deletePassword').value;
    const errorElement = document.getElementById('deleteAccountError');

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
        console.error('Error(datetime.now().strftime("%Y-%m-%d %H:%M:%S")) in handleDeleteAccount:', error);
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
        console.error('Profile bitmap container not found for flashing.');
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
        currentColor = baseColorSchemes[ui.currentThemeIndex].exteriorTextColor || '#000000';
        window.renderProfileBitmap(currentColor);
    }

    const complementaryColor = getComplementaryColor(currentColor);
    let flashCount = 0;
    const maxFlashes = 14;
    const flashDuration = 500;

    function flash() {
        if (flashCount >= maxFlashes) {
            window.renderProfileBitmap(currentColor);
            return;
        }

        const colorToUse = flashCount % 2 === 0 ? complementaryColor : currentColor;
        window.renderProfileBitmap(colorToUse);
        flashCount++;
        setTimeout(flash, flashDuration);
    }
    flash();
};

async function loadPlayerState() {
    try {
        const response = await fetch(`dbcontrol/get_player_state.php?user_id=${window.user.id}`);
        if (!response.ok) throw new Error(`Failed to load player_state: ${response.statusText}`);
        const data = await response.json();
        if (data.success && data.player_state) {
            console.log("Resuming player state:", JSON.stringify(data.player_state));
            return data.player_state;
        }
        console.error("No valid player_state found");
        return null;
    } catch (error) {
        console.error("Error loading player_state:", error);
        return null;
    }
}

async function initializeApp() {
    const authLink = document.getElementById('auth-link');
    const preferencesLink = document.getElementById('preferences-link');
    const profileIcon = document.getElementById('profile-icon');
    const userInfo = document.getElementById('user-info');

    window.hasShownPrompt = false;
    window.showPromptMessage = false;

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
            debug(`user-info clicked, target: ${e.target.id}`);
        });
    }

    if (!window.user || !window.user.id) {
        console.error('window.user.id not defined on DOM load');
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
        if (player_state && player_state.contenders && player_state.currentMode === "bout" && player_state.contenders[0] && player_state.contenders[1]) {
            brackets.updatePlayerState({
                contenders: player_state.contenders,
                currentBracket: player_state.activeBracket, // Force Bout Mode to use activeBracket
                activeBracket: player_state.activeBracket,
                currentMode: "bout",
                nowPlayingSong: null,
                activeContender: 0,
                hasJammed: false,
                bothContendersSelected: false,
                isFlameActive: false
            });
            ui.currentThemeIndex = player_state.theme || 0;
            brackets.updateBracketDropdown();
            document.getElementById("bracket-select").value = player_state.activeBracket.replace(" - ", "-");
            updateVsMatchupBound();
            updateRoundInfoBound();
            updateWinnerButtonsBound();
            updateFlameButtonBound();
        } else if (player_state && player_state.currentMode === "nowPlaying" && player_state.nowPlayingSong) {
            brackets.updatePlayerState({
                contenders: player_state.contenders || [],
                currentBracket: player_state.currentBracket,
                activeBracket: player_state.activeBracket,
                currentMode: "nowPlaying",
                nowPlayingSong: player_state.nowPlayingSong
            });
            ui.currentThemeIndex = player_state.theme || 0;
            loadSongBound(player_state.nowPlayingSong, -1, false);
            brackets.updateBracketDropdown();
            document.getElementById("bracket-select").value = player_state.currentBracket.replace(" - ", "-");
            updateVsMatchupBound();
            updateRoundInfoBound();
            updateWinnerButtonsBound();
            updateFlameButtonBound();
        } else {
            brackets.updatePlayerState({
                currentBracket: "0 - 0",
                activeBracket: "0 - 0",
                currentMode: "bout"
            });
            ui.currentThemeIndex = 0;
            brackets.updateBracketDropdown();
            brackets.pickContenders(updateRoundInfoBound, updateVsMatchupBound, updateWinnerButtonsBound, updateFlameButtonBound);
        }
    } catch (error) {
        console.error('Error loading data:', error);
        window.sidJamData.cachedResults = {};
        window.sidJamData.sidFiles = [];
        window.sidJamData.pathToId = {};
        brackets.updatePlayerState({
            currentBracket: "0 - 0",
            activeBracket: "0 - 0",
            currentMode: "bout"
        });
        brackets.updateBracketDropdown();
        brackets.pickContenders(updateRoundInfoBound, updateVsMatchupBound, updateWinnerButtonsBound, updateFlameButtonBound);
    }

    document.getElementById("playPauseButton").disabled = false;
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`voice${i}`).addEventListener('change', () => player.toggleVoice(i));
    }

    ui.applyTheme(brackets.getPlayerState().currentMode);

    const button = document.getElementById("colorButton");
    const currentTheme = baseColorSchemes[ui.currentThemeIndex];
    const nextIndex = (ui.currentThemeIndex + 1) % baseColorSchemes.length;
    const nextTheme = baseColorSchemes[nextIndex];
    button.style.backgroundColor = nextTheme.exterior;
    button.querySelector('.inner-box').style.backgroundColor = nextTheme.interior;
    button.title = `Switch Theme \n  From: ${currentTheme.name}\n  To: ${nextTheme.name}`;

    const initialColor = baseColorSchemes[ui.currentThemeIndex].exteriorTextColor || '#000000';
    window.renderProfileBitmap(initialColor);

    checkSong2Clipping();
}

document.getElementById('authOverlay').addEventListener('click', function(event) {
    if (event.target === this) {
        window.toggleAuthPopUp();
    }
});

document.getElementById('preferencesOverlay').addEventListener('click', function(event) {
    if (event.target === this) {
        window.togglePreferencesPopUp();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeApp();
    });
} else {
    initializeApp();
}