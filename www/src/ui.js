import { baseColorSchemes, getInvertedTheme } from './themes.js';
import * as brackets from './brackets.js';

export let currentThemeIndex = 0;

export function setCurrentThemeIndex(index) {
    currentThemeIndex = index;
}

export function getCurrentThemeIndex() {
    return currentThemeIndex;
}

function flipBitmapHorizontally(bitmap) {
    return bitmap.map(row => [...row].reverse());
}

// export function  debug(message) { console.log(`[DEBUG] ${message}`); }

// Utility function to calculate luminance of a hex color
function calculateLuminance(hexColor) {
    hexColor = hexColor.replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16) / 255;
    const g = parseInt(hexColor.substr(2, 2), 16) / 255;
    const b = parseInt(hexColor.substr(4, 2), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio between two colors
function getContrastRatio(color1, color2) {
    const l1 = calculateLuminance(color1) + 0.05;
    const l2 = calculateLuminance(color2) + 0.05;
    return l1 > l2 ? l1 / l2 : l2 / l1;
}

// Adjust text color based on contrast with highlight
function adjustTextColor(textColor, highlightColor, fallbackColor) {
    const contrastThreshold = 4.5; // WCAG AA standard
    // Check primary text color
    if (getContrastRatio(textColor, highlightColor) >= contrastThreshold) {
        return textColor;
    }
    // Check fallback color
    if (getContrastRatio(fallbackColor, highlightColor) >= contrastThreshold) {
        return fallbackColor;
    }
    // Final fallback to black for readability
    return "#000000";
}

export function applyTheme(currentMode) {
    const baseTheme = baseColorSchemes[currentThemeIndex];
    const theme = currentMode === "nowPlaying" ? getInvertedTheme(baseTheme) : baseTheme;

    // Apply exterior styles
    document.body.style.backgroundColor = theme.exterior;
    document.getElementById("title").style.color = theme.exteriorTextColor;
    document.getElementById("version").style.color = theme.exteriorTextColor;
    document.getElementById("vs-matchup").style.color = theme.exteriorTextColor;
    document.getElementById("round-info").style.color = theme.exteriorTextColor;
    document.getElementById("bracket-label").style.color = theme.exteriorTextColor;
    document.getElementById("user-info").style.color = theme.exteriorTextColor;

    const authLinkDiv = document.getElementById("auth-link");
    const authLink = authLinkDiv ? authLinkDiv.querySelector("a") : null;
    const preferencesLinkDiv = document.getElementById("preferences-link");
    const preferencesLink = preferencesLinkDiv ? preferencesLinkDiv.querySelector("a") : null;
    const profileIcon = document.getElementById("profile-icon");

    if (authLink) {
        authLink.style.color = theme.exteriorTextColor;
        const luminance = calculateLuminance(theme.exteriorTextColor);
        authLink.classList.remove('brighten-on-hover', 'darken-on-hover');
        authLink.classList.add(luminance > 0.5 ? 'darken-on-hover' : 'brighten-on-hover');
    }

    if (preferencesLink) {
        preferencesLink.style.color = theme.exteriorTextColor;
        const luminance = calculateLuminance(theme.exteriorTextColor);
        preferencesLink.classList.remove('brighten-on-hover', 'darken-on-hover');
        preferencesLink.classList.add(luminance > 0.5 ? 'darken-on-hover' : 'brighten-on-hover');
    }

    if (profileIcon) {
        const luminance = calculateLuminance(theme.exteriorTextColor);
        profileIcon.classList.remove('brighten-on-hover', 'darken-on-hover');
        profileIcon.classList.add(luminance > 0.5 ? 'darken-on-hover' : 'brighten-on-hover');
    }

    // Synchronize hover effects for both auth and preferences links
    const isLoggedIn = window.isLoggedIn || false;
    const activeLink = isLoggedIn ? preferencesLink : authLink;
    // // console.// debug(`[applyTheme] isLoggedIn: ${isLoggedIn}, activeLink: ${activeLink ? activeLink.textContent : 'null'}`);
    if (activeLink && profileIcon) {
        // Remove existing listeners to prevent duplicates
        activeLink.removeEventListener('mouseover', syncHoverOn);
        activeLink.removeEventListener('mouseout', syncHoverOff);
        profileIcon.removeEventListener('mouseover', syncHoverOn);
        profileIcon.removeEventListener('mouseout', syncHoverOff);

        // Add synchronized hover listeners
        const hoverHandler = (e) => {
            // console.// debug(`[hover] ${e.type} on ${e.target.id || e.target.tagName}, syncing hover`);
            activeLink.classList.add('hover');
            profileIcon.classList.add('hover');
        };
        const hoverOffHandler = (e) => {
            // console.// debug(`[hover] ${e.type} on ${e.target.id || e.target.tagName}, removing hover`);
            activeLink.classList.remove('hover');
            profileIcon.classList.remove('hover');
        };

        activeLink.addEventListener('mouseover', hoverHandler);
        activeLink.addEventListener('mouseout', hoverOffHandler);
        profileIcon.addEventListener('mouseover', hoverHandler);
        profileIcon.addEventListener('mouseout', hoverOffHandler);
    } else {
        // console.// debug(`[applyTheme] No hover sync: activeLink=${activeLink ? 'exists' : 'null'}, profileIcon=${profileIcon ? 'exists' : 'null'}`);
    }

    // Apply interior styles
    document.getElementById("player-info").style.backgroundColor = theme.interior;
    document.getElementById("track-details").style.color = theme.interiorTextColor;
    document.getElementById("song-title").style.color = theme.interiorTextColor;

    // Update profile bitmap based on login status
    window.renderProfileBitmap(theme.exteriorTextColor, isLoggedIn);

    // Update color toggle button
    const nextIndex = (currentThemeIndex + 1) % baseColorSchemes.length;
    const nextBaseTheme = baseColorSchemes[nextIndex];
    const nextTheme = currentMode === "nowPlaying" ? getInvertedTheme(nextBaseTheme) : nextBaseTheme;
    const button = document.getElementById("colorButton");
    button.style.backgroundColor = nextTheme.exterior;
    button.querySelector('.inner-box').style.backgroundColor = nextTheme.interior;
    button.title = `Switch Theme \n  From: ${baseTheme.name}\n  To: ${nextBaseTheme.name}`;
}

// Synchronize hover effects
function syncHoverOn() {
    const authLink = document.getElementById("auth-link")?.querySelector("a");
    const profileIcon = document.getElementById("profile-icon");
    if (authLink) authLink.classList.add('hover');
    if (profileIcon) profileIcon.classList.add('hover');
}

function syncHoverOff() {
    const authLink = document.getElementById("auth-link")?.querySelector("a");
    const profileIcon = document.getElementById("profile-icon");
    if (authLink) authLink.classList.remove('hover');
    if (profileIcon) profileIcon.classList.remove('hover');
}

export function updateVsMatchup(playerState) {
    const vsMatchup = document.getElementById("vs-matchup");
    const song1 = document.getElementById("song1");
    const song2 = document.getElementById("song2");
    const vsText = document.getElementById("vs-text");
    const baseTheme = baseColorSchemes[currentThemeIndex];
    const theme = playerState.currentMode === "nowPlaying" ? getInvertedTheme(baseTheme) : baseTheme;
    const contenderHighlight = "#00FFFF";
    const flameHighlight = "#8B0000";
    const contenderTextColor = adjustTextColor(theme.exteriorTextColor, contenderHighlight, theme.interiorTextColor);
    const flameTextColor =  "#FFFFFF";

    // Clear existing highlight classes to prevent stale styles
    song1.classList.remove("active-song", "flame-song");
    song2.classList.remove("active-song", "flame-song");

    if (playerState.currentMode === "nowPlaying") {
        vsMatchup.classList.add("now-playing");
        song1.innerHTML = `<span style="color: ${theme.exteriorTextColor}">${playerState.nowPlayingSong ? playerState.nowPlayingSong.split('/').pop() : '-'}</span>`;
        vsText.textContent = "";
        song2.innerHTML = "";
    } else {
        vsMatchup.classList.remove("now-playing");
        const songName0 = playerState.contenders[0]?.split('/').pop() || "-";
        const songName1 = playerState.contenders[1]?.split('/').pop() || "-";
        const activeClass0 = playerState.hasPlayed && playerState.activeContender === 0 ? 'active-song' : '';
        const activeClass1 = playerState.hasPlayed && playerState.activeContender === 1 ? 'active-song' : '';
        const flameClass0 = playerState.isFlameActive && playerState.activeContender === 0 ? 'flame-song' : activeClass0;
        const flameClass1 = playerState.isFlameActive && playerState.activeContender === 1 ? 'flame-song' : activeClass1;

        // Determine styles for song1
        const song1Class = playerState.isFlameActive && playerState.activeContender === 0 ? 'flame-song' : (playerState.hasPlayed && playerState.activeContender === 0 ? 'active-song' : '');
        const song1TextColor = playerState.isFlameActive && playerState.activeContender === 0 ? flameTextColor : (playerState.hasPlayed && playerState.activeContender === 0 ? contenderTextColor : theme.exteriorTextColor);

        // Determine styles for song2
        const song2Class = playerState.isFlameActive && playerState.activeContender === 1 ? 'flame-song' : (playerState.hasPlayed && playerState.activeContender === 1 ? 'active-song' : '');
        const song2TextColor = playerState.isFlameActive && playerState.activeContender === 1 ? flameTextColor : (playerState.hasPlayed && playerState.activeContender === 1 ? contenderTextColor : theme.exteriorTextColor);

        // Apply styles
        song1.innerHTML = `<span class="${song1Class}" style="color: ${song1TextColor}" title="${playerState.contenders[0]?.replace('/sid/C64Music', '') || '-'}">${songName0}</span>`;
        vsText.textContent = " - vs - ";
        song2.innerHTML = `<span class="${song2Class}" style="color: ${song2TextColor}" title="${playerState.contenders[1]?.replace('/sid/C64Music', '') || '-'}">${songName1}</span>`;
    }
}

let blinkMessageTimeout = null;

export function updateRoundInfo(playerState) {
    const roundDiv = document.getElementById("round-info");
    if (!roundDiv) {
        console.error("round-info element not found");
        return;
    }
    const baseTheme = baseColorSchemes[currentThemeIndex];
    const theme = playerState.currentMode === "nowPlaying" ? getInvertedTheme(baseTheme) : baseTheme;
    const winnerHighlight = "#90EE90";
    const winnerTextColor = adjustTextColor(theme.exteriorTextColor, winnerHighlight, "#000000");

    // Clear any existing timeout to prevent stale updates
    if (blinkMessageTimeout) {
        clearTimeout(blinkMessageTimeout);
        blinkMessageTimeout = null;
    }

    if (playerState.currentMode === "nowPlaying") {
        if (playerState.isReviveActive) {
            // Step 1: Show "Revive Activated" with blinking effect
            roundDiv.innerHTML = `<span class="revive-activated" style="color: ${theme.exteriorTextColor}">Revive Activated</span>`;

            // Step 2: After 2 seconds, switch to the instructional marquee
            blinkMessageTimeout = setTimeout(() => {
                // Only update if still in "nowPlaying" mode and isReviveActive is true
                if (playerState.currentMode === "nowPlaying" && playerState.isReviveActive) {
                    roundDiv.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="3">Click jAM to revive this contender or click Revive again to cancel...</marquee>`;
                }
                blinkMessageTimeout = null;
            }, 2000); // Matches the 2s duration of the blink animation
        } else {
            // Step 3: Default "Now Playing" marquee when Revive is not active
            roundDiv.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="3">Now Playing Mode... Click jAM to return to Bout Mode...</marquee>`;
        }
        return;
    }

    if (!window.isLoggedIn && window.showPromptMessage && !window.hasShownPrompt) {
        roundDiv.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="3">Please sign in or register to save your progress...</marquee>`;
        return;
    }

    if (playerState.isFlameActive && !playerState.bothContendersSelected && playerState.winner === null) {
        // Step 1: Show "Flame Activated" with blinking effect
        roundDiv.innerHTML = `<span class="flame-activated" style="color: ${theme.exteriorTextColor}">Flame Activated</span>`;

        // Step 2: After 2 seconds, switch to the appropriate marquee
        blinkMessageTimeout = setTimeout(() => {
            // Only update if still in "bout" mode, isFlameActive is true, and no winner is selected
            if (playerState.currentMode === "bout" && playerState.isFlameActive && !playerState.bothContendersSelected && playerState.winner === null) {
                const marqueeMessage = playerState.isUnplayableSID
                    ? "Unplayable SID detected... Click jAM to eliminate or flame to cancel..."
                    : "Contender queued for elimination... Click jAM to confirm or flame to cancel...";
                roundDiv.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="3" style="color: ${theme.exteriorTextColor}">${marqueeMessage}</marquee>`;
            }
            blinkMessageTimeout = null;
        }, 2000); // Matches the 2s duration of the blink animation
        return;
    }

    if (!playerState.hasPlayed) {
        roundDiv.textContent = "Press Play";
    } else if (playerState.bothContendersSelected) {
        roundDiv.innerHTML = `<span class="winner-highlight" style="color: ${winnerTextColor}">Winner: Both Contenders</span>`;
    } else if (playerState.winner !== null) {
        roundDiv.innerHTML = `<span class="winner-highlight" style="color: ${winnerTextColor}">Winner: ${playerState.contenders[playerState.winner]?.split('/').pop() || '-'}</span>`;
    } else {
        roundDiv.textContent = `Round ${playerState.roundCount}`;
    }
}

export function decodeHtmlEntities(str) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
}

