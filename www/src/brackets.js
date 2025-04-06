import { sidPlayer, isPlaying, stopTimer, setIsPlaying } from './player.js';
import { applyBoutTheme, applyNowPlayingTheme } from './ui.js'; // Import specific functions

/* Deterministic psuedo random number generator for testing */
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

  const seededRandom = new SeededRandom(7473646); // Fixed seed for reproducibility

// debug("brackets.js module loaded");

export let contenders = [];
export let activeContender = 0;
export let roundCount = 1;
export let winner = null;
export let hasPlayed = false;
export let hasJammed = false;
export let bothContendersSelected = false;
export let isFlameActive = false;
export let isReviveActive = false;
export let currentBracket = "0 - 0";
export let previousBracket = "0 - 0";
export let currentMode = "bout";
export let nowPlayingSong = null;
export let boutState = {};

export function debug(message) { console.log(`[DEBUG] ${message}`); }

export function setHasPlayed(value) { hasPlayed = value; }
export function setBoutState(newState) { boutState = newState; }
export function setCurrentMode(value) { currentMode = value; }
export function setContenders(value) { contenders = value; }
export function setActiveContender(value) { activeContender = value; }
export function setRoundCount(value) { roundCount = value; }
export function setWinner(value) { winner = value; }
export function setHasJammed(value) { hasJammed = value; }
export function setBothContendersSelected(value) { bothContendersSelected = value; }
export function setIsFlameActive(value) { isFlameActive = value; }
export function setIsReviveActive(value) { isReviveActive = value; }
export function setCurrentBracket(value) { currentBracket = value; }
export function setPreviousBracket(value) { previousBracket = value; }
export function setNowPlayingSong(value) { nowPlayingSong = value; }

export function getContenderCount(bracket) {
    let count;
    if (bracket === "All") {
        count = window.sidJamData.sidFiles.length;
    } else if (bracket === "Eliminated Contenders") {
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
    // debug(`getContenderCount for ${bracket}: ${count}`);
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
        debug("No eligible brackets found");
        return null;
    }

    eligibleBrackets.sort((a, b) => getContenderCount(b) - getContenderCount(a));
    let selectedBracket = eligibleBrackets[0];
    // debug(`Selected bracket: ${selectedBracket} with ${getContenderCount(selectedBracket)} contenders`);
    return selectedBracket;
}

// Helper function to shuffle an array using SeededRandom
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = seededRandom.randint(0, i); // Use randint for integer indices
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
export function pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton) {
    let filteredFiles = [];
    // Filter files based on the current bracket (e.g., "All", "Eliminated Contenders", or "Wins - Losses")
    if (currentBracket === "All") {
      filteredFiles = window.sidJamData.sidFiles;
    } else if (currentBracket === "Eliminated Contenders") {
      filteredFiles = window.sidJamData.sidFiles.filter(file => {
        let record = window.sidJamData.cachedResults[file] || { wins: 0, losses: 0 };
        return record.losses >= 2;
      });
    } else {
      let [wins, losses] = currentBracket.split(' - ').map(Number);
      filteredFiles = window.sidJamData.sidFiles.filter(file => {
        let record = window.sidJamData.cachedResults[file] || { wins: 0, losses: 0 };
        return record.wins === wins && record.losses === losses;
      });
    }
  
    if (filteredFiles.length < 2) {
      setCurrentBracket(previousBracket);
      updateBracketDropdown();
      return false;
    }
  
    // Shuffle and pick contenders with seeded randomness
    let shuffled = shuffleArray([...filteredFiles]); // Clone array to avoid modifying original
    let selectedContenders = shuffled.slice(0, 2);
    setContenders(selectedContenders);
  
    // Adding logging for the selected bout
    console.log(`Bracket: ${currentBracket} (${filteredFiles.length} contenders)`);
    console.log(`${window.sidJamData.pathToId[contenders[0]]} ${contenders[0]}`);
    console.log("- vs -");
    console.log(`${window.sidJamData.pathToId[contenders[1]]} ${contenders[1]}`);

    // Update UI with selected contenders
    let song0 = selectedContenders[0].split('/').pop();
    let song1 = selectedContenders[1]?.split('/').pop() || "-";
    document.getElementById("song1").innerHTML = `<span>${song0}</span>`;
    document.getElementById("song2").innerHTML = `<span>${song1}</span>`;
  
    // Reset state for new matchup
    setHasJammed(false);
    setBothContendersSelected(false);
    setIsFlameActive(false);
    setActiveContender(0);
    updateRoundInfo();
    updateVsMatchup();
    updateWinnerButtons();
    updateFlameButton();
    return true;
  }

  
