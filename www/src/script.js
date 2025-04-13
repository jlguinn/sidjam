window.sidJamData = {
    sidFiles: [],
    cachedResults: {},
    pathToId: {}
};

import * as player from './player.js';  // Still in /src/, relative to script.js
import * as ui from './ui.js';
import { baseColorSchemes } from './themes.js'; // Replace old imports
import * as brackets from './brackets.js';

let lastBracketViewed = null;
let originalSongState = null;
let peekPlayingSong = null;

function debug(message) { console.log(`[DEBUG] ${message}`); }

async function savePlayerState() {
    let player_state;

    if (brackets.currentMode === "nowPlaying") {
        // Load existing state to preserve bracket and contenders
        const existingState = await loadPlayerState();
        player_state = existingState || {
            bracket: "0 - 0",
            contenders: { contender1: null, contender2: null, nowPlaying: null },
            theme: ui.currentThemeIndex,
            mode: "bout"
        };
        // Update only mode and nowPlaying
        player_state.mode = "nowPlaying";
        player_state.contenders.nowPlaying = brackets.nowPlayingSong;
    } else {
        // For Bout mode, construct state as before, respecting special brackets
        const specialBrackets = ["All", "Eliminated"];
        const contenderCount = brackets.getContenderCount(brackets.currentBracket);
        const isSpecialBracket = specialBrackets.includes(brackets.currentBracket) || contenderCount < 2;
        const savedBracket = isSpecialBracket ? brackets.previousBracket : brackets.currentBracket;

        player_state = {
            bracket: savedBracket,
            contenders: {
                contender1: brackets.contenders[0] || null,
                contender2: brackets.contenders[1] || null,
                nowPlaying: null
            },
            theme: ui.currentThemeIndex,
            mode: brackets.currentMode
        };
    }

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

// Function to check if #song2 clips the profile package and hide the link if needed
function checkSong2Clipping() {
    const song2 = document.getElementById('song2');
    const authLink = document.getElementById('auth-link');
    const preferencesLink = document.getElementById('preferences-link');

    if (!song2) {
        console.error('song2 element not found');
        return;
    }

    // Create a temporary off-screen element to measure the intrinsic width of the text
    const tempElement = document.createElement('span');
    tempElement.style.visibility = 'hidden'; // Hide the element
    tempElement.style.position = 'absolute'; // Remove from layout
    tempElement.style.whiteSpace = 'nowrap'; // Prevent wrapping
    tempElement.style.font = window.getComputedStyle(song2).font; // Match font styles
    tempElement.textContent = song2.textContent; // Set the text content
    document.body.appendChild(tempElement); // Add to DOM to measure

    const intrinsicWidth = tempElement.offsetWidth; // Measure the intrinsic width

    // Remove the temporary element
    document.body.removeChild(tempElement);

    const clippingThreshold = 190; // Distance from body center (400px) to left edge of profile package (640px)
    if (intrinsicWidth > clippingThreshold) {
        if (authLink) authLink.style.display = 'none';
        if (preferencesLink) preferencesLink.style.display = 'none';
    } else {
        if (authLink) authLink.style.display = 'block';
        if (preferencesLink) preferencesLink.style.display = 'block';
    }
}

// Bitmap representation of the profile icon (15x18)
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

// Function to render the profile bitmap
window.renderProfileBitmap = function(textColor) {
    const bitmapContainer = document.getElementById('profile-bitmap');
    if (!bitmapContainer) {
        console.error('Profile bitmap container not found. Ensure #profile-bitmap exists in the DOM.');
        return;
    }
    bitmapContainer.innerHTML = ''; // Clear existing content

    // Log the color being used for debugging
    // debug(`Rendering profile bitmap with color: ${textColor}`);

    for (let row = 0; row < 18; row++) {
        for (let col = 0; col < 15; col++) {
            const pixel = document.createElement('div');
            pixel.style.width = '4px';
            pixel.style.height = '4px';
            if (profileBitmap[row][col] === 1) {
                pixel.style.backgroundColor = textColor;
            } else {
                pixel.style.backgroundColor = 'transparent';
            }
            bitmapContainer.appendChild(pixel);
        }
    }

    // debug(`Rendered ${bitmapContainer.children.length} pixels in profile bitmap`);
};

const updateTimerBound = () => player.updateTimer();

// Bound functions to avoid passing arguments repeatedly (defined first)
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
    ui.updateVsMatchup(
        brackets.currentMode, brackets.nowPlayingSong, brackets.contenders, brackets.activeContender, brackets.hasPlayed, brackets.isFlameActive
    );
    checkSong2Clipping(); // Check for clipping after updating song names
};

