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

function calculateLuminance(hexColor) {
    hexColor = hexColor.replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16) / 255;
    const g = parseInt(hexColor.substr(2, 2), 16) / 255;
    const b = parseInt(hexColor.substr(4, 2), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(color1, color2) {
    const l1 = calculateLuminance(color1) + 0.05;
    const l2 = calculateLuminance(color2) + 0.05;
    return l1 > l2 ? l1 / l2 : l2 / l1;
}

function adjustTextColor(textColor, highlightColor, fallbackColor) {
    const contrastThreshold = 4.5;
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

    renderProfileBitmap(isLoggedIn, theme.exteriorTextColor);

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

    updateWaveformVisibility(brackets.getPlayerState().isWaveformActive);
    updateVUMeterVisibility(brackets.getPlayerState().isVUActive, brackets.getPlayerState().isBarActive);
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
    const contenderTextColor = adjustTextColor(theme.exteriorTextColor, contenderHighlight, theme.interiorTextColor);

    vsMatchup.style.setProperty('--text-exterior', theme.exteriorTextColor);
    vsMatchup.style.setProperty('--text-contender', contenderTextColor);

    song1.classList.remove("active-song", "bomb-song");
    song2.classList.remove("active-song", "bomb-song");

    if (playerState.currentMode === "nowPlaying") {
        vsMatchup.classList.add("now-playing");
        song1.innerHTML = `<span class="text--exterior">${playerState.nowPlayingSong ? playerState.nowPlayingSong.split('/').pop() : '-'}</span>`;
        vsText.textContent = "";
        song2.innerHTML = "";
    } else {
        vsMatchup.classList.remove("now-playing");
        const songName0 = playerState.contenders[0]?.split('/').pop() || "-";
        const songName1 = playerState.contenders[1]?.split('/').pop() || "-";
        let song1Class = playerState.hasPlayed && playerState.activeContender === 0 ? 'active-song text--contender' : 'text--exterior';
        let song2Class = playerState.hasPlayed && playerState.activeContender === 1 ? 'active-song text--contender' : 'text--exterior';

        // Apply bomb-song class to the active contender when isBombActive is true
        if (playerState.isBombActive) {
            if (playerState.activeContender === 0) {
                song1Class = 'bomb-song';
            } else if (playerState.activeContender === 1) {
                song2Class = 'bomb-song';
            }
        }

        song1.innerHTML = `<span class="${song1Class}" title="${playerState.contenders[0] || '-'}">${songName0}</span>`;
        vsText.textContent = " - vs - ";
        song2.innerHTML = `<span class="${song2Class}" title="${playerState.contenders[1] || '-'}">${songName1}</span>`;
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

    if (playerState.isBombActive) {
        roundDiv.innerHTML = `<span class="bomb-activated text--exterior">Bomb Activated</span>`;
        blinkMessageTimeout = setTimeout(() => {
            if (playerState.isBombActive) {
                roundDiv.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="3">Click jAM to eliminate this contender or click Bomb again to cancel...</marquee>`;
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

export function updateVUMeterVisibility(isVUActive, isBarActive) {
    const vuContainer = document.getElementById("voice-controls-container");
    const vuCanvases = [
        document.getElementById("vu1-canvas"),
        document.getElementById("vu2-canvas"),
        document.getElementById("vu3-canvas")
    ];
    const barCanvases = [
        document.getElementById("amp1-canvas"),
        document.getElementById("amp2-canvas"),
        document.getElementById("amp3-canvas")
    ];

    if (vuContainer) {
        vuCanvases.forEach(canvas => {
            if (canvas) {
                canvas.style.display = isVUActive ? "block" : "none";
            }
        });
        barCanvases.forEach(canvas => {
            if (canvas) {
                canvas.style.display = isBarActive ? "block" : "none";
            }
        });
    } else {
        console.error('VU container not found in the DOM');
    }
}

export function updateVUMeterState() {
    const state = brackets.getPlayerState();
    updateVUMeterVisibility(state.isVUActive, state.isBarActive);
    const vuToggleButton = document.getElementById("vu-toggle-button");
    if (vuToggleButton) {
        vuToggleButton.disabled = false;
    } else {
        console.error('VU toggle button not found in the DOM');
    }
}

export function updateNavigationButtons(sidPlayer) {
    if (!sidPlayer) {
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
    const disabled = !playerState.hasPlayed || (playerState.roundCount === 1 && !playerState.hasJammed) || playerState.isBombActive;
    winnerLeft.disabled = disabled;
    winnerRight.disabled = disabled;
    winnerLeft.classList.toggle("disabled", disabled);
    winnerRight.classList.toggle("disabled", disabled);
    jamButton.disabled = !sidPlayer;

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
            window.logmsg(`Skipping render for ${id}: state already ${currentState}`, 1);
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

export function updateBombButton(playerState, sidPlayer) {
    const bombControls = document.getElementById("bomb-controls");
    const bombButton = document.getElementById("bombButton");
    const reviveButton = document.getElementById("reviveButton");

    if (!bombControls || !bombButton || !reviveButton) {
        console.error('Bomb controls elements not found in the DOM');
        return;
    }

    if (playerState.currentMode === "nowPlaying") {
        if (playerState.nowPlayingSongBracket === "Eliminated" && playerState.nowPlayingSong) {
            bombControls.classList.remove("hidden");
            bombButton.style.display = "none";
            reviveButton.style.display = "block";
            updateReviveButton(playerState.isReviveActive);
            return;
        }
        bombControls.classList.add("hidden");
        bombButton.style.display = "none";
        reviveButton.style.display = "none";
        return;
    }

    // Use activeBracket to determine bomb visibility
    if (playerState.activeBracket === "0 - 0") {
        bombControls.classList.remove("hidden");
        bombButton.style.display = "block";
        reviveButton.style.display = "none";
    } else {
        bombControls.classList.add("hidden");
        bombButton.style.display = "none";
        reviveButton.style.display = "none";
        return;
    }

    if (playerState.winner !== null || playerState.bothContendersSelected) {
        bombButton.disabled = true;
    } else {
        const availableSongs = window.sidJamData.sidFiles.filter(song => !playerState.contenders.includes(song));
        bombButton.disabled = !playerState.hasPlayed || availableSongs.length === 0;
    }

    renderSpriteAnimation(bombButton, "bomb", playerState.isBombActive);
    bombButton.setAttribute('title', playerState.isBombActive ? 'Cancel Bomb' : 'Bomb Contender');
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