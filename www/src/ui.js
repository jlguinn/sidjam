import { baseColorSchemes, getInvertedTheme } from './themes.js';
export let currentThemeIndex = 0;

export function debug(message) { console.log(`[DEBUG] ${message}`); }

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

    // Apply interior styles
    document.getElementById("player-info").style.backgroundColor = theme.interior;
    document.getElementById("track-details").style.color = theme.interiorTextColor;
    document.getElementById("song-title").style.color = theme.interiorTextColor;

    // Update profile bitmap with exterior text color
    window.renderProfileBitmap(theme.exteriorTextColor);

    // Update color toggle button to reflect *current* theme
    const button = document.getElementById("colorButton");
    button.style.backgroundColor = theme.exterior;
    button.querySelector('.inner-box').style.backgroundColor = theme.interior;
}



export function updateVsMatchup(currentMode, nowPlayingSong, contenders, activeContender, hasPlayed, isFlameActive) {
    if (currentMode === "nowPlaying") {
        document.getElementById("vs-matchup").classList.add("now-playing");
        document.getElementById("song1").innerHTML = `<span>${nowPlayingSong.split('/').pop()}</span>`;
        document.getElementById("vs-text").textContent = "";
        document.getElementById("song2").innerHTML = "";
        updateSongTitleHighlight(currentMode, false); // Placeholder, assumes revive not active initially
    } else {
        document.getElementById("vs-matchup").classList.remove("now-playing");
        let song0 = contenders[0].split('/').pop();
        let song1 = contenders[1]?.split('/').pop() || "-";
        let activeClass0 = hasPlayed && activeContender === 0 ? 'active-song' : '';
        let activeClass1 = hasPlayed && activeContender === 1 ? 'active-song' : '';
        if (isFlameActive && activeContender === 0) activeClass0 = 'flame-song';
        if (isFlameActive && activeContender === 1) activeClass1 = 'flame-song';
        document.getElementById("song1").innerHTML = `<span class="${activeClass0}" title="${contenders[0].replace('/sid/C64Music', '')}">${song0}</span>`;
        document.getElementById("vs-text").textContent = " - vs - ";
        document.getElementById("song2").innerHTML = `<span class="${activeClass1}" title="${contenders[1]?.replace('/sid/C64Music', '') || '-'}">${song1}</span>`;
    }
}

export function updateRoundInfo(currentMode, hasPlayed, bothContendersSelected, winner, contenders, roundCount) {
    let roundDiv = document.getElementById("round-info");
    if (!roundDiv) {
        console.error("round-info element not found");
        return;
    }

    if (currentMode === "nowPlaying") {
        roundDiv.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="3">Now Playing Mode... Click jAM to return to Bout Mode...</marquee>`;
        return;
    }

    // For guest users, show the scrolling message after the third vote until the prompt is dismissed
    if (!window.isLoggedIn && window.showPromptMessage && !window.hasShownPrompt) {
        roundDiv.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="3">Please sign in or register to save your progress...</marquee>`;
        // Log to confirm the message is being set
        // console.log("[DEBUG] Displaying scrolling message for guest user");
        return;
    }

    // Set the flag to true after the first jAM click following the prompt
    if (!window.isLoggedIn && window.showPromptMessage && window.hasShownPrompt) {
        // console.log("[DEBUG] Scrolling message dismissed after jAM click");
    }

    // Standard behavior for logged-in users, before the third vote, or after the prompt has been shown
    if (!hasPlayed) {
        roundDiv.textContent = "Press Play";
    } else if (bothContendersSelected) {
        roundDiv.innerHTML = `<span class="winner-highlight">Winner: Both Contenders</span>`;
    } else if (winner !== null) {
        roundDiv.innerHTML = `<span class="winner-highlight">Winner: ${contenders[winner].split('/').pop()}</span>`;
    } else {
        roundDiv.textContent = `Round ${roundCount}`;
    }
}

// Utility function to decode HTML entities
export function decodeHtmlEntities(str) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
}

