// brackets.js
import { sidPlayer, isPlaying, stopTimer, setIsPlaying } from './player.js';
import { applyTheme } from './ui.js';

const USE_DETERMINISTIC_RANDOM = false; // Set to false to use Math.random()
if (USE_DETERMINISTIC_RANDOM) {
    debug("Using deterministic draws...")
} else {
    debug("Using random draws...")
}

/* Deterministic pseudo random number generator for testing */
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

const seededRandom = new SeededRandom(256890); // Fixed seed for reproducibility

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
  contenders: [], // Array of two song file paths
  activeContender: 0, // Transient: Index of current contender
  roundCount: 1, // Transient: Current round number
  winner: null, // Transient: Index of winner or null
  hasPlayed: false, // Transient: Has any contender been played
  hasJammed: false, // Transient: Has jAM been clicked
  bothContendersSelected: false, // Transient: Both contenders marked as winners
  isFlameActive: false, // Transient: Flame button active
  isReviveActive: false, // Transient: Revive button active
  peekBracket: "0 - 0", // Selected bracket
  activeBracket: "0 - 0", // Last bout-able bracket
  currentMode: "bout", // "bout" or "nowPlaying"
  nowPlayingSong: null, // Song in Now Playing Mode
  peekPlayingSong: null // Transient: Song in Peek Mode
};

export function debug(message) { console.log(`[DEBUG] ${message}`); }

export function getPlayerState() {
  return playerState;
}

export function updatePlayerState(updates) {
  playerState = { ...playerState, ...updates };
  debug(`Updated playerState: ${JSON.stringify(playerState)}`);
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
    debug("No eligible brackets found");
    return null;
  }

  eligibleBrackets.sort((a, b) => getContenderCount(b) - getContenderCount(a));
  let selectedBracket = eligibleBrackets[0];
  debug(`Selected bracket: ${selectedBracket} with ${getContenderCount(selectedBracket)} contenders`);
  return selectedBracket;
}

// Helper function to shuffle an array using SeededRandom
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
    isFlameActive: false,
    activeContender: 0
  });

  console.log(`Bracket: ${playerState.peekBracket} (${filteredFiles.length} contenders)`);
  console.log(`${window.sidJamData.pathToId[playerState.contenders[0]]} ${playerState.contenders[0]}`);
  console.log("- vs -");
  console.log(`${window.sidJamData.pathToId[playerState.contenders[1]]} ${playerState.contenders[1]}`);

  // Remove direct DOM updates
  // Let updateVsMatchup handle song1 and song2 rendering
  updateRoundInfo();
  updateVsMatchup();
  updateWinnerButtons();
  updateFlameButton();
  return true;
}


