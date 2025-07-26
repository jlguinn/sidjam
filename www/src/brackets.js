// brackets.js
import { sidPlayer, isPlaying, stopTimer, setIsPlaying, startTimer, updateTimer } from './player.js'; // Add startTimer, updateTimer
import { applyTheme, updateRoundInfo, getCurrentThemeIndex, updateSongTitleHighlight } from './ui.js';
import { renderWinnerButtonBitmap } from './bitmap.js';
import { renderSpriteAnimation } from './spriteAnimator.js';

// ... (The top part of the file, including SeededRandom and playerState, remains unchanged) ...
const USE_DETERMINISTIC_RANDOM = false;
if (USE_DETERMINISTIC_RANDOM) {
    window.logmsg("Using deterministic draws...", 1);
} else {
    window.logmsg("Using random draws...", 1);
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
    isBombActive: false,
    isReviveActive: false,
    peekBracket: "0 - 0",
    activeBracket: "0 - 0",
    currentMode: "bout",
    nowPlayingSong: null,
    peekPlayingSong: null,
    nowPlayingSongBracket: null,
    isWaveformActive: true,
    isVUActive: true,
    isBarActive: false,
    theme:0,
    nextHint: null, 
    hintTriggeredThisSong: false 
};

export function debug(message) {
    window.logmsg(`[DEBUG] ${message}`, 2);
}

export function getPlayerState() {
    return playerState;
}

export function updatePlayerState(updates) {
    playerState = { ...playerState, ...updates };
}

export function isSpecialBracket(bracket) {
    const specialBrackets = ["All", "Eliminated", "Leaderboard"];
    return specialBrackets.includes(bracket) || getContenderCount(bracket) < 2 || playerState.currentMode !== "bout";
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
    } else if (bracket === "Leaderboard") {
        // Leaderboard counts songs with global wins > 0
        count = window.sidJamData.sidFiles.filter(file => {
            let record = window.sidJamData.pathToRecord[file] || { wins: 0, losses: 0 };
            return record.wins > 0;
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
        window.logmsg("No eligible brackets found", 0);
        return null;
    }

    eligibleBrackets.sort((a, b) => getContenderCount(b) - getContenderCount(a));
    let selectedBracket = eligibleBrackets[0];
    window.logmsg(`Selected bracket: ${selectedBracket} with ${getContenderCount(selectedBracket)} contenders`, 1);
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
        window.logmsg("No non-empty brackets found for fallback", 0);
        return null;
    }

    nonEmptyBrackets.sort((a, b) => {
        const [aWins, aLosses] = a.split(" - ").map(Number);
        const [bWins, bLosses] = b.split(" - ").map(Number);
        if (aWins !== bWins) return aWins - bWins;
        return bLosses - aLosses;
    });

    const selectedBracket = nonEmptyBrackets[0];
    window.logmsg(`Fallback bracket: ${selectedBracket} with ${brackets[selectedBracket]} contenders`, 1);
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
        window.logmsg(`No contenders available in bracket ${bracket}`, 0);
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

export function pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateBombButton) {
    let filteredFiles = [];
    if (playerState.peekBracket === "All") {
        filteredFiles = window.sidJamData.sidFiles;
    } else if (playerState.peekBracket === "Eliminated") {
        filteredFiles = window.sidJamData.sidFiles.filter(file => {
            let record = window.sidJamData.cachedResults[file] || { wins: 0, losses: 0 };
            return record.losses >= 2;
        });
    } else if (playerState.peekBracket === "Leaderboard") {
        filteredFiles = window.sidJamData.sidFiles.filter(file => {
            let record = window.sidJamData.pathToRecord[file] || { wins: 0, losses: 0 };
            return record.wins > 0;
        });
    } else {
        let [wins, losses] = playerState.peekBracket.split(' - ').map(Number);
        filteredFiles = window.sidJamData.sidFiles.filter(file => {
            let record = window.sidJamData.cachedResults[file] || { wins: 0, losses: 0 };
            return record.wins === wins && record.losses === losses;
        });
    }

    if (filteredFiles.length < 2) {
        updatePlayerState({ peekBracket: playerState.activeBracket });
        updateBracketDropdown();
        return false;
    }

    let shuffled = shuffleArray([...filteredFiles]);
    let selectedContenders = shuffled.slice(0, 2);
    updatePlayerState({
        contenders: selectedContenders,
        hasJammed: false,
        bothContendersSelected: false,
        isBombActive: false,
        activeContender: 0
    });

    window.logmsg(`Bracket: ${playerState.peekBracket} (${filteredFiles.length} contenders)`);
    window.logmsg(`${window.sidJamData.pathToId[playerState.contenders[0]]} ${playerState.contenders[0]}`);
    window.logmsg("- vs -");
    window.logmsg(`${window.sidJamData.pathToId[playerState.contenders[1]]} ${playerState.contenders[1]}`);

    updateRoundInfo(playerState);
    updateVsMatchup(playerState);
    updateWinnerButtons(playerState, sidPlayer);
    updateBombButton(playerState, sidPlayer);
    return true;
}