export function updateSongInfo(sidPlayer) {
    if (sidPlayer) {
        const songInfo = sidPlayer.getSongInfo();
        document.getElementById("song-title").textContent = decodeHtmlEntities(songInfo.songName);
        document.getElementById("song-author").textContent = "Author: " + decodeHtmlEntities(songInfo.songAuthor.replace(/^Author:\s*/i, ''));
        document.getElementById("song-released").textContent = "Released: " + decodeHtmlEntities(songInfo.songReleased);
        document.getElementById("track-info").textContent = "Track: " + (songInfo.actualSubsong + 1) + "/" + songInfo.maxSubsong;
    }
}

export function updateNavigationButtons(sidPlayer) {
    if (sidPlayer) {
        const songInfo = sidPlayer.getSongInfo();
        document.getElementById("prevButton").disabled = false;
        document.getElementById("nextButton").disabled = (songInfo.actualSubsong === songInfo.maxSubsong - 1);
    }
}

export function updatePlayPauseButton(isPlaying) {
    const button = document.getElementById("playPauseButton");
    button.style.backgroundImage = isPlaying ? "url('/image/pause.png')" : "url('/image/play.png')";
}

export function updateWinnerButtons(playerState, sidPlayer) {
    const winnerControls = document.getElementById("winner-controls");
    if (playerState.currentMode === "nowPlaying") {
        winnerControls.style.display = "none";
        document.getElementById("jamButton").disabled = !sidPlayer;
        return;
    }

    winnerControls.style.display = "flex"; // Restore visibility in Bout Mode
    const disabled = !playerState.hasPlayed || (playerState.roundCount === 1 && !playerState.hasJammed) || playerState.isFlameActive;
    document.getElementById("winner0").disabled = disabled;
    document.getElementById("winner1").disabled = disabled;
    document.getElementById("jamButton").disabled = !sidPlayer;
}