const updateRoundInfoBound = () => ui.updateRoundInfo(
    brackets.currentMode, brackets.hasPlayed, brackets.bothContendersSelected, brackets.winner, brackets.contenders, brackets.roundCount
);

const updateWinnerButtonsBound = () => ui.updateWinnerButtons(
    brackets.hasPlayed, brackets.roundCount, brackets.hasJammed, brackets.isFlameActive, player.sidPlayer
);

const updateFlameButtonBound = () => ui.updateFlameButton(
    brackets.currentMode, brackets.currentBracket, brackets.nowPlayingSong, brackets.winner, brackets.bothContendersSelected, brackets.isFlameActive, brackets.hasPlayed, brackets.contenders, player.sidPlayer
);

// Bind global functions for HTML onclick
window.togglePlayPause = () => {
    player.togglePlayPause(
        updateRoundInfoBound,
        () => ui.updatePlayPauseButton(player.isPlaying),
        updateWinnerButtonsBound,
        updateFlameButtonBound,
        () => player.initPlayer(brackets.hasPlayed, brackets.activeContender, brackets.contenders, loadSongBound, updateWinnerButtonsBound, updateFlameButtonBound),
        brackets.setHasPlayed
    );
    document.getElementById("ellipsis-button").disabled = false;
};

window.jamToggle = () => {
    brackets.jamToggle(
        player.sidPlayer,
        loadSongBound,
        () => ui.applyTheme(brackets.currentMode),
        updateVsMatchupBound,
        updateRoundInfoBound,
        updateWinnerButtonsBound,
        updateFlameButtonBound,
        brackets.updateBracketDropdown
    ).then(() => savePlayerState()); // Save after mode change
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
    () => ui.updateSongTitleHighlight(brackets.currentMode, brackets.isReviveActive)
);

window.nextTrack = () => player.nextTrack(
    brackets.currentMode,
    brackets.nowPlayingSong,
    brackets.contenders,
    brackets.activeContender,
    loadSongBound
);

window.prevTrack = () => player.prevTrack(
    brackets.currentMode,
    brackets.nowPlayingSong,
    brackets.contenders,
    brackets.activeContender,
    loadSongBound
);

window.changeBracket = () => {
    brackets.changeBracket(
        updateFlameButtonBound,
        loadSongBound,
        updateRoundInfoBound,
        updateVsMatchupBound,
        updateWinnerButtonsBound
    );
    if (brackets.currentMode == "bout") savePlayerState(); // Save after bracket change
};

window.toggleColorScheme = () => {
    ui.toggleColorScheme(brackets.currentMode);
    savePlayerState(); // Save after theme change
};

window.toggleSongList = toggleSongList;