export async function jamToggle(sidPlayer, loadSong, applyTheme, updateVsMatchup, updateRoundInfo, updateWinnerButtons, updateBombButton, updateBracketDropdown, onTickCallback) {
    if (!sidPlayer) return;

    let shouldUpdateBracketDropdown = false;
    let newBracket = null;
    let voteProcessed = false;

    if (isSpecialBracket(playerState.peekBracket)) {
        updatePlayerState({ peekBracket: playerState.activeBracket });
        shouldUpdateBracketDropdown = true;
    }

    if (!window.isLoggedIn && window.showPromptMessage && !window.hasShownPrompt) {
        window.hasShownPrompt = true;
    }

    if (playerState.currentMode === "nowPlaying") {
        if (playerState.isReviveActive) {
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
                        window.logmsg("No fallback bracket found for Revive. Cannot continue.", 0);
                        return;
                    }
                    newContender = replaceContenderFromBracket(newBracket, [playerState.nowPlayingSong]);
                    if (!newContender) {
                        window.logmsg(`No contenders available in fallback bracket ${newBracket}. Cannot continue.`, 0);
                        return;
                    }
                }
                const songToLoadAfterRevive = playerState.nowPlayingSong;

                updatePlayerState({
                    currentMode: "bout",
                    activeBracket: newBracket,
                    peekBracket: newBracket,
                    contenders: [songToLoadAfterRevive, newContender], // Use the variable here
                    isReviveActive: false,
                    nowPlayingSong: null, // This is now safe to clear
                    nowPlayingSongBracket: null,
                    activeContender: 0,
                    roundCount: 1,
                    winner: null,
                    hasJammed: false,
                    bothContendersSelected: false,
                    isBombActive: false
                });

                applyTheme("bout");
                loadSong(songToLoadAfterRevive, -1, true);
                updatePlayerState({ hasPlayed: true });
                updateVsMatchup(playerState);
                updateRoundInfo(playerState);
                updateWinnerButtons(playerState, sidPlayer);
                updateBombButton(playerState, sidPlayer);
                updateSongTitleHighlight(playerState.currentMode, playerState.isReviveActive);
                updateBracketDropdown();
                const bracketSelect = document.getElementById("bracket-select");
                if (bracketSelect) {
                    bracketSelect.value = newBracket.replace(' - ', '-');
                }
                renderWinnerButtonBitmap(0, playerState);
                renderWinnerButtonBitmap(1, playerState);
                voteProcessed = true;
            } catch (error) {
                window.logmsg(`jamToggle: Error reviving song: ${error.message}`, 0);
            }
        } else {
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
                isBombActive: false
            });
            if (playerState.contenders.length === 2 && 
                playerState.contenders.every(c => window.sidJamData.sidFiles.includes(c)) &&
                getContenderCount(playerState.activeBracket) >= 2) {
                loadSong(playerState.contenders[0], -1, true);
                updatePlayerState({ hasPlayed: true });
            } else {
                let success = pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateBombButton);
                if (!success) {
                    newBracket = findEligibleBracket();
                    if (newBracket) {
                        updatePlayerState({ peekBracket: newBracket, activeBracket: newBracket });
                        shouldUpdateBracketDropdown = true;
                        pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateBombButton);
                    } else {
                        window.logmsg("No eligible brackets, stopping", 0);
                        return;
                    }
                }
            }
            applyTheme("bout");
            updateVsMatchup(playerState);
            updateRoundInfo(playerState);
            updateWinnerButtons(playerState, sidPlayer);
            updateBombButton(playerState, sidPlayer);
            renderWinnerButtonBitmap(0, playerState);
            renderWinnerButtonBitmap(1, playerState);
            shouldUpdateBracketDropdown = true;
        }
        if (shouldUpdateBracketDropdown) {
            updateBracketDropdown();
            const bracketSelect = document.getElementById("bracket-select");
            if (bracketSelect) {
                bracketSelect.value = playerState.peekBracket.replace(' - ', '-');
            }
        }
        return;
    }

    if (!playerState.isBombActive) {
        sidPlayer.pause();
        setIsPlaying(false);
        stopTimer();
    }

    if (playerState.isBombActive && playerState.activeBracket === "0 - 0") {
        // Disable jAM and other buttons to prevent interaction during boom
        document.getElementById('jamButton').disabled = true;
        document.getElementById('prevButton').disabled = true;
        document.getElementById('nextButton').disabled = true;
        const winnerLeft = document.getElementById('winner-left');
        const winnerRight = document.getElementById('winner-right');
        winnerLeft.disabled = true;
        winnerRight.disabled = true;
        winnerLeft.classList.add('disabled');
        winnerRight.classList.add('disabled');

        // Trigger boom animation with sound
        const bombButton = document.getElementById("bombButton");
        bombButton.style.pointerEvents = 'none';
        renderSpriteAnimation(bombButton, "boom", true, async () => {
            // onComplete: Stop old music, then process bomb
            if (sidPlayer) {
                sidPlayer.pause();
                setIsPlaying(false);
                stopTimer();
            }

            let bombdIndex = playerState.activeContender;
            let bombdFile = playerState.contenders[bombdIndex];

            window.logmsg(`Bombd!: ${window.sidJamData.pathToId[bombdFile]}`, 0);
            window.logmsg(`${bombdFile}`, 0);

            let votes = [{ id: window.sidJamData.pathToId[bombdFile], increment: -2 }];
            try {
                // Log bomb result (2 losses)
                const response = await fetch('dbcontrol/log_result.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: window.user.id, votes })
                });
                if (!response.ok) throw new Error(`log_result.php failed: ${response.status}`);
                const data = await response.json();
                if (!data.success) throw new Error('Failed to log bomb result');

                // Refresh cachedResults
                const resultsResponse = await fetch(`dbcontrol/get_results.php?user_id=${window.user.id}`);
                if (!resultsResponse.ok) throw new Error(`get_results.php failed: ${resultsResponse.status}`);
                window.sidJamData.cachedResults = await resultsResponse.json();

                // Get new contender
                let newContender = replaceContenderFromBracket("0 - 0", playerState.contenders);
                let newBracket = playerState.activeBracket;

                if (!newContender) {
                    newBracket = findFallbackBracket();
                    if (!newBracket) {
                        window.logmsg("No fallback bracket found for Bomb. Cannot continue.", 0);
                        return;
                    }
                    newContender = replaceContenderFromBracket(newBracket, playerState.contenders);
                    if (!newContender) {
                        window.logmsg(`No contenders available in fallback bracket ${newBracket}. Cannot continue.`, 0);
                        return;
                    }
                    updatePlayerState({ activeBracket: newBracket, peekBracket: newBracket });
                    shouldUpdateBracketDropdown = true;
                }

                window.logmsg(`New contender: ${window.sidJamData.pathToId[newContender]}`, 0);
                window.logmsg(`${newContender}`, 0);

                // Update playerState with new contender
                updatePlayerState({
                    contenders: playerState.contenders.map((c, i) => i === bombdIndex ? newContender : c),
                    isBombActive: false,
                    hasPlayed: true,
                    hasJammed: true // Ensure winner buttons enable after bomb
                });

                // Persist playerState to database
                try {
                    const stateResponse = await fetch('dbcontrol/save_state.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: window.user.id, player_state: playerState })
                    });
                    if (!stateResponse.ok) throw new Error(`save_state.php failed: ${stateResponse.status}`);
                    const stateData = await stateResponse.json();
                    if (!stateData.success) throw new Error('Failed to persist player state');
                } catch (error) {
                    window.logmsg(`jamToggle: Error persisting player state: ${error.message}`, 0);
                }

                // Load new contender
                await loadSong(newContender, -1, false);

                // Play new contender
                sidPlayer.play();
                setIsPlaying(true);
                if (startTimer) {
                    const updateJamButton = window.updateJamButtonBound || (() => window.logmsg('Warning: updateJamButton is not defined', 0));
                    startTimer(updateTimer, updateJamButton, onTickCallback);
                } else {
                    window.logmsg('Warning: startTimer is not defined, skipping timer', 0);
                }

                // Update UI
                updateVsMatchup(playerState);
                updateRoundInfo(playerState);
                updateBombButton(playerState, sidPlayer);
                updateBracketDropdown(); // Ensure dropdown reflects new contender and losses
                renderWinnerButtonBitmap(0, playerState);
                renderWinnerButtonBitmap(1, playerState);
                bombButton.style.pointerEvents = 'auto';

                // Re-enable buttons
                document.getElementById('jamButton').disabled = false;
                document.getElementById('prevButton').disabled = false;
                document.getElementById('nextButton').disabled = false;
                updateWinnerButtons(playerState, sidPlayer);

                voteProcessed = true;
            } catch (error) {
                window.logmsg(`jamToggle: Error bombing song: ${error.message}`, 0);
                bombButton.style.pointerEvents = 'auto';
                document.getElementById('jamButton').disabled = false;
                document.getElementById('prevButton').disabled = false;
                document.getElementById('nextButton').disabled = false;
                updateWinnerButtons(playerState, sidPlayer);
            }
        });

        // Update bracket dropdown immediately to reflect bombed song's losses
        updateBracketDropdown();
        const bracketSelect = document.getElementById("bracket-select");
        if (bracketSelect) {
            bracketSelect.value = playerState.peekBracket.replace(' - ', '-');
        }

        return;
    } else if (playerState.winner !== null || playerState.bothContendersSelected) {
        try {
            await logResult();
            voteProcessed = true;
            updatePlayerState({
                roundCount: 1,
                winner: null,
                bothContendersSelected: false
            });
            let success = pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateBombButton);
            if (!success) {
                newBracket = findEligibleBracket();
                if (newBracket) {
                    updatePlayerState({ peekBracket: newBracket, activeBracket: newBracket });
                    shouldUpdateBracketDropdown = true;
                    pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateBombButton);
                } else {
                    window.logmsg("No eligible brackets, stopping", 0);
                    return;
                }
            }
            await loadSong(playerState.contenders[playerState.activeContender], -1, true);
            updatePlayerState({ hasPlayed: true });
            updateVsMatchup(playerState);
            updateRoundInfo(playerState);
            updateWinnerButtons(playerState, sidPlayer);
            updateBombButton(playerState, sidPlayer);
            renderWinnerButtonBitmap(0, playerState);
            renderWinnerButtonBitmap(1, playerState);
        } catch (error) {
            window.logmsg(`jamToggle: Error after logResult: ${error.message}`, 0);
        }
    } else {
        let oldContender = playerState.activeContender;
        updatePlayerState({ activeContender: playerState.activeContender === 0 ? 1 : 0 });
        if (oldContender === 1 && playerState.activeContender === 0) {
            updatePlayerState({ roundCount: playerState.roundCount + 1 });
            updateRoundInfo(playerState);
        }
        updatePlayerState({ hasJammed: true });
        loadSong(playerState.contenders[playerState.activeContender], -1, true);
        updatePlayerState({ hasPlayed: true });
        updateVsMatchup(playerState);
        updateRoundInfo(playerState);
        updateWinnerButtons(playerState, sidPlayer);
        updateBombButton(playerState, sidPlayer);
        renderWinnerButtonBitmap(0, playerState);
        renderWinnerButtonBitmap(1, playerState);
    }

    if (shouldUpdateBracketDropdown || voteProcessed) {
        updateBracketDropdown();
        const bracketSelect = document.getElementById("bracket-select");
        if (bracketSelect) {
            if (newBracket) {
                bracketSelect.value = newBracket.replace(' - ', '-');
            } else {
                bracketSelect.value = playerState.peekBracket.replace(' - ', '-');
            }
        }
    }
}