export async function jamToggle(sidPlayer, loadSong, applyTheme, updateVsMatchup, updateRoundInfo, updateWinnerButtons, updateFlameButton, updateBracketDropdown) {
  if (!sidPlayer) return;

  let shouldUpdateBracketDropdown = false;
  let newBracket = null;
  let voteProcessed = false;

  if (!window.isLoggedIn && window.showPromptMessage && !window.hasShownPrompt) {
    window.hasShownPrompt = true;
  }
  
  if (playerState.currentMode === "nowPlaying") {
    let revivedToZeroZero = false;
    if (playerState.isReviveActive) {
      if (getContenderCount("0 - 0") >= 2) {
        updatePlayerState({
          currentMode: "bout",
          peekBracket: "0 - 0",
          contenders: [playerState.nowPlayingSong],
          isReviveActive: false
        });
        let availableSongs = window.sidJamData.sidFiles.filter(song => song !== playerState.nowPlayingSong && (window.sidJamData.cachedResults[song] || { wins: 0, losses: 0 }).wins === 0 && (window.sidJamData.cachedResults[song] || { wins: 0, losses: 0 }).losses === 0);
        if (availableSongs.length > 0) {
          let newSongIndex = getRandom.randint(0, availableSongs.length - 1);
          playerState.contenders[1] = availableSongs[newSongIndex];
          revivedToZeroZero = true;
        }
      }
    }

    updatePlayerState({ 
      currentMode: "bout", 
      nowPlayingSong: null,
      peekBracket: playerState.activeBracket // Resume with activeBracket
    });
    if (!revivedToZeroZero) {
      // Restore defaults for Bout Mode
      updatePlayerState({
        contenders: [],
        activeContender: 0,
        roundCount: 1,
        winner: null,
        hasJammed: false,
        bothContendersSelected: false,
        isFlameActive: false
      });

      // Validate restored bracket
      const contenderCount = getContenderCount(playerState.peekBracket);
      if (!playerState.contenders[0] || !playerState.contenders[1] || contenderCount < 2) {
        newBracket = findEligibleBracket();
        if (newBracket) {
          if (!isSpecialBracket(playerState.peekBracket)) {
            updatePlayerState({ activeBracket: playerState.peekBracket });
          }
          updatePlayerState({ peekBracket: newBracket, activeBracket: newBracket });
          shouldUpdateBracketDropdown = true;
          pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
        } else {
          debug("No eligible brackets, stopping");
          return;
        }
      } else {
        loadSong(playerState.contenders[playerState.activeContender], -1);
      }
    } else {
      updatePlayerState({
        activeContender: 0,
        roundCount: 1,
        winner: null,
        hasJammed: false,
        bothContendersSelected: false,
        isFlameActive: false
      });
      if (!playerState.contenders[1]) {
        newBracket = findEligibleBracket();
        if (newBracket) {
          if (!isSpecialBracket(playerState.peekBracket)) {
            updatePlayerState({ activeBracket: playerState.peekBracket });
          }
          updatePlayerState({ peekBracket: newBracket, activeBracket: newBracket });
          shouldUpdateBracketDropdown = true;
          pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
        } else {
          debug("No eligible brackets, stopping");
          return;
        }
      } else {
        loadSong(playerState.contenders[playerState.activeContender], -1);
      }
    }
    applyTheme("bout");
    updateVsMatchup();
    updateRoundInfo();
    updateWinnerButtons();
    updateFlameButton();
    if (shouldUpdateBracketDropdown) {
      updateBracketDropdown();
      document.getElementById("bracket-select").value = playerState.peekBracket.replace(' - ', '-');
    }
    return;
  }

  // Treat 1-contender brackets like special brackets ("All" and "Eliminated")
  const specialBrackets = ["All", "Eliminated"];
  let contenderCount = getContenderCount(playerState.peekBracket);
  if (specialBrackets.includes(playerState.peekBracket) || contenderCount === 1) {
    updatePlayerState({ peekBracket: playerState.activeBracket });
    shouldUpdateBracketDropdown = true;
  }

  sidPlayer.pause();
  setIsPlaying(false);
  stopTimer();

  if (playerState.isFlameActive && playerState.peekBracket === "0 - 0") {
    let flamedIndex = playerState.activeContender;
    let flamedFile = playerState.contenders[flamedIndex];

    // Log the flamed song
    console.log(`Flamed!: ${window.sidJamData.pathToId[flamedFile]}`);
    console.log(`${flamedFile}`);

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

        let availableSongs = window.sidJamData.sidFiles.filter(song => !playerState.contenders.includes(song));
        if (availableSongs.length === 0) {
          debug("No songs to replace flamed song");
          updatePlayerState({ contenders: playerState.contenders.map((c, i) => i === flamedIndex ? null : c) });
        } else {
          let newSongIndex = getRandom.randint(0, availableSongs.length - 1);
          let newSong = availableSongs[newSongIndex];
          
          console.log(`New contender: ${window.sidJamData.pathToId[newSong]}`);
          console.log(`${newSong}`);

          updatePlayerState({ contenders: playerState.contenders.map((c, i) => i === flamedIndex ? newSong : c) });
          loadSong(newSong, -1);
        }
        updatePlayerState({ isFlameActive: false });
        updateVsMatchup();
        updateFlameButton();
        updateWinnerButtons();
        voteProcessed = true;
      });
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
        bothContendersSelected: false
      });
      let success = pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
      if (!success) {
        newBracket = findEligibleBracket();
        if (newBracket) {
          updatePlayerState({ activeBracket: playerState.peekBracket, peekBracket: newBracket });
          shouldUpdateBracketDropdown = true;
          pickContenders(updateRoundInfo, updateVsMatchup, updateWinnerButtons, updateFlameButton);
        } else {
          debug("No eligible brackets, stopping");
          return;
        }
      }
      loadSong(playerState.contenders[playerState.activeContender], -1);
      updateVsMatchup();
      updateRoundInfo();
      updateWinnerButtons();
      updateFlameButton();
    } catch (error) {
      console.error('Error in jamToggle after logResult:', error);
    }
  } else {
    let oldContender = playerState.activeContender;
    updatePlayerState({ activeContender: playerState.activeContender === 0 ? 1 : 0 });
    if (oldContender === 1 && playerState.activeContender === 0) {
      updatePlayerState({ roundCount: playerState.roundCount + 1 });
      updateRoundInfo();
    }
    updatePlayerState({ hasJammed: true });
    loadSong(playerState.contenders[playerState.activeContender], -1);
    updateVsMatchup();
    updateWinnerButtons();
    updateFlameButton();
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
  if (playerState.winner === null && !playerState.bothContendersSelected) {
    updatePlayerState({ winner: contenderIndex });
  } else if (playerState.winner !== null && playerState.winner !== contenderIndex) {
    updatePlayerState({ bothContendersSelected: true, winner: null });
  } else if (playerState.bothContendersSelected) {
    updatePlayerState({ winner: contenderIndex === 0 ? 1 : 0, bothContendersSelected: false });
  } else {
    updatePlayerState({ winner: null });
  }
  updateRoundInfo();
  updateWinnerButtons();
  updateFlameButton();
}