export function updateFlameButton(playerState, sidPlayer) {
    const flameControls = document.getElementById("flame-controls");
    const flameButton = document.getElementById("flameButton");
    const reviveButton = document.getElementById("reviveButton");

    if (playerState.currentMode === "nowPlaying") {
        if (playerState.nowPlayingSongBracket === "Eliminated" && playerState.nowPlayingSong) {
            flameControls.classList.remove("hidden");
            flameButton.style.display = "none";
            reviveButton.style.display = "block";
            updateReviveButton(playerState.isReviveActive);
            return;
        }
        flameControls.classList.add("hidden");
        flameButton.style.display = "none";
        reviveButton.style.display = "none";
        return;
    }

    if (playerState.peekBracket === "0 - 0") {
        flameControls.classList.remove("hidden");
        flameButton.style.display = "block";
        reviveButton.style.display = "none";
    } else {
        flameControls.classList.add("hidden");
        flameButton.style.display = "none";
        reviveButton.style.display = "none";
        return;
    }

    if (playerState.winner !== null || playerState.bothContendersSelected) {
        flameButton.disabled = true;
    } else {
        const availableSongs = window.sidJamData.sidFiles.filter(song => !playerState.contenders.includes(song));
        flameButton.disabled = !playerState.hasPlayed || availableSongs.length === 0;
    }

    // Ensure the animated GIF is used when isFlameActive is true
    flameButton.style.backgroundImage = playerState.isFlameActive ? "url('/image/Flame-01-june.gif')" : "url('/image/Flame-01-june.jpg')";
}