export async function jamToggle(sidPlayer, loadSong, applyTheme, updateVsMatchup, updateRoundInfo, updateWinnerButtons, updateFlameButton, updateBracketDropdown) {
    // debug("Jamming...");
    if (!sidPlayer) return;

    let shouldUpdateBracketDropdown = false;
    let newBracket = null;
    let voteProcessed = false;

    // Set the prompt flag to true on the first jAM click *after* the scrolling message has been shown
    if (!window.isLoggedIn && window.showPromptMessage && !window.hasShownPrompt) {
        window.hasShownPrompt = true;
        // debug("Prompt flag set to true after first jAM click following the scrolling message");
    }

    if (currentMode === "nowPlaying") {
        let revivedToZeroZero = false;
        if (isReviveActive) {
            if (getContenderCount("0 - 0") >= 2) {
                setCurrentMode("bout");
                setCurrentBracket("0 - 0");
                setContenders([nowPlayingSong]);
                let availableSongs = window.sidJamData.sidFiles.filter(song => song !== nowPlayingSong && (window.sidJamData.cachedResults[song] || { wins: 0, losses: 0 }).wins === 0 && (window.sidJamData.cachedResults[song] || { wins: 0, losses: 0 }).losses === 0);
                if (availableSongs.length > 0) {
                    contenders[1] = availableSongs[Math.floor(Math.random() * availableSongs.length)];
                    // debug(`Revived ${nowPlayingSong} paired with ${contenders[1]}`);
                    revivedToZeroZero = true;
                }
            }
            setIsReviveActive(false);
        }

        setCurrentMode("bout");
        setNowPlayingSong(null);
        if (!revivedToZeroZero) {
            setContenders(boutState.contenders);
            setActiveContender(boutState.activeContender);
            setRoundCount(boutState.roundCount);
            setWinner(boutState.winner);
            setHasJammed(boutState.hasJammed);
            setBothContendersSelected(boutState.bothContendersSelected);
            setIsFlameActive(boutState.isFlameActive);
            let success = pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
            if (!success) {
                newBracket = findEligibleBracket();
                if (newBracket) {
                    setPreviousBracket(currentBracket);
                    setCurrentBracket(newBracket);
                    shouldUpdateBracketDropdown = true;
                    pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
                } else {
                    debug("No eligible brackets, stopping");
                    return;
                }
            }
        } else {
            setActiveContender(0);
            setRoundCount(1);
            setWinner(null);
            setHasJammed(false);
            setBothContendersSelected(false);
            setIsFlameActive(false);
            if (!contenders[1]) {
                newBracket = findEligibleBracket();
                if (newBracket) {
                    setPreviousBracket(currentBracket);
                    setCurrentBracket(newBracket);
                    shouldUpdateBracketDropdown = true;
                    pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
                } else {
                    debug("No eligible brackets, stopping");
                    return;
                }
            }
        }
        setBoutState({});
        loadSong(contenders[activeContender], -1);
        applyTheme(boutColorSchemes[ui.boutSchemeIndex]);
        updateVsMatchup();
        updateRoundInfo();
        updateWinnerButtons();
        updateFlameButton();
        updateBracketDropdown();
        document.getElementById("bracket-select").value = currentBracket.replace(' - ', '-');
        return;
    }

    // Treat 1-contender brackets like special brackets ("All" and "Eliminated Contenders")
    const specialBrackets = ["All", "Eliminated Contenders"];
    let contenderCount = getContenderCount(currentBracket);
    if (specialBrackets.includes(currentBracket) || contenderCount === 1) {
        // debug(`Special or 1-contender bracket ${currentBracket}, reverting to ${previousBracket}`);
        setCurrentBracket(previousBracket);
        shouldUpdateBracketDropdown = true;
    }

    sidPlayer.pause();
    setIsPlaying(false);
    stopTimer();

    if (isFlameActive && currentBracket === "0 - 0") {
        let flamedIndex = activeContender;
        let flamedFile = contenders[flamedIndex];
        let votes = [{ id: window.sidJamData.pathToId[flamedFile], increment: -2 }];
        try {
            await fetch('dbcontrol/log_result.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: window.user.id, votes })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) return fetch(`dbcontrol/get_results.php?user_id=${window.user.id}`);
            })
            .then(response => response.json())
            .then(data => {
                window.sidJamData.cachedResults = data;
                // debug(`Flamed: ${flamedFile} now at 0-2`);

                let availableSongs = window.sidJamData.sidFiles.filter(song => !contenders.includes(song));
                if (availableSongs.length === 0) {
                    debug("No songs to replace flamed song");
                    contenders[flamedIndex] = null;
                } else {
                    let newSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];
                    contenders[flamedIndex] = newSong;
                    loadSong(newSong, -1);
                }
                setIsFlameActive(false);
                updateVsMatchup();
                updateFlameButton();
                updateWinnerButtons();
                voteProcessed = true;
            });
        } catch (error) {
            console.error('Error flaming song:', error);
        }
    } else if (winner !== null || bothContendersSelected) {
        try {
            await logResult();
            voteProcessed = true;
            setRoundCount(1);
            setWinner(null);
            setBothContendersSelected(false);
            let success = pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
            if (!success) {
                newBracket = findEligibleBracket();
                if (newBracket) {
                    setPreviousBracket(currentBracket);
                    setCurrentBracket(newBracket);
                    shouldUpdateBracketDropdown = true;
                    pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
                } else {
                    debug("No eligible brackets, stopping");
                    return;
                }
            }
            loadSong(contenders[activeContender], -1);
            updateVsMatchup();
            updateRoundInfo();
            updateWinnerButtons();
            updateFlameButton();
        } catch (error) {
            console.error('Error in jamToggle after logResult:', error);
        }
    } else {
        let oldContender = activeContender;
        setActiveContender(activeContender === 0 ? 1 : 0);
        if (oldContender === 1 && activeContender === 0) {
            setRoundCount(roundCount + 1);
            updateRoundInfo();
        }
        setHasJammed(true);
        loadSong(contenders[activeContender], -1);
        updateVsMatchup();
        updateWinnerButtons();
        updateFlameButton();
    }

    if (shouldUpdateBracketDropdown || voteProcessed) {
        updateBracketDropdown();
        if (newBracket) {
            document.getElementById("bracket-select").value = newBracket.replace(' - ', '-');
        } else {
            document.getElementById("bracket-select").value = currentBracket.replace(' - ', '-');
        }
    }
}