export function updateSongInfo(sidPlayer) {
    if (sidPlayer) {
        let songInfo = sidPlayer.getSongInfo();
        document.getElementById("song-title").textContent = decodeHtmlEntities(songInfo.songName);
        let authorText = decodeHtmlEntities(songInfo.songAuthor.replace(/^Author:\s*/i, ''));
        document.getElementById("song-author").textContent = "Author: " + authorText;
        document.getElementById("song-released").textContent = "Released: " + decodeHtmlEntities(songInfo.songReleased);
        document.getElementById("track-info").textContent = "Track: " + (songInfo.actualSubsong + 1) + "/" + songInfo.maxSubsong;
    }
}

export function updateNavigationButtons(sidPlayer) {
    if (sidPlayer) {
        let songInfo = sidPlayer.getSongInfo();
        document.getElementById("prevButton").disabled = false;
        document.getElementById("nextButton").disabled = (songInfo.actualSubsong === songInfo.maxSubsong - 1);
    }
}

export function updatePlayPauseButton(isPlaying) {
    let button = document.getElementById("playPauseButton");
    button.style.backgroundImage = isPlaying ? "url('/image/pause.png')" : "url('/image/play.png')";
}

export function updateWinnerButtons(hasPlayed, roundCount, hasJammed, isFlameActive, sidPlayer) {
    const disabled = !hasPlayed || (roundCount === 1 && !hasJammed) || isFlameActive;
    document.getElementById("winner0").disabled = disabled;
    document.getElementById("winner1").disabled = disabled;
    document.getElementById("jamButton").disabled = !sidPlayer;
}

export function updateFlameButton(currentMode, currentBracket, nowPlayingSong, winner, bothContendersSelected, isFlameActive, hasPlayed, contenders, sidPlayer) {
    const flameControls = document.getElementById("flame-controls");
    const flameButton = document.getElementById("flameButton");
    const reviveButton = document.getElementById("reviveButton");

    if (currentMode === "nowPlaying") {
        if (currentBracket === "Eliminated" && nowPlayingSong) {
            let results = JSON.parse(localStorage.getItem('sidJamResults') || '{}');
            let record = results[nowPlayingSong] || { wins: 0, losses: 0 };
            if (record.losses >= 2) {
                flameControls.classList.remove("hidden");
                flameButton.style.display = "none";
                reviveButton.style.display = "block";
                updateReviveButton(false);
                return;
            }
        }
        flameControls.classList.add("hidden");
        flameButton.style.display = "none";
        reviveButton.style.display = "none";
        return;
    }

    if (currentBracket === "0 - 0") {
        flameControls.classList.remove("hidden");
        flameButton.style.display = "block";
        reviveButton.style.display = "none";
    } else {
        flameControls.classList.add("hidden");
        flameButton.style.display = "none";
        reviveButton.style.display = "none";
        return;
    }

    if (winner !== null || bothContendersSelected) {
        flameButton.disabled = true;
    } else {
        let availableSongs = window.sidJamData.sidFiles.filter(song => !contenders.includes(song));
        flameButton.disabled = !hasPlayed || availableSongs.length === 0;
    }

    flameButton.style.backgroundImage = isFlameActive ? "url('/image/Flame-01-june.gif')" : "url('/image/Flame-01-june.jpg')";
}

export function updateReviveButton(isReviveActive) {
    const reviveButton = document.getElementById("reviveButton");
    reviveButton.style.backgroundColor = isReviveActive ? "#90ee90" : "";
}

export function updateSongTitleHighlight(currentMode, isReviveActive) {
    const songFilename = document.querySelector("#song1 span");
    if (isReviveActive && currentMode === "nowPlaying") {
        songFilename.classList.add("revive-highlight");
    } else {
        songFilename.classList.remove("revive-highlight");
    }
}

export function toggleColorScheme(currentMode) {
    // Cycle to the next theme
    currentThemeIndex = (currentThemeIndex + 1) % baseColorSchemes.length;
    applyTheme(currentMode);

    // Log for debugging
    debug(`Switched to theme index ${currentThemeIndex} in ${currentMode} mode`);
}
