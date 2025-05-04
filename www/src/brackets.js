import { sidPlayer, isPlaying, stopTimer, setIsPlaying } from './player.js';
import { applyTheme, updateRoundInfo, getCurrentThemeIndex } from './ui.js'; // Added getCurrentThemeIndex
import { baseColorSchemes } from './themes.js'; // Added for theme access
import { renderWinnerButtonBitmap } from './bitmap.js'; // Added for bitmap rendering

const USE_DETERMINISTIC_RANDOM = false;
if (USE_DETERMINISTIC_RANDOM) {
    window.logmsg("Using deterministic draws...");
} else {
    window.logmsg("Using random draws...");
}

class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
  
    random() {
        const a = 1664525;
        const c = 1013904223;
        const m = Math.pow(2, 32);
        this.seed = (a * this.seed + c) % m;
        return this.seed / m;
    }
  
    randint(min, max) {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }
}

const seededRandom = new SeededRandom(256890);

const getRandom = {
    random: () => {
        if (USE_DETERMINISTIC_RANDOM) {
            return seededRandom.random();
        }
        return Math.random();
    },
    randint: (min, max) => {
        if (USE_DETERMINISTIC_RANDOM) {
            return seededRandom.randint(min, max);
        }
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
};

export let playerState = {
    contenders: [],
    activeContender: 0,
    roundCount: 1,
    winner: null,
    hasPlayed: false,
    hasJammed: false,
    bothContendersSelected: false,
    isFlameActive: false,
    isReviveActive: false,
    peekBracket: "0 - 0",
    activeBracket: "0 - 0",
    currentMode: "bout",
    nowPlayingSong: null,
    peekPlayingSong: null,
    nowPlayingSongBracket: null,
    isUnplayableSID: false,
    isWaveformActive: true,
    isVUActive: true
};

export function debug(message) { console.log(`[DEBUG] ${message}`); }

export function getPlayerState() {
    return playerState;
}

export function updatePlayerState(updates) {
    playerState = { ...playerState, ...updates };
    // window.logmsg(`Updated playerState: ${JSON.stringify(playerState)}`);
}

export function isSpecialBracket(bracket) {
    const specialBrackets = ["All", "Eliminated"];
    return specialBrackets.includes(bracket) || getContenderCount(bracket) < 2 || playerState.currentMode != "bout";
}

export function getContenderCount(bracket) {
    let count;
    if (bracket === "All") {
        count = window.sidJamData.sidFiles.length;
    } else if (bracket === "Eliminated") {
        count = window.sidJamData.sidFiles.filter(file => {
            let record = window.sidJamData.cachedResults[file] || { wins: 0, losses: 0 };
            return record.losses >= 2;
        }).length;
    } else {
        let [wins, losses] = bracket.split(' - ').map(Number);
        count = window.sidJamData.sidFiles.filter(file => {
            let record = window.sidJamData.cachedResults[file] || { wins: 0, losses: 0 };
            return record.wins === wins && record.losses === losses;
        }).length;
    }
    return count;
}

export function findEligibleBracket() {
    let brackets = {};
    window.sidJamData.sidFiles.forEach(file => {
        let record = window.sidJamData.cachedResults[file] || { wins: 0, losses: 0 };
        if (record.losses < 2) {
            let key = `${record.wins} - ${record.losses}`;
            brackets[key] = (brackets[key] || 0) + 1;
        }
    });

    let eligibleBrackets = Object.keys(brackets).filter(key => getContenderCount(key) >= 2);
    if (eligibleBrackets.length === 0) {
        window.logmsg("No eligible brackets found");
        return null;
    }

    eligibleBrackets.sort((a, b) => getContenderCount(b) - getContenderCount(a));
    let selectedBracket = eligibleBrackets[0];
    window.logmsg(`Selected bracket: ${selectedBracket} with ${getContenderCount(selectedBracket)} contenders`);
    return selectedBracket;
}


export function findFallbackBracket() {
    let brackets = {};
    window.sidJamData.sidFiles.forEach(file => {
        let record = window.sidJamData.cachedResults[file] || { wins: 0, losses: 0 };
        if (record.losses < 2) {
            let key = `${record.wins} - ${record.losses}`;
            brackets[key] = (brackets[key] || 0) + 1;
        }
    });

    let nonEmptyBrackets = Object.keys(brackets).filter(key => brackets[key] >= 1 && key !== "0 - 0");

    if (nonEmptyBrackets.length === 0) {
        window.logmsg("No non-empty brackets found for fallback");
        return null;
    }

    nonEmptyBrackets.sort((a, b) => {
        const [aWins, aLosses] = a.split(" - ").map(Number);
        const [bWins, bLosses] = b.split(" - ").map(Number);
        if (aWins !== bWins) return aWins - bWins; // Sort by wins ASC
        return bLosses - aLosses; // If wins equal, sort by losses DESC
    });

    const selectedBracket = nonEmptyBrackets[0];
    window.logmsg(`Fallback bracket: ${selectedBracket} with ${brackets[selectedBracket]} contenders`);
    return selectedBracket;
}

export function replaceContenderFromBracket(bracket, excludeSongs = []) {
    let filteredSongs = window.sidJamData.sidFiles.filter(song => {
        if (excludeSongs.includes(song)) return false;
        let record = window.sidJamData.cachedResults[song] || { wins: 0, losses: 0 };
        let [wins, losses] = bracket.split(' - ').map(Number);
        return record.wins === wins && record.losses === losses;
    });

    if (filteredSongs.length === 0) {
        window.logmsg(`No contenders available in bracket ${bracket}`);
        return null;
    }

    let newSongIndex = getRandom.randint(0, filteredSongs.length - 1);
    return filteredSongs[newSongIndex];
}

export function getSongBracket(song) {
    if (!song || !window.sidJamData.cachedResults) {
        return null;
    }

    const record = window.sidJamData.cachedResults[song] || { wins: 0, losses: 0 };
    if (record.losses >= 2) {
        return "Eliminated";
    }
    return `${record.wins} - ${record.losses}`;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = getRandom.randint(0, i);
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton) {
    let filteredFiles = [];
    if (playerState.peekBracket === "All") {
        filteredFiles = window.sidJamData.sidFiles;
    } else if (playerState.peekBracket === "Eliminated") {
        filteredFiles = window.sidJamData.sidFiles.filter(file => {
            let record = window.sidJamData.cachedResults[file] || { wins: 0, losses: 0 };
            return record.losses >= 2;
        });
    } else {
        let [wins, losses] = playerState.peekBracket.split(' - ').map(Number);
        filteredFiles = window.sidJamData.sidFiles.filter(file => {
            let record = window.sidJamData.cachedResults[file] || { wins: 0, losses: 0 };
            return record.wins === wins && record.losses === losses;
        });
    }

    if (filteredFiles.length < 2) {
        updatePlayerState({ peekBracket: playerState.activeBracket});
        updateBracketDropdown();
        return false;
    }

    let shuffled = shuffleArray([...filteredFiles]);
    let selectedContenders = shuffled.slice(0, 2);
    updatePlayerState({
        contenders: selectedContenders,
        hasJammed: false,
        bothContendersSelected: false,
        isFlameActive: false,
        isUnplayableSID: false, // Reset on new contenders
        activeContender: 0
    });

    console.log(`Bracket: ${playerState.peekBracket} (${filteredFiles.length} contenders)`);
    console.log(`${window.sidJamData.pathToId[playerState.contenders[0]]} ${playerState.contenders[0]}`);
    console.log("- vs -");
    console.log(`${window.sidJamData.pathToId[playerState.contenders[1]]} ${playerState.contenders[1]}`);

    updateRoundInfo(playerState);
    updateVsMatchup(playerState);
    updateWinnerButtons(playerState, sidPlayer);
    updateFlameButton(playerState, sidPlayer);
    return true;
}


export async function jamToggle(sidPlayer, loadSong, applyTheme, updateVsMatchup, updateRoundInfo, updateWinnerButtons, updateFlameButton, updateBracketDropdown) {
    if (!sidPlayer) return;

    let shouldUpdateBracketDropdown = false;
    let newBracket = null;
    let voteProcessed = false;

    // Get theme for bitmap rendering
    const theme = baseColorSchemes[getCurrentThemeIndex()]; // Added

    if (!window.isLoggedIn && window.showPromptMessage && !window.hasShownPrompt) {
        window.hasShownPrompt = true;
    }

    if (playerState.currentMode === "nowPlaying") {
        if (playerState.isReviveActive) {
            // Reset the song's win-loss record to 0-0
            const sidId = window.sidJamData.pathToId[playerState.nowPlayingSong];
            try {
                const reviveResponse = await fetch(`dbcontrol/revive_song.php?user_id=${window.user.id}&sid_id=${sidId}`);
                if (!reviveResponse.ok) throw new Error(`revive_song.php failed: ${reviveResponse.status}`);
                const reviveData = await reviveResponse.json();
                if (!reviveData.success) throw new Error('Failed to revive song');

                const resultsResponse = await fetch(`dbcontrol/get_results.php?user_id=${window.user.id}`);
                if (!resultsResponse.ok) throw new Error(`get_results.php failed: ${resultsResponse.status}`);
                window.sidJamData.cachedResults = await resultsResponse.json();

                let newBracket = "0 - 0";
                let newContender = null;

                if (getContenderCount("0 - 0") >= 1) {
                    newContender = replaceContenderFromBracket("0 - 0", [playerState.nowPlayingSong]);
                }

                if (!newContender) {
                    newBracket = findFallbackBracket();
                    if (!newBracket) {
                        console.error("No fallback bracket found for Revive. Cannot continue.");
                        return;
                    }
                    newContender = replaceContenderFromBracket(newBracket, [playerState.nowPlayingSong]);
                    if (!newContender) {
                        console.error(`No contenders available in fallback bracket ${newBracket}. Cannot continue.`);
                        return;
                    }
                }

                updatePlayerState({
                    currentMode: "bout",
                    activeBracket: newBracket,
                    peekBracket: newBracket,
                    contenders: [playerState.nowPlayingSong, newContender],
                    isReviveActive: false,
                    nowPlayingSong: null,
                    nowPlayingSongBracket: null,
                    activeContender: 0,
                    roundCount: 1,
                    winner: null,
                    hasJammed: false,
                    bothContendersSelected: false,
                    isFlameActive: false,
                    isUnplayableSID: false
                });

                applyTheme("bout");
                loadSong(playerState.nowPlayingSong, -1);
                updatePlayerState({ hasPlayed: true });
                updateVsMatchup(playerState);
                updateRoundInfo(playerState);
                updateWinnerButtons(playerState, sidPlayer);
                updateFlameButton(playerState, sidPlayer);
                updateBracketDropdown();
                document.getElementById("bracket-select").value = newBracket.replace(' - ', '-');
                renderWinnerButtonBitmap(0, '#000000', '#FFDAB9'); // Added
                renderWinnerButtonBitmap(1, '#000000', '#FFDAB9'); // Added
                voteProcessed = true;
            } catch (error) {
                console.error('Error reviving song:', error);
            }
        } else {
            // Ensure peekBracket is set to activeBracket when returning to Bout Mode
            updatePlayerState({
                currentMode: "bout",
                nowPlayingSong: null,
                nowPlayingSongBracket: null,
                peekBracket: playerState.activeBracket,
                activeBracket: playerState.activeBracket,
                activeContender: 0,
                roundCount: 1,
                winner: null,
                hasJammed: false,
                bothContendersSelected: false,
                isFlameActive: false,
                isUnplayableSID: false
            });
            if (playerState.contenders.length === 2 && 
                playerState.contenders.every(c => window.sidJamData.sidFiles.includes(c)) &&
                getContenderCount(playerState.activeBracket) >= 2) {
                loadSong(playerState.contenders[0], -1);
                updatePlayerState({ hasPlayed: true });
            } else {
                let success = pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
                if (!success) {
                    newBracket = findEligibleBracket();
                    if (newBracket) {
                        updatePlayerState({ peekBracket: newBracket, activeBracket: newBracket, isUnplayableSID: false });
                        shouldUpdateBracketDropdown = true;
                        pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
                    } else {
                        window.logmsg("No eligible brackets, stopping");
                        return;
                    }
                }
            }
            applyTheme("bout");
            updateVsMatchup(playerState);
            updateRoundInfo(playerState);
            updateWinnerButtons(playerState, sidPlayer);
            updateFlameButton(playerState, sidPlayer);
            renderWinnerButtonBitmap(0, '#000000', '#FFDAB9'); // Added
            renderWinnerButtonBitmap(1, '#000000', '#FFDAB9'); // Added
            shouldUpdateBracketDropdown = true;
        }
        if (shouldUpdateBracketDropdown) {
            updateBracketDropdown();
            document.getElementById("bracket-select").value = playerState.peekBracket.replace(' - ', '-');
        }
        return;
    }

    sidPlayer.pause();
    setIsPlaying(false);
    stopTimer();

    if (playerState.isFlameActive && playerState.activeBracket === "0 - 0") {
        let flamedIndex = playerState.activeContender;
        let flamedFile = playerState.contenders[flamedIndex];

        window.logmsg(`Flamed!: ${window.sidJamData.pathToId[flamedFile]}`);
        window.logmsg(`${flamedFile}`);

        let votes = [{ id: window.sidJamData.pathToId[flamedFile], increment: -2 }];
        try {
            const response = await fetch('dbcontrol/log_result.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: window.user.id, votes })
            });
            if (!response.ok) throw new Error(`log_result.php failed: ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error('Failed to log flame result');

            const resultsResponse = await fetch(`dbcontrol/get_results.php?user_id=${window.user.id}`);
            if (!resultsResponse.ok) throw new Error(`get_results.php failed: ${resultsResponse.status}`);
            window.sidJamData.cachedResults = await resultsResponse.json();

            let newContender = replaceContenderFromBracket("0 - 0", playerState.contenders);
            let newBracket = playerState.activeBracket;

            if (!newContender) {
                newBracket = findFallbackBracket();
                if (!newBracket) {
                    console.error("No fallback bracket found for Flame. Cannot continue.");
                    return;
                }
                newContender = replaceContenderFromBracket(newBracket, playerState.contenders);
                if (!newContender) {
                    console.error(`No contenders available in fallback bracket ${newBracket}. Cannot continue.`);
                    return;
                }
                updatePlayerState({ activeBracket: newBracket, peekBracket: newBracket });
                updateBracketDropdown();
                document.getElementById("bracket-select").value = newBracket.replace(' - ', '-');
            }

            console.log(`New contender: ${window.sidJamData.pathToId[newContender]}`);
            console.log(`${newContender}`);

            updatePlayerState({
                contenders: playerState.contenders.map((c, i) => i === flamedIndex ? newContender : c),
                isFlameActive: false,
                isUnplayableSID: false
            });
            loadSong(newContender, -1);
            updatePlayerState({ hasPlayed: true });
            updateVsMatchup(playerState);
            updateRoundInfo(playerState);
            updateWinnerButtons(playerState, sidPlayer);
            updateFlameButton(playerState, sidPlayer);
            renderWinnerButtonBitmap(0, '#000000', '#FFDAB9'); // Added
            renderWinnerButtonBitmap(1, '#000000', '#FFDAB9'); // Added
            voteProcessed = true;
        } catch (error) {
            console.error('Error flaming song:', error);
        }
    } else if (playerState.winner !== null || playerState.bothContendersSelected) {
        try {
            await logResult();
            voteProcessed = true;
            updatePlayerState({
                roundCount: 1,
                winner: null,
                bothContendersSelected: false,
                isUnplayableSID: false
            });
            let success = pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
            if (!success) {
                newBracket = findEligibleBracket();
                if (newBracket) {
                    updatePlayerState({ peekBracket: newBracket, activeBracket: newBracket, isUnplayableSID: false });
                    shouldUpdateBracketDropdown = true;
                    pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
                } else {
                    window.logmsg("No eligible brackets, stopping");
                    return;
                }
            }
            loadSong(playerState.contenders[playerState.activeContender], -1);
            updatePlayerState({ hasPlayed: true });
            updateVsMatchup(playerState);
            updateRoundInfo(playerState);
            updateWinnerButtons(playerState, sidPlayer);
            updateFlameButton(playerState, sidPlayer);
            renderWinnerButtonBitmap(0, '#000000', '#FFDAB9'); // Added
            renderWinnerButtonBitmap(1, '#000000', '#FFDAB9'); // Added
        } catch (error) {
            console.error('Error in jamToggle after logResult:', error);
        }
    } else {
        let oldContender = playerState.activeContender;
        updatePlayerState({ activeContender: playerState.activeContender === 0 ? 1 : 0 });
        if (oldContender === 1 && playerState.activeContender === 0) {
            updatePlayerState({ roundCount: playerState.roundCount + 1 });
            updateRoundInfo(playerState);
        }
        updatePlayerState({ hasJammed: true });
        loadSong(playerState.contenders[playerState.activeContender], -1);
        updatePlayerState({ hasPlayed: true });
        updateVsMatchup(playerState);
        updateRoundInfo(playerState);
        updateWinnerButtons(playerState, sidPlayer);
        updateFlameButton(playerState, sidPlayer);
        renderWinnerButtonBitmap(0, '#000000', '#FFDAB9'); // Added
        renderWinnerButtonBitmap(1, '#000000', '#FFDAB9'); // Added
    }

    if (shouldUpdateBracketDropdown || voteProcessed) {
        updateBracketDropdown();
        if (newBracket) {
            document.getElementById("bracket-select").value = newBracket.replace(' - ', '-');
        } else {
            document.getElementById("bracket-select").value = playerState.peekBracket.replace(' - ', '-');
        }
    }
}

export function updateWinner(contenderIndex, updateRoundInfo, updateWinnerButtons, updateFlameButton) {
    const winnerButton = document.getElementById(`winner${contenderIndex}`);
    if (playerState.winner === null && !playerState.bothContendersSelected) {
        updatePlayerState({ winner: contenderIndex });
    } else if (playerState.winner !== null && playerState.winner !== contenderIndex) {
        updatePlayerState({ bothContendersSelected: true, winner: null });
    } else if (playerState.bothContendersSelected) {
        updatePlayerState({ winner: contenderIndex === 0 ? 1 : 0, bothContendersSelected: false });
    } else {
        updatePlayerState({ winner: null });
    }
    const theme = baseColorSchemes[getCurrentThemeIndex()];
    updateRoundInfo(playerState);
    updateWinnerButtons(playerState, sidPlayer);
    updateFlameButton(playerState, sidPlayer);
    renderWinnerButtonBitmap(0, playerState); // Fixed signature
    renderWinnerButtonBitmap(1, playerState); // Fixed signature
}

export function toggleFlame(updateFlameButton, updateVsMatchup, updateWinnerButtons) {
    updatePlayerState({ isFlameActive: !playerState.isFlameActive, isUnplayableSID: false });
    const theme = baseColorSchemes[getCurrentThemeIndex()]; // Added
    updateFlameButton(playerState, sidPlayer);
    updateVsMatchup(playerState);
    updateWinnerButtons(playerState, sidPlayer);
    updateRoundInfo(playerState);
    renderWinnerButtonBitmap(0, '#000000', '#FFDAB9'); // Added
    renderWinnerButtonBitmap(1, '#000000', '#FFDAB9'); // Added
}

export function toggleRevive(updateReviveButton, updateSongTitleHighlight) {
    updatePlayerState({ isReviveActive: !playerState.isReviveActive });
    updateReviveButton(playerState.isReviveActive);
    updateSongTitleHighlight(playerState.currentMode, playerState.isReviveActive);
}

export function changeBracket(updateFlameButton, loadSong, updateRoundInfo, updateVsMatchup, updateWinnerButtons) {
    let newBracket = document.getElementById("bracket-select").value.replace('-', ' - ');
    if (newBracket === playerState.peekBracket) return;

    if (!isSpecialBracket(playerState.peekBracket)) {
        updatePlayerState({ activeBracket: playerState.peekBracket });
    }
    updatePlayerState({ peekBracket: newBracket });

    if (playerState.currentMode === "nowPlaying") {
        window.logmsg(`Staying in Now Playing mode, updating to ${newBracket}`);
        updateFlameButton(playerState, sidPlayer);
        return;
    }

    const specialBrackets = ["All", "Eliminated"];
    let contenderCount = getContenderCount(newBracket);
    if (specialBrackets.includes(newBracket) || contenderCount === 1) {
        return;
    }

    if (contenderCount < 1) {
        window.logmsg(`No contenders in ${newBracket}, reverting to ${playerState.activeBracket}`);
        updatePlayerState({ peekBracket: playerState.activeBracket });
        updateBracketDropdown();
        return;
    }

    updatePlayerState({
        roundCount: 1,
        winner: null,
        bothContendersSelected: false,
        isFlameActive: false
    });
    let success = pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
    if (!success) {
        window.logmsg(`Failed to pick contenders for ${newBracket}, reverting`);
        updatePlayerState({ peekBracket: playerState.activeBracket });
        updateBracketDropdown();
        return;
    }
    
    updatePlayerState({ activeBracket: newBracket });
    
    const theme = baseColorSchemes[getCurrentThemeIndex()]; // Added
    updateFlameButton(playerState, sidPlayer);
    if (loadSong) loadSong(playerState.contenders[playerState.activeContender], -1);
    renderWinnerButtonBitmap(0, '#000000', '#FFDAB9'); // Added
    renderWinnerButtonBitmap(1, '#000000', '#FFDAB9'); // Added
}


export async function logResult() {
    let votes = [];
    if (playerState.bothContendersSelected) {
        votes.push({ id: window.sidJamData.pathToId[playerState.contenders[0]], increment: 1 });
        votes.push({ id: window.sidJamData.pathToId[playerState.contenders[1]], increment: 1 });
    } else if (playerState.winner !== null) {
        votes.push({ id: window.sidJamData.pathToId[playerState.contenders[playerState.winner]], increment: 1 });
        votes.push({ id: window.sidJamData.pathToId[playerState.contenders[playerState.winner === 0 ? 1 : 0]], increment: -1 });
    }
    
    if (playerState.bothContendersSelected) {
        console.log("Both contenders selected as winners:");
        console.log(`${window.sidJamData.pathToId[playerState.contenders[0]]} ${playerState.contenders[0]}`);
        console.log(`${window.sidJamData.pathToId[playerState.contenders[1]]} ${playerState.contenders[1]}`);
    } else if (playerState.winner !== null) {
        let winnerPath = playerState.contenders[playerState.winner];
        let loserPath = playerState.contenders[1 - playerState.winner];
        let winnerId = window.sidJamData.pathToId[winnerPath];
        let loserId = window.sidJamData.pathToId[loserPath];
        console.log("Bout decided:");
        console.log(`Winner: ${winnerId} ${winnerPath}`);
        console.log(`Loser: ${loserId} ${loserPath}`);
    }
    
    if (votes.length && votes.every(vote => vote.id !== 0)) {
        return fetch('dbcontrol/log_result.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: window.user.id, votes })
        })
        .then(response => {
            window.logmsg(`log_result.php response status: ${response.status}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            window.logmsg(`log_result.php response data: ${JSON.stringify(data)}`);
            if (data.success) return fetch(`dbcontrol/get_results.php?user_id=${window.user.id}`);
            throw new Error('Failed to log result');
        })
        .then(response => {
            if (!response.ok) throw new Error(`get_results.php failed: ${response.status}`);
            return response.json();
        })
        .then(data => {
            window.sidJamData.cachedResults = data;

            let voteCount = parseInt(sessionStorage.getItem('voteCount') || '0', 10);
            voteCount += 1;
            sessionStorage.setItem('voteCount', voteCount.toString());

            if (voteCount === 3 && !window.isLoggedIn) {
                window.showPromptMessage = true;
                window.flashProfileIcon();
                window.logmsg("Prompt triggered: flashing icon and enabling scrolling message");
            }
        })
        .catch(error => {
            console.error('Error logging result:', error);
            throw error;
        });
    }
    return Promise.resolve();
}