export function updateWinner(contenderIndex, updateRoundInfo, updateWinnerButtons, updateFlameButton) {
    if (winner === null && !bothContendersSelected) {
        setWinner(contenderIndex);
    } else if (winner !== null && winner !== contenderIndex) {
        setBothContendersSelected(true);
        setWinner(null);
    } else if (bothContendersSelected) {
        setWinner(contenderIndex === 0 ? 1 : 0);
        setBothContendersSelected(false);
    } else {
        setWinner(null);
    }
    updateRoundInfo();
    updateWinnerButtons();
    updateFlameButton();
}

export function toggleFlame(updateFlameButton, updateVsMatchup, updateWinnerButtons) {
    // debug("Toggling flame");
    setIsFlameActive(!isFlameActive);
    updateFlameButton();
    updateVsMatchup();
    updateWinnerButtons();
}

export function toggleRevive(updateReviveButton, updateSongTitleHighlight) {
    // debug("Toggling revive");
    setIsReviveActive(!isReviveActive);
    if (isReviveActive && nowPlayingSong && window.sidJamData.pathToId[nowPlayingSong]) {
        fetch('dbcontrol/reset_result.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: window.sidJamData.pathToId[nowPlayingSong] })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) return fetch('dbcontrol/get_results.php');
        })
        .then(response => response.json())
        .then(data => {
            window.sidJamData.cachedResults = data;
            updateReviveButton();
            updateSongTitleHighlight();
        })
        .catch(error => console.error('Error resetting result:', error));
    } else {
        debug('Skipping revive: pathToId or nowPlayingSong not ready');
    }
}