function toggleSongList() {
    const overlay = document.getElementById("songListOverlay");
    const filterInput = document.getElementById("filterInput");
    const songListWrapper = document.getElementById("songListWrapper");

    if (overlay.style.display === "block") {
        if (peekPlayingSong) {
            if (player.sidPlayer) {
                player.sidPlayer.pause();
                player.setIsPlaying(false);
                player.stopTimer();
                console.log("[DEBUG] Stopped peeked song");
            }
            if (originalSongState) {
                brackets.setContenders(originalSongState.contenders);
                brackets.setActiveContender(originalSongState.activeContender);
                brackets.setCurrentMode("bout");
                console.log(`[DEBUG] Restoring Bout song, wasPlaying: ${originalSongState.isPlaying}`);
                loadSongBound(originalSongState.contenders[originalSongState.activeContender], -1, originalSongState.isPlaying);
                // Remove setTimeout, rely on loadSong to handle playback
                originalSongState = null;
            }
            peekPlayingSong = null;
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
        // Opening logic unchanged
        overlay.style.display = "block";
        filterInput.value = "";
        currentOffset = 0;
        currentFilter = "";
        hasMoreSongs = true;
        document.getElementById("songList").innerHTML = '';
        songListWrapper.dataset.observerSet = "";
        if (lastBracketViewed !== brackets.currentBracket) {
            document.getElementById("songListWrapper").scrollTop = 0;
            lastBracketViewed = brackets.currentBracket;
        }
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

// Store the IntersectionObserver instance in a module-level variable
let currentObserver = null;

function populateSongList(filter) {
    const songList = document.getElementById("songList");
    const songListWrapper = document.getElementById("songListWrapper");

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
    if (brackets.currentBracket !== "All" && brackets.currentBracket !== "Eliminated") {
        let [wins, losses] = brackets.currentBracket.split(' - ').map(Number);
        queryParams += `&wins=${wins}&losses=${losses}`;
    } else if (brackets.currentBracket === "Eliminated") {
        queryParams += "&wins=-1&losses=2";
    }

    // console.log(`Fetching songs for bracket ${brackets.currentBracket}, offset=${currentOffset}, filter=${filter}`);

    fetch(`dbcontrol/get_sidtunes.php?${queryParams}`)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch songs: ${response.status}`);
            return response.json();
        })
        .then(data => {
            const { files, offset, limit, hasMore } = data;
            hasMoreSongs = hasMore;

            // console.log(`Fetched ${files.length} songs for bracket ${brackets.currentBracket}, hasMore=${hasMore}`);

            if (files.length === 0 && currentOffset === 0) {
                const li = document.createElement("li");
                li.textContent = "No contenders found";
                li.className = "no-results";
                songList.appendChild(li);
            } else {
                files.forEach(file => {
                    const li = document.createElement("li");
                    li.textContent = file.replace('/sid/C64Music', '');
                    if (peekPlayingSong === file) {
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
        if (li.textContent === peekPlayingSong?.replace('/sid/C64Music', '')) {
            li.classList.add("playing");
        } else {
            li.classList.remove("playing");
        }
    });
}

// Update playSongOnDemand in script.js
function playSongOnDemand(filename) {
    if (peekPlayingSong === filename) {
        enterNowPlayingMode(filename);
        return;
    }
    peekPlayingSong = filename;
    if (player.sidPlayer) {
        let currentTime = Math.floor(window.backend.getCurrentPlaytime() || 0);
        originalSongState = {
            contenders: [...brackets.contenders],
            activeContender: brackets.activeContender,
            isPlaying: player.isPlaying,
            pausedTime: currentTime
        };
        if (player.isPlaying) {
            player.sidPlayer.pause();
            player.setIsPlaying(false);
            player.stopTimer();
        }
    }
    loadSongBound(filename, -1, true);
    populateSongList(document.getElementById("filterInput").value);
    updatePlayingIndicator(); // Add this call
}

function enterNowPlayingMode(song) {
    brackets.setBoutState({
        contenders: [...brackets.contenders],
        activeContender: brackets.activeContender,
        roundCount: brackets.roundCount,
        winner: brackets.winner,
        hasJammed: brackets.hasJammed,
        bothContendersSelected: brackets.bothContendersSelected,
        isFlameActive: brackets.isFlameActive,
        bracket: brackets.currentBracket
    });
    brackets.setCurrentMode("nowPlaying");
    brackets.setNowPlayingSong(song);
    peekPlayingSong = null;
    if (player.sidPlayer && player.isPlaying) {
        player.sidPlayer.pause();
        player.setIsPlaying(false);
        player.stopTimer();
    }
    loadSongBound(brackets.nowPlayingSong, -1, true);
    ui.applyTheme("nowPlaying");
    toggleSongList();
    updateVsMatchupBound();
    updateRoundInfoBound();
    updateWinnerButtonsBound();
    updateFlameButtonBound();
    savePlayerState();
}

// Show/hide the auth pop-up
window.toggleAuthPopUp = (function() {
    let isToggling = false;
    return function() {
        if (isToggling) {
            // debug('toggleAuthPopUp: Debounced call, ignoring');
            return;
        }
        isToggling = true;
        setTimeout(() => { isToggling = false; }, 300); // 300ms debounce

        const overlay = document.getElementById('authOverlay');
        // debug(`Toggling auth pop-up, current display: ${overlay.style.display}`);
        if (overlay.style.display === 'block') {
            overlay.style.display = 'none';
            document.removeEventListener('keydown', handleAuthEscapeKey); // Remove listener when closing
            // Clear all form inputs when closing
            document.getElementById('signInEmail').value = '';
            document.getElementById('signInPassword').value = '';
            document.getElementById('registerUsername').value = '';
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('registerConfirmPassword').value = '';
            document.getElementById('forgotPasswordEmail').value = '';
            // Clear any previous messages
            document.getElementById('signInError').textContent = '';
            document.getElementById('registerError').textContent = '';
            document.getElementById('forgotPasswordMessage').textContent = '';
        } else {
            overlay.style.display = 'block';
            window.showAuthTab('signIn');
            document.addEventListener('keydown', handleAuthEscapeKey); // Add listener when opening
        }
        // debug(`New display state: ${overlay.style.display}`);
    };
})();

// Escape key handler for auth pop-up
function handleAuthEscapeKey(event) {
    if (event.key === "Escape") {
        window.toggleAuthPopUp();
    }
}

window.showAuthTab = function(tab) {
    // debug(`Showing auth tab: ${tab}`);
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

    // Clear any previous messages
    document.getElementById('signInError').textContent = '';
    document.getElementById('registerError').textContent = '';
    document.getElementById('forgotPasswordMessage').textContent = '';

    // Clear form inputs
    document.getElementById('signInEmail').value = '';
    document.getElementById('signInPassword').value = '';
    document.getElementById('registerUsername').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerConfirmPassword').value = '';
    document.getElementById('forgotPasswordEmail').value = '';
};

// Handle sign-in form submission
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

// Handle register form submission
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

// Handle forgot password form submission
window.handleForgotPassword = async function(event) {
    event.preventDefault();
    const email = document.getElementById('forgotPasswordEmail').value;
    const messageElement = document.getElementById('forgotPasswordMessage');

    // Client-side email validation (already handled by HTML5 type="email" and required)
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

// Show/hide the preferences pop-up
window.togglePreferencesPopUp = function() {
    const overlay = document.getElementById('preferencesOverlay');
    // debug(`Toggling preferences pop-up, current display: ${overlay.style.display}`);
    if (overlay.style.display === 'block') {
        if (document.getElementById('updatePasswordSuccess').style.display === 'block' ||
            document.getElementById('updateUsernameSuccess').style.display === 'block' ||
            document.getElementById('updateEmailSuccess').style.display === 'block') {
            window.location.reload();
        }
        overlay.style.display = 'none';
        document.removeEventListener('keydown', handlePreferencesEscapeKey); // Remove listener when closing
    } else {
        overlay.style.display = 'block';
        window.showPreferencesTab('password');
        document.addEventListener('keydown', handlePreferencesEscapeKey); // Add listener when opening
    }
    // debug(`New display state: ${overlay.style.display}`);
};

// Escape key handler for preferences pop-up
function handlePreferencesEscapeKey(event) {
    if (event.key === "Escape") {
        window.togglePreferencesPopUp();
    }
}

// Close the preferences pop-up and reload the page
window.closePreferencesAndReload = function() {
    window.togglePreferencesPopUp();
    window.location.reload();
};

// Show the specified preferences tab (password, username, email, advanced)
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

    // Clear any previous messages and reset forms
    document.getElementById('updatePasswordError').textContent = '';
    document.getElementById('updateUsernameError').textContent = '';
    document.getElementById('updateEmailError').textContent = '';
    document.getElementById('deleteAccountError').textContent = '';

    // Reset password form
    document.getElementById('updatePasswordSection').style.display = 'block';
    document.getElementById('updatePasswordSuccess').style.display = 'none';
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';

    // Reset username form
    document.getElementById('updateUsernameSection').style.display = 'block';
    document.getElementById('updateUsernameSuccess').style.display = 'none';
    document.getElementById('updateUsernameConfirmation').style.display = 'none'; // Reset confirmation section
    document.getElementById('newUsername').value = '';

    // Reset email form
    document.getElementById('updateEmailSection').style.display = 'block';
    document.getElementById('updateEmailSuccess').style.display = 'none';
    document.getElementById('newEmail').value = '';
    window.hideUpdateEmailConfirmation();

    // Reset delete account form
    window.hideDeleteAccountConfirmation();
};

// Handle password update
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

// Handle username update
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

// Show the username confirmation form
window.showUpdateUsernameConfirmation = function() {
    document.getElementById('updateUsernameSection').style.display = 'none';
    document.getElementById('updateUsernameConfirmation').style.display = 'block';
    document.getElementById('confirmNewUsername').textContent = window.newUsernameToUpdate;
    document.getElementById('confirmUsernameError').textContent = '';
};

// Hide the username confirmation form
window.hideUpdateUsernameConfirmation = function() {
    document.getElementById('updateUsernameConfirmation').style.display = 'none';
    document.getElementById('updateUsernameSection').style.display = 'block';
    document.getElementById('updateUsernameError').textContent = '';
};

// Confirm the username update
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

// Handle email update (initial form submission)
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

// Show the email confirmation form
window.showUpdateEmailConfirmation = function() {
    document.getElementById('updateEmailSection').style.display = 'none';
    document.getElementById('updateEmailConfirmation').style.display = 'block';
    document.getElementById('confirmNewEmail').textContent = window.newEmailToUpdate;
    document.getElementById('confirmPassword').value = '';
    document.getElementById('confirmEmailError').textContent = '';
};

// Hide the email confirmation form
window.hideUpdateEmailConfirmation = function() {
    document.getElementById('updateEmailConfirmation').style.display = 'none';
    document.getElementById('updateEmailSection').style.display = 'block';
    document.getElementById('updateEmailError').textContent = '';
};

// Confirm the email update
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

// Stop the player (stops music playback)
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

// Reset the player to its initial state
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

    window.hasPlayed = false;
    window.isFlameActive = false;
};

// Update UI to reflect logged-out state
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

// Handle logout
window.handleLogout = async function(event) {
    event.preventDefault();

    window.stopPlayer(); // Still stop the player to avoid music playing during reload

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

// Show delete account confirmation
window.showDeleteAccountConfirmation = function() {
    document.getElementById('deleteAccountSection').style.display = 'none';
    document.getElementById('deleteAccountConfirmation').style.display = 'block';
};

// Hide delete account confirmation
window.hideDeleteAccountConfirmation = function() {
    document.getElementById('deleteAccountSection').style.display = 'block';
    document.getElementById('deleteAccountConfirmation').style.display = 'none';
    document.getElementById('deleteAccountError').textContent = '';
};

// Handle delete account form submission
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
        console.error('Error in handleDeleteAccount:', error);
        errorElement.textContent = 'An error occurred. Please try again.';
    }
};

// Function to get the complementary color
function getComplementaryColor(hexColor) {
    // Remove '#' if present
    hexColor = hexColor.replace('#', '');
    // Convert hex to RGB
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    // Calculate complementary color (255 - each component)
    const compR = (255 - r).toString(16).padStart(2, '0');
    const compG = (255 - g).toString(16).padStart(2, '0');
    const compB = (255 - b).toString(16).padStart(2, '0');
    return `#${compR}${compG}${compB}`;
}

// Function to flash the profile icon
window.flashProfileIcon = function() {
    const bitmapContainer = document.getElementById('profile-bitmap');
    if (!bitmapContainer) {
        console.error('Profile bitmap container not found for flashing.');
        return;
    }

    // Get the current color of the profile icon (first pixel with a color)
    let currentColor = null;
    const pixels = bitmapContainer.children;
    for (let i = 0; i < pixels.length; i++) {
        const bgColor = window.getComputedStyle(pixels[i]).backgroundColor;
        if (bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            // Convert RGB to hex
            const rgb = bgColor.match(/\d+/g);
            currentColor = `#${parseInt(rgb[0]).toString(16).padStart(2, '0')}${parseInt(rgb[1]).toString(16).padStart(2, '0')}${parseInt(rgb[2]).toString(16).padStart(2, '0')}`;
            break;
        }
    }

    // If no color is found, use the theme's text color as a fallback
    if (!currentColor) {
        currentColor = boutColorSchemes[boutSchemeIndex].text || '#000000'; // Fallback to black if theme color is undefined
        // Re-render the bitmap with the correct color to ensure consistency
        window.renderProfileBitmap(currentColor);
    }

    const complementaryColor = getComplementaryColor(currentColor);
    let flashCount = 0;
    const maxFlashes = 14; 
    const flashDuration = 500; // 500ms per flash (250ms per color)

    function flash() {
        if (flashCount >= maxFlashes) {
            // Final render with the original color
            window.renderProfileBitmap(currentColor);
            return;
        }

        // Toggle between current and complementary color
        // Start with the complementary color to flash to it first
        const colorToUse = flashCount % 2 === 0 ? complementaryColor : currentColor;
        window.renderProfileBitmap(colorToUse);
        flashCount++;
        setTimeout(flash, flashDuration);
    }
    // Start flashing
    flash();
};

async function loadPlayerState() {
    try {
        const response = await fetch(`dbcontrol/get_player_state.php?user_id=${window.user.id}`);
        if (!response.ok) throw new Error(`Failed to load player_state: ${response.statusText}`);
        const data = await response.json();
        if (data.success) {
            console.log("Resuming player state:", JSON.stringify(data.player_state) || "No state saved");
            return data.player_state;
        } else {
            console.error("Failed to load player_state:", data.error);
            return null;
        }
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

    // Initialize the prompt flags
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

        // Load player_state and apply bracket/contenders if in Bout Mode
        const player_state = await loadPlayerState();
        if (player_state && player_state.mode === "bout" && player_state.contenders.contender1 && player_state.contenders.contender2) {
            brackets.setCurrentBracket(player_state.bracket);
            brackets.setContenders([player_state.contenders.contender1, player_state.contenders.contender2]);
            brackets.setCurrentMode("bout");
            brackets.setActiveContender(0);
            brackets.setHasJammed(false);
            brackets.setBothContendersSelected(false);
            brackets.setIsFlameActive(false);
            // Update UI to reflect restored state
            brackets.updateBracketDropdown();
            document.getElementById("bracket-select").value = player_state.bracket.replace(" - ", "-");
            updateVsMatchupBound();
            updateRoundInfoBound();
            updateWinnerButtonsBound();
            updateFlameButtonBound();
        } else {
            // Default behavior if no valid Bout Mode state
            brackets.updateBracketDropdown();
            brackets.pickContenders(updateRoundInfoBound, updateVsMatchupBound, updateWinnerButtonsBound, updateFlameButtonBound);
        }
    } catch (error) {
        console.error('Error loading data:', error);
        window.sidJamData.cachedResults = {};
        window.sidJamData.sidFiles = [];
        window.sidJamData.pathToId = {};
        brackets.updateBracketDropdown();
        brackets.pickContenders(updateRoundInfoBound, updateVsMatchupBound, updateWinnerButtonsBound, updateFlameButtonBound);
    }

    document.getElementById("playPauseButton").disabled = false;
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`voice${i}`).addEventListener('change', () => player.toggleVoice(i));
    }

    // Apply initial theme for Bout Mode
    ui.applyTheme("bout");

    // Set initial button colors and title for hover
    const button = document.getElementById("colorButton");
    const currentTheme = baseColorSchemes[ui.currentThemeIndex];
    const nextIndex = (ui.currentThemeIndex + 1) % baseColorSchemes.length;
    const nextTheme = baseColorSchemes[nextIndex];
    button.style.backgroundColor = nextTheme.exterior;
    button.querySelector('.inner-box').style.backgroundColor = nextTheme.interior;
    button.title = `Switch Theme \n  From: ${currentTheme.name}\n  To: ${nextTheme.name}`;

    // Ensure the profile bitmap is rendered with a valid color
    const initialColor = baseColorSchemes[ui.currentThemeIndex].exteriorTextColor || '#000000';
    window.renderProfileBitmap(initialColor);

    checkSong2Clipping();
}


// Close auth pop-up when clicking outside the container
document.getElementById('authOverlay').addEventListener('click', function(event) {
    if (event.target === this) {
        window.toggleAuthPopUp();
    }
});

// Close preferences pop-up when clicking outside the container
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