export function updateWinner(contenderIndex, updateRoundInfo, updateWinnerButtons, updateBombButton) {
    const isZeroZeroBracket = playerState.activeBracket === "0 - 0";

    if (playerState.winner === null && !playerState.bothContendersSelected) {
        updatePlayerState({ winner: contenderIndex });
    } else if (playerState.winner !== null && playerState.winner !== contenderIndex) {
        if (isZeroZeroBracket) {
            updatePlayerState({ bothContendersSelected: true, winner: null });
        } else {
            updatePlayerState({ winner: contenderIndex });
            window.logmsg(`Switched winner to contender ${contenderIndex} in ${playerState.activeBracket} bracket`, 1);
        }
    } else if (playerState.bothContendersSelected && isZeroZeroBracket) {
        const otherContender = contenderIndex === 0 ? 1 : 0;
        updatePlayerState({ winner: otherContender, bothContendersSelected: false });
        window.logmsg(`Toggled off contender ${contenderIndex}, set contender ${otherContender} as winner in 0-0 bracket`, 1);
    } else {
        updatePlayerState({ winner: null });
    }

    updateRoundInfo(playerState);
    updateWinnerButtons(playerState, sidPlayer);
    updateBombButton(playerState, sidPlayer);
}

export function toggleBomb(updateBombButton, updateVsMatchup, updateWinnerButtons) {
    updatePlayerState({ isBombActive: !playerState.isBombActive });
    updateBombButton(playerState, sidPlayer);
    updateVsMatchup(playerState);
    updateWinnerButtons(playerState, sidPlayer);
    updateRoundInfo(playerState);
    renderWinnerButtonBitmap(0, playerState);
    renderWinnerButtonBitmap(1, playerState);
}