export function updateReviveButton(isReviveActive) {
    const reviveButton = document.getElementById("reviveButton");
    // reviveButton.style.backgroundColor = isReviveActive ? "#90ee90" : "";
    if (isReviveActive) {
        reviveButton.classList.add("active");
    } else {
        reviveButton.classList.remove("active");
    }
}

export function updateSongTitleHighlight(mode, isReviveActive) {
    const songTitle = document.getElementById("song-title");
    const baseTheme = baseColorSchemes[currentThemeIndex];
    const theme = mode === "nowPlaying" ? getInvertedTheme(baseTheme) : baseTheme;

    songTitle.style.color = theme.exteriorTextColor;
    if (isReviveActive) {
        songTitle.classList.add("reviveHighlight");
    } else {
        songTitle.classList.remove("reviveHighlight");
    }

    updateRoundInfo(brackets.getPlayerState());
}

export function toggleColorScheme(currentMode) {
    setCurrentThemeIndex((currentThemeIndex + 1) % baseColorSchemes.length);
    const currentBaseTheme = baseColorSchemes[currentThemeIndex]; // Use the updated index
    applyTheme(currentMode);

    const nextIndex = (getCurrentThemeIndex() + 1) % baseColorSchemes.length;
    const nextBaseTheme = baseColorSchemes[nextIndex];
    const nextTheme = currentMode === "nowPlaying" ? getInvertedTheme(nextBaseTheme) : nextBaseTheme;
    const button = document.getElementById("colorButton");
    button.style.backgroundColor = nextTheme.exterior;
    button.querySelector('.inner-box').style.backgroundColor = nextTheme.interior;
    button.title = `Switch Theme \n  From: ${currentBaseTheme.name}\n  To: ${nextBaseTheme.name}`; // Use currentBaseTheme
    // debug(`Theme switched to ${currentBaseTheme.name} (index ${getCurrentThemeIndex()}).`);

    const playerState = brackets.getPlayerState();
    updateVsMatchup(playerState);
}