export function updateBracketDropdown() {
    let brackets = {};
    let eliminatedCount = 0;
    if (!window.sidJamData.cachedResults || Object.keys(window.sidJamData.cachedResults).length === 0) {
        brackets["0 - 0"] = window.sidJamData.sidFiles.length;
    } else {
        window.sidJamData.sidFiles.forEach(file => {
            let record = window.sidJamData.cachedResults[file] || { wins: 0, losses: 0 };
            if (record.losses >= 2) {
                eliminatedCount++;
            } else {
                let key = `${record.wins} - ${record.losses}`;
                brackets[key] = (brackets[key] || 0) + 1;
            }
        });
    }
    brackets["All"] = window.sidJamData.sidFiles.length;
    brackets["Eliminated"] = eliminatedCount;

    let select = document.getElementById("bracket-select");
    let currentValue = select.value;

    select.innerHTML = "";

    let sortedKeys = Object.keys(brackets).filter(key => key !== "All" && key !== "Eliminated").sort((a, b) => {
        let [aWins, aLosses] = a.split(" - ").map(Number);
        let [bWins, bLosses] = b.split(" - ").map(Number);
        if (aWins !== bWins) return bWins - aWins;
        return aLosses - bLosses;
    });

    sortedKeys.forEach(key => {
        let option = document.createElement("option");
        option.value = key.replace(" - ", "-");
        option.text = `${key} (${brackets[key]} contenders)`;
        select.appendChild(option);
    });

    let allOption = document.createElement("option");
    allOption.value = "All";
    allOption.text = `All (${brackets["All"]} contenders)`;
    select.appendChild(allOption);

    if (eliminatedCount > 0) {
        let eliminatedOption = document.createElement("option");
        eliminatedOption.value = "Eliminated";
        eliminatedOption.text = `Eliminated (${eliminatedCount} contenders)`;
        select.appendChild(eliminatedOption);
    }

    let newValue = playerState.peekBracket.replace(" - ", "-");
    if (!(newValue in Object.fromEntries(sortedKeys.map(key => [key.replace(" - ", "-"), key]).concat([["All", "All"], ["Eliminated", "Eliminated"]]))) || !brackets[playerState.peekBracket]) {
        newValue = sortedKeys[0]?.replace(" - ", "-") || "All";
        updatePlayerState({ peekBracket: sortedKeys[0] || "All" });
    }
    select.value = newValue;
}