export function toggleRevive(updateReviveButton, updateSongTitleHighlight) {
    updatePlayerState({ isReviveActive: !playerState.isReviveActive });
    updateReviveButton(playerState.isReviveActive);
    updateSongTitleHighlight(playerState.currentMode, playerState.isReviveActive);
}

export function changeBracket(updateBombButton, loadSong, updateRoundInfo, updateVsMatchup, updateWinnerButtons) {
    const bracketSelect = document.getElementById("bracket-select");
    if (!bracketSelect) {
        return;
    }
    let newBracket = bracketSelect.value.replace('-', ' - ');
    if (newBracket === playerState.peekBracket) return;

    if (isSpecialBracket(newBracket)) {
        updatePlayerState({ peekBracket: newBracket });
        updateBombButton(playerState, sidPlayer);
        updateVsMatchup(playerState);
        updateRoundInfo(playerState);
        updateWinnerButtons(playerState, sidPlayer);
        return;
    }

    if (newBracket === playerState.activeBracket) {
        updatePlayerState({ peekBracket: newBracket });
        updateBombButton(playerState, sidPlayer);
        updateVsMatchup(playerState);
        updateRoundInfo(playerState);
        updateWinnerButtons(playerState, sidPlayer);
        return;
    }

    updatePlayerState({ activeBracket: newBracket, peekBracket: newBracket });

    const contenderCount = getContenderCount(newBracket);
    if (contenderCount < 2) {
        window.logmsg(`Not enough contenders in ${newBracket}, reverting to ${playerState.activeBracket}`, 0);
        updatePlayerState({ peekBracket: playerState.activeBracket });
        updateBracketDropdown();
        return;
    }

    updatePlayerState({
        roundCount: 1,
        winner: null,
        bothContendersSelected: false,
        isBombActive: false
    });
    let success = pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateBombButton);
    if (!success) {
        window.logmsg(`Failed to pick contenders for ${newBracket}, reverting`, 0);
        updatePlayerState({ peekBracket: playerState.activeBracket });
        updateBracketDropdown();
        return;
    }

    updateBombButton(playerState, sidPlayer);
    if (loadSong) loadSong(playerState.contenders[playerState.activeContender], -1, true); // UPDATED CALL
    renderWinnerButtonBitmap(0, playerState);
    renderWinnerButtonBitmap(1, playerState);
}