export function toggleFlame(updateFlameButton, updateVsMatchup, updateWinnerButtons) {
  updatePlayerState({ isFlameActive: !playerState.isFlameActive });
  updateFlameButton();
  updateVsMatchup();
  updateWinnerButtons();
}

export function toggleRevive(updateReviveButton, updateSongTitleHighlight) {
  updatePlayerState({ isReviveActive: !playerState.isReviveActive });
  if (playerState.isReviveActive && playerState.nowPlayingSong && window.sidJamData.pathToId[playerState.nowPlayingSong]) {
    fetch('dbcontrol/reset_result.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: window.sidJamData.pathToId[playerState.nowPlayingSong] })
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
  if (newBracket === playerState.peekBracket) return;

  if (!isSpecialBracket(playerState.peekBracket)) {
    updatePlayerState({ activeBracket: playerState.peekBracket });
  }
  updatePlayerState({ peekBracket: newBracket });

  if (playerState.currentMode === "nowPlaying") {
    debug(`Staying in Now Playing mode, updating to ${newBracket}`);
    updateFlameButton();
    return;
  }

  const specialBrackets = ["All", "Eliminated"];
  let contenderCount = getContenderCount(newBracket);
  if (specialBrackets.includes(newBracket) || contenderCount === 1) {
    return;
  }

  if (contenderCount < 1) {
    debug(`No contenders in ${newBracket}, reverting to ${playerState.activeBracket}`);
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
    debug(`Failed to pick contenders for ${newBracket}, reverting`);
    updatePlayerState({ peekBracket: playerState.activeBracket });
    updateBracketDropdown();
    return;
  }
  updateFlameButton();
  if (loadSong) loadSong(playerState.contenders[playerState.activeContender], -1);
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
  
  // Add logging for bout decision
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
      debug(`log_result.php response status: ${response.status}`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return response.json();
    })
    .then(data => {
      debug(`log_result.php response data: ${JSON.stringify(data)}`);
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
        debug("Prompt triggered: flashing icon and enabling scrolling message");
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

  let eliminatedOption = document.createElement("option");
  eliminatedOption.value = "Eliminated";
  eliminatedOption.text = `Eliminated (${eliminatedCount} contenders)`;
  select.appendChild(allOption);

  let newValue = playerState.peekBracket.replace(" - ", "-");
  if (!(newValue in Object.fromEntries(sortedKeys.map(key => [key.replace(" - ", "-"), key]).concat([["All", "All"], ["Eliminated", "Eliminated"]]))) || !brackets[playerState.peekBracket]) {
    newValue = sortedKeys[0]?.replace(" - ", "-") || "All";
    updatePlayerState({ peekBracket: sortedKeys[0] || "All" });
  }
  select.value = newValue;
}