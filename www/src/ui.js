// ui.js
import { baseColorSchemes, getInvertedTheme } from './themes.js';
import * as brackets from './brackets.js';
import { renderProfileBitmap, renderWinnerButtonBitmap } from './bitmap.js';
import { renderSpriteAnimation } from './spriteAnimator.js'; 
import * as player from './player.js';

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
    if (getContrastRatio(textColor, highlightColor) >= contrastThreshold) {
        return textColor;
    }
    if (getContrastRatio(fallbackColor, highlightColor) >= contrastThreshold) {
        return fallbackColor;
    }
    return "#000000";
}

export function applyTheme(currentMode) {
    const baseTheme = baseColorSchemes[currentThemeIndex];
    const theme = currentMode === "nowPlaying" ? getInvertedTheme(baseTheme) : baseTheme;

    // Apply exterior styles
    const body = document.body;
    const title = document.getElementById("title");
    const version = document.getElementById("version");
    const vsMatchup = document.getElementById("vs-matchup");
    const roundInfo = document.getElementById("round-info");
    const userInfo = document.getElementById("user-info");

    if (!body || !title || !version || !vsMatchup || !roundInfo || !userInfo) {
        console.error('One or more exterior elements not found in the DOM');
        return;
    }

    body.style.backgroundColor = theme.exterior;
    title.style.color = theme.exteriorTextColor;
    version.style.color = theme.exteriorTextColor;
    vsMatchup.style.color = theme.exteriorTextColor;
    roundInfo.style.color = theme.exteriorTextColor;
    userInfo.style.color = theme.exteriorTextColor;

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
    if (activeLink && profileIcon) {
        activeLink.removeEventListener('mouseover', syncHoverOn);
        activeLink.removeEventListener('mouseout', syncHoverOff);
        profileIcon.removeEventListener('mouseover', syncHoverOn);
        profileIcon.removeEventListener('mouseout', syncHoverOff);

        const hoverHandler = (e) => {
            activeLink.classList.add('hover');
            profileIcon.classList.add('hover');
        };
        const hoverOffHandler = (e) => {
            activeLink.classList.remove('hover');
            profileIcon.classList.remove('hover');
        };

        activeLink.addEventListener('mouseover', hoverHandler);
        activeLink.addEventListener('mouseout', hoverOffHandler);
        profileIcon.addEventListener('mouseover', hoverHandler);
        profileIcon.removeEventListener('mouseout', hoverOffHandler);
    }

    // Apply interior styles
    const playerInfo = document.getElementById("player-info");
    const trackDetails = document.getElementById("track-details");
    const songTitle = document.getElementById("song-title");

    if (!playerInfo || !trackDetails || !songTitle) {
        console.error('One or more interior elements not found in the DOM');
        return;
    }

    playerInfo.style.backgroundColor = theme.interior;
    trackDetails.style.color = theme.interiorTextColor;
    songTitle.style.color = theme.interiorTextColor;

    // Update profile bitmap based on login status
    renderProfileBitmap(isLoggedIn, theme.exteriorTextColor);

    // Update color toggle button
    const nextIndex = (currentThemeIndex + 1) % baseColorSchemes.length;
    const nextBaseTheme = baseColorSchemes[nextIndex];
    const nextTheme = currentMode === "nowPlaying" ? getInvertedTheme(nextBaseTheme) : nextBaseTheme;
    const button = document.getElementById("colorButton");
    if (!button) {
        console.error('Color toggle button not found in the DOM');
        return;
    }
    button.style.backgroundColor = nextTheme.exterior;
    const icon = button.querySelector('.color-toggle__icon');
    if (icon) {
        icon.style.backgroundColor = nextTheme.interior;
    } else {
        console.error('Color toggle icon not found in #colorButton');
    }
    button.title = `Switch Theme \n  From: ${baseTheme.name}\n  To: ${nextBaseTheme.name}`;

    // Reapply waveform visibility
    updateWaveformVisibility(brackets.getPlayerState().isWaveformActive);
    updateVUMeterVisibility(brackets.getPlayerState().isVUActive);
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
    if (!vsMatchup || !song1 || !song2 || !vsText) {
        console.error('VS matchup elements not found in the DOM');
        return;
    }

    const baseTheme = baseColorSchemes[currentThemeIndex];
    const theme = playerState.currentMode === "nowPlaying" ? getInvertedTheme(baseTheme) : baseTheme;
    const contenderHighlight = "#00FFFF";
    const flameHighlight = "#8B0000";
    const contenderTextColor = adjustTextColor(theme.exteriorTextColor, contenderHighlight, theme.interiorTextColor);
    const flameTextColor = "#FFFFFF";

    vsMatchup.style.setProperty('--text-exterior', theme.exteriorTextColor);
    vsMatchup.style.setProperty('--text-contender', contenderTextColor);
    vsMatchup.style.setProperty('--text-flame', flameTextColor);

    song1.classList.remove("active-song", "flame-song");
    song2.classList.remove("active-song", "flame-song");

    if (playerState.currentMode === "nowPlaying") {
        vsMatchup.classList.add("now-playing");
        song1.innerHTML = `<span class="text--exterior">${playerState.nowPlayingSong ? playerState.nowPlayingSong.split('/').pop() : '-'}</span>`;
        vsText.textContent = "";
        song2.innerHTML = "";
    } else {
        vsMatchup.classList.remove("now-playing");
        const songName0 = playerState.contenders[0]?.split('/').pop() || "-";
        const songName1 = playerState.contenders[1]?.split('/').pop() || "-";
        const song1Class = playerState.isFlameActive && playerState.activeContender === 0 ? 'flame-song text--flame' : (playerState.hasPlayed && playerState.activeContender === 0 ? 'active-song text--contender' : 'text--exterior');
        const song2Class = playerState.isFlameActive && playerState.activeContender === 1 ? 'flame-song text--flame' : (playerState.hasPlayed && playerState.activeContender === 1 ? 'active-song text--contender' : 'text--exterior');

        song1.innerHTML = `<span class="${song1Class}" title="${playerState.contenders[0]?.replace('/sid/C64Music', '') || '-'}">${songName0}</span>`;
        vsText.textContent = " - vs - ";
        song2.innerHTML = `<span class="${song2Class}" title="${playerState.contenders[1]?.replace('/sid/C64Music', '') || '-'}">${songName1}</span>`;
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

    roundDiv.style.setProperty('--text-exterior', theme.exteriorTextColor);
    roundDiv.style.setProperty('--text-winner', winnerTextColor);

    if (blinkMessageTimeout) {
        clearTimeout(blinkMessageTimeout);
        blinkMessageTimeout = null;
    }

    if (playerState.currentMode === "nowPlaying") {
        if (playerState.isReviveActive) {
            roundDiv.innerHTML = `<span class="revive-activated text--exterior">Revive Activated</span>`;
            blinkMessageTimeout = setTimeout(() => {
                if (playerState.currentMode === "nowPlaying" && playerState.isReviveActive) {
                    roundDiv.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="3">Click jAM to revive this contender or click Revive again to cancel...</marquee>`;
                }
                blinkMessageTimeout = null;
            }, 2000);
        } else {
            roundDiv.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="3">Now Playing Mode... Click jAM to return to Bout Mode...</marquee>`;
        }
        return;
    }

    if (!window.isLoggedIn && window.showPromptMessage && !window.hasShownPrompt) {
        roundDiv.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="3">Please sign in or register to save your progress...</marquee>`;
        return;
    }

    if (playerState.isFlameActive && !playerState.bothContendersSelected && playerState.winner === null) {
        roundDiv.innerHTML = `<span class="flame-activated text--exterior">Flame Activated</span>`;
        blinkMessageTimeout = setTimeout(() => {
            if (playerState.currentMode === "bout" && playerState.isFlameActive && !playerState.bothContendersSelected && playerState.winner === null) {
                const marqueeMessage = playerState.isUnplayableSID
                    ? "Unplayable SID detected... Click jAM to eliminate or flame to cancel..."
                    : "Contender queued for elimination... Click jAM to confirm or flame to cancel...";
                roundDiv.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="3" class="text--exterior">${marqueeMessage}</marquee>`;
            }
            blinkMessageTimeout = null;
        }, 2000);
        return;
    }

    if (!playerState.hasPlayed) {
        roundDiv.textContent = "Press Play";
    } else if (playerState.bothContendersSelected) {
        roundDiv.innerHTML = `<span class="winner-highlight text--winner">Winner: Both Contenders</span>`;
    } else if (playerState.winner !== null) {
        roundDiv.innerHTML = `<span class="winner-highlight text--winner">Winner: ${playerState.contenders[playerState.winner]?.split('/').pop() || '-'}</span>`;
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
    if (!sidPlayer) {
        console.error('SID player not provided');
        return;
    }

    const songInfo = sidPlayer.getSongInfo();
    const songTitle = document.getElementById("song-title");
    const songAuthor = document.getElementById("song-author");
    const songReleased = document.getElementById("song-released");
    const trackInfo = document.getElementById("track-info");

    if (!songTitle || !songAuthor || !songReleased || !trackInfo) {
        console.error('Song info elements not found in the DOM');
        return;
    }

    songTitle.textContent = decodeHtmlEntities(songInfo.songName);
    songAuthor.textContent = "Author: " + decodeHtmlEntities(songInfo.songAuthor.replace(/^Author:\s*/i, ''));
    songReleased.textContent = "Released: " + decodeHtmlEntities(songInfo.songReleased);
    trackInfo.textContent = "Track: " + (songInfo.actualSubsong + 1) + "/" + songInfo.maxSubsong;
}

export function updateWaveformVisibility(isWaveformActive) {
    const waveformContainer = document.getElementById("voice-visualizations");
    const waveformToggleButton = document.getElementById("wave-toggle-button");

    if (waveformContainer) {
        waveformContainer.style.display = isWaveformActive ? "flex" : "none";
    } else {
        console.error('Waveform container not found in the DOM');
    }

    if (waveformToggleButton) {
        waveformToggleButton.style.filter = isWaveformActive ? "none" : "brightness(70%)";
        waveformToggleButton.classList.remove("inactive");
        waveformToggleButton.disabled = false;
        waveformToggleButton.title = isWaveformActive ? "Hide Waveforms" : "Show Waveforms";
    } else {
        console.error('Waveform toggle button not found in the DOM');
    }
}

export function updateVUMeterVisibility(isVUActive) {
    const vuContainer = document.getElementById("voice-controls-container");
    const vuToggleButton = document.getElementById("vu-toggle-button");
    const vuCanvases = [
        document.getElementById("vu1-canvas"),
        document.getElementById("vu2-canvas"),
        document.getElementById("vu3-canvas")
    ];

    if (vuContainer) {
        vuCanvases.forEach(canvas => {
            if (canvas) {
                canvas.style.display = isVUActive ? "block" : "none";
            }
        });
    } else {
        console.error('VU container not found in the DOM');
    }

    if (vuToggleButton) {
        vuToggleButton.style.filter = isVUActive ? "none" : "brightness(70%)";
        vuToggleButton.classList.remove("inactive");
        vuToggleButton.disabled = false;
        vuToggleButton.title = isVUActive ? "Hide VU Meters" : "Show VU Meters";
    } else {
        console.error('VU toggle button not found in the DOM');
    }
}

export function updateNavigationButtons(sidPlayer) {
    if (!sidPlayer) {
        console.error('SID player not provided');
        return;
    }

    const prevButton = document.getElementById("prevButton");
    const nextButton = document.getElementById("nextButton");

    if (!prevButton || !nextButton) {
        console.error('Navigation buttons not found in the DOM');
        return;
    }

    const songInfo = sidPlayer.getSongInfo();
    prevButton.disabled = false;
    nextButton.disabled = (songInfo.actualSubsong === songInfo.maxSubsong - 1);
}

export function updatePlayPauseButton(isPlaying) {
    const button = document.getElementById("playPauseButton");
    if (!button) {
        console.error('Play/Pause button not found in the DOM');
        return;
    }
    button.style.backgroundImage = isPlaying ? "url('../image/pause.png')" : "url('../image/play.png')";
}

export function updateWinnerButtons(playerState, sidPlayer) {
    const winnerLeft = document.getElementById("winner-left");
    const winnerRight = document.getElementById("winner-right");
    const jamButton = document.getElementById("jamButton");

    if (!winnerLeft || !winnerRight || !jamButton) {
        console.error('Winner buttons or jam button not found in the DOM');
        return;
    }

    if (playerState.currentMode === "nowPlaying") {
        winnerLeft.classList.add("hidden");
        winnerRight.classList.add("hidden");
        jamButton.disabled = !sidPlayer;
        return;
    }

    winnerLeft.classList.remove("hidden");
    winnerRight.classList.remove("hidden");
    const disabled = !playerState.hasPlayed || (playerState.roundCount === 1 && !playerState.hasJammed) || playerState.isFlameActive;
    winnerLeft.disabled = disabled;
    winnerRight.disabled = disabled;
    winnerLeft.classList.toggle("disabled", disabled);
    winnerRight.classList.toggle("disabled", disabled);
    jamButton.disabled = !sidPlayer;

    // Render bitmaps only if state has changed
    const buttons = [
        { id: 'winner-left', index: 0, element: winnerLeft },
        { id: 'winner-right', index: 1, element: winnerRight }
    ];

    buttons.forEach(({ id, index, element }) => {
        const isWinner = playerState.winner === index;
        const isBothSelected = playerState.bothContendersSelected;
        const isOtherWinner = playerState.winner !== null && playerState.winner !== index;
        let expectedState = 'in';
        if (isWinner || (isBothSelected && playerState.activeBracket === "0 - 0")) {
            expectedState = 'up';
        } else if (isOtherWinner) {
            expectedState = 'down';
        }
        const currentState = element.dataset.bitmapState || 'in';
        if (currentState !== expectedState) {
            renderWinnerButtonBitmap(index, playerState);
        } else {
            window.logmsg(`Skipping render for ${id}: state already ${currentState}`, 2);
        }
    });
}

export function updateJamButton(isPlaying) {
    const jamButton = document.getElementById("jamButton");
    if (!jamButton) {
        console.error('Jam button not found in the DOM');
        return;
    }

    const playerState = brackets.getPlayerState();
    const sidPlayer = player.sidPlayer;

    if (playerState.currentMode === "nowPlaying") {
        jamButton.disabled = !sidPlayer;
    } else {
        jamButton.disabled = !sidPlayer;
    }

    renderSpriteAnimation(jamButton, "jam", isPlaying);
    jamButton.setAttribute('title', isPlaying ? 'Pause and Switch Mode' : 'Play and Switch Mode');
}

export function updateFlameButton(playerState, sidPlayer) {
    const flameControls = document.getElementById("flame-controls");
    const flameButton = document.getElementById("flameButton");
    const reviveButton = document.getElementById("reviveButton");

    if (!flameControls || !flameButton || !reviveButton) {
        console.error('Flame controls elements not found in the DOM');
        return;
    }

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

    renderSpriteAnimation(flameButton, "flame", playerState.isFlameActive);
    flameButton.setAttribute('title', playerState.isFlameActive ? 'Cancel Flame' : 'Flame Contender');
}

export function updateReviveButton(isReviveActive) {
    const reviveButton = document.getElementById("reviveButton");
    if (!reviveButton) {
        console.error('Revive button not found in the DOM');
        return;
    }

    if (isReviveActive) {
        reviveButton.classList.add("active");
    } else {
        reviveButton.classList.remove("active");
    }
}

export function updateSongTitleHighlight(mode, isReviveActive) {
    const songFileName = document.getElementById("song1");
    if (!songFileName) {
        console.error('Song title element not found in the DOM');
        return;
    }

    const baseTheme = baseColorSchemes[currentThemeIndex];
    const theme = mode === "nowPlaying" ? getInvertedTheme(baseTheme) : baseTheme;

    songFileName.style.color = theme.exteriorTextColor;
    if (isReviveActive) {
        songFileName.classList.add("revive-highlight");
    } else {
        songFileName.classList.remove("revive-highlight");
    }

    updateRoundInfo(brackets.getPlayerState());
}

export function toggleColorScheme(currentMode) {
    setCurrentThemeIndex((currentThemeIndex + 1) % baseColorSchemes.length);
    const currentBaseTheme = baseColorSchemes[currentThemeIndex];
    applyTheme(currentMode);

    const nextIndex = (getCurrentThemeIndex() + 1) % baseColorSchemes.length;
    const nextBaseTheme = baseColorSchemes[nextIndex];
    const nextTheme = currentMode === "nowPlaying" ? getInvertedTheme(nextBaseTheme) : nextBaseTheme;
    const button = document.getElementById("colorButton");
    if (!button) {
        console.error('Color toggle button not found in the DOM');
        return;
    }
    button.style.backgroundColor = nextTheme.exterior;
    const icon = button.querySelector('.color-toggle__icon');
    if (icon) {
        icon.style.backgroundColor = nextTheme.interior;
    } else {
        console.error('Color toggle icon not found in #colorButton during toggleColorScheme');
    }
    button.title = `Switch Theme \n  From: ${currentBaseTheme.name}\n  To: ${nextBaseTheme.name}`;

    const playerState = brackets.getPlayerState();
    updateVsMatchup(playerState);
}