// ... (logResult and updateBracketDropdown remain unchanged) ...
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
        window.logmsg("Both contenders selected as winners:");
        window.logmsg(`${window.sidJamData.pathToId[playerState.contenders[0]]} ${playerState.contenders[0]}`);
        window.logmsg(`${window.sidJamData.pathToId[playerState.contenders[1]]} ${playerState.contenders[1]}`);
    } else if (playerState.winner !== null) {
        let winnerPath = playerState.contenders[playerState.winner];
        let loserPath = playerState.contenders[1 - playerState.winner];
        let winnerId = window.sidJamData.pathToId[winnerPath];
        let loserId = window.sidJamData.pathToId[loserPath];
        window.logmsg("Bout decided:");
        window.logmsg(`Winner: ${winnerId} ${winnerPath}`);
        window.logmsg(`Loser: ${loserId} ${loserPath}`);
    }
    
    if (votes.length && votes.every(vote => vote.id !== 0)) {
        return fetch('dbcontrol/log_result.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: window.user.id, votes })
        })
        .then(response => {
            window.logmsg(`log_result.php response status: ${response.status}`, 2);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            window.logmsg(`log_result.php response data: ${JSON.stringify(data)}`, 2);
            if (data.success) return fetch(`dbcontrol/get_results.php?user_id=${window.user.id}`);
            throw new Error('Failed to log result');
        })
        .then(response => {
            if (!response.ok) throw new Error(`get_results.php failed: ${response.status}`);
            return response.json();
        })
        .then(data => {
            window.sidJamData.cachedResults = data;

            let voteCount = 0;
            try {
                voteCount = parseInt(sessionStorage.getItem('voteCount') || '0', 10);
                voteCount += 1;
                sessionStorage.setItem('voteCount', voteCount.toString());
            } catch (error) {
                window.logmsg(`logResult: Error accessing sessionStorage: ${error.message}`, 0);
                voteCount += 1;
            }
        })
        .catch(error => {
            window.logmsg(`logResult: Error logging result: ${error.message}`, 0);
            throw error;
        });
    }
    return Promise.resolve();
}