export function changeBracket(updateFlameButton, loadSong, updateRoundInfo, updateVsMatchup, updateWinnerButtons) {
    let newBracket = document.getElementById("bracket-select").value.replace('-', ' - ');
    if (newBracket === currentBracket) return;

    setPreviousBracket(currentBracket);
    setCurrentBracket(newBracket);

    if (currentMode === "nowPlaying") {
        debug(`Staying in Now Playing mode, updating to ${newBracket}`);
        updateFlameButton();
        return;
    }

    // Treat 1-contender brackets like special brackets ("All" and "Eliminated Contenders")
    const specialBrackets = ["All", "Eliminated Contenders"];
    let contenderCount = getContenderCount(newBracket);
    // debug(`New bracket ${newBracket} has ${contenderCount} contenders`);
    if (specialBrackets.includes(newBracket) || contenderCount === 1) {
        // debug(`Special or 1-contender bracket ${newBracket}, keeping bout`);
        return;
    }

    if (contenderCount < 1) { // Only revert if the bracket has 0 contenders
        debug(`No contenders in ${newBracket}, reverting to ${previousBracket}`);
        setCurrentBracket(previousBracket);
        updateBracketDropdown();
        return;
    }

    setRoundCount(1);
    setWinner(null);
    setBothContendersSelected(false);
    setIsFlameActive(false);
    let success = pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
    if (!success) {
        debug(`Failed to pick contenders for ${newBracket}, reverting`);
        setCurrentBracket(previousBracket);
        updateBracketDropdown();
        return;
    }
    updateFlameButton();
    if (loadSong) loadSong(contenders[activeContender], -1);
}

export async function logResult() {
    let votes = [];
    if (bothContendersSelected) {
        votes.push({ id: window.sidJamData.pathToId[contenders[0]], increment: 1 });
        votes.push({ id: window.sidJamData.pathToId[contenders[1]], increment: 1 });
    } else if (winner !== null) {
        votes.push({ id: window.sidJamData.pathToId[contenders[winner]], increment: 1 });
        votes.push({ id: window.sidJamData.pathToId[contenders[winner === 0 ? 1 : 0]], increment: -1 });
    }
    
    // Add logging for bout decision
    if (bothContendersSelected) {
        console.log("Both contenders selected as winners:");
        console.log(`${window.sidJamData.pathToId[contenders[0]]} ${contenders[0]}`);
        console.log(`${window.sidJamData.pathToId[contenders[1]]} ${contenders[1]}`);
    } else if (winner !== null) {
        let winnerPath = contenders[winner];
        let loserPath = contenders[1 - winner]; // Simpler way to get the loser index
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
            // debug(`log_result.php response status: ${response.status}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            // debug(`log_result.php response data: ${JSON.stringify(data)}`);
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

            // Trigger the new prompt behavior after the third vote for guest users
            if (voteCount === 3 && !window.isLoggedIn) {
                window.showPromptMessage = true; // Start showing the scrolling message
                window.flashProfileIcon(); // Flash the profile icon
                // debug("Prompt triggered: flashing icon and enabling scrolling message");
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
    // debug("Updating bracket dropdown...");
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
    brackets["Eliminated Contenders"] = eliminatedCount;

    let select = document.getElementById("bracket-select");
    let currentValue = select.value;

    select.innerHTML = "";

    let sortedKeys = Object.keys(brackets).filter(key => key !== "All" && key !== "Eliminated Contenders").sort((a, b) => {
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

    let eliminatedOption = document.createElement("option");
    eliminatedOption.value = "Eliminated-Contenders";
    eliminatedOption.text = `Eliminated Contenders (${eliminatedCount})`;
    select.appendChild(eliminatedOption);

    let newValue = currentBracket.replace(" - ", "-");
    if (!(newValue in Object.fromEntries(sortedKeys.map(key => [key.replace(" - ", "-"), key]).concat([["All", "All"], ["Eliminated-Contenders", "Eliminated Contenders"]]))) || !brackets[currentBracket]) {
        newValue = sortedKeys[0]?.replace(" - ", "-") || "All";
        setCurrentBracket(sortedKeys[0] || "All");
    }
    select.value = newValue;
}