export function updateBracketDropdown() {
    const select = document.getElementById("bracket-select");
    if (!select) {
        return;
    }
    let brackets = {};
    let eliminatedCount = 0;
    let leaderboardCount = 0;
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
            let globalRecord = window.sidJamData.pathToRecord[file] || { wins: 0, losses: 0 };
            if (globalRecord.wins > 0) {
                leaderboardCount++;
            }
        });
    }
    brackets["All"] = window.sidJamData.sidFiles.length;
    brackets["Eliminated"] = eliminatedCount;
    brackets["Leaderboard"] = leaderboardCount;

    let currentValue = select.value;

    select.innerHTML = "";

    let leaderboardOption = document.createElement("option");
    leaderboardOption.value = "Leaderboard";
    leaderboardOption.text = "Leaderboard (All Users)";
    select.appendChild(leaderboardOption);

    let sortedKeys = Object.keys(brackets).filter(key => key !== "All" && key !== "Eliminated" && key !== "Leaderboard").sort((a, b) => {
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
    const bracketOptions = Object.fromEntries(
        sortedKeys.map(key => [key.replace(" - ", "-"), key]).concat([["All", "All"], ["Eliminated", "Eliminated"], ["Leaderboard", "Leaderboard"]])
    );
    if (!(newValue in bracketOptions) || !brackets[playerState.peekBracket]) {
        newValue = sortedKeys[0]?.replace(" - ", "-") || "All";
        updatePlayerState({ peekBracket: sortedKeys[0] || "All" });
    }
    select.value = newValue;
}