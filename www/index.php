<?php
// Define debug toggle (hardcoded for now)
$debug_enabled = isset($_GET['debug']) && $_GET['debug'] === 'true'; // Set to true if ?debug=true is in the URL
$log_level = 2; // 0 terse (default); 1 verbose; 2 debugging; -1 silent

// Set session cookie lifetime to 30 days
session_set_cookie_params(30 * 24 * 60 * 60);
session_start();
$sidconPath = file_exists(__DIR__ . '/../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/dbcontrol/sidcon.php';

require_once $sidconPath;

$cxn = mysqli_connect($host, $user, $pass, $database) or die("Connection failed: " . mysqli_connect_error());

// Helper function to clear session
function clearSession() {
    session_destroy();
    unset($_SESSION['user_id']);
    unset($_SESSION['session_id']);
    setcookie('session_id', '', time() - 3600, "/");
}

// Helper function to update LastAccessDate
function updateLastAccess($cxn, $user_id) {
    $stmt = $cxn->prepare("UPDATE siduser SET LastAccessDate = CURDATE() WHERE user_id = ?");
    if ($stmt) {
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();
    } else {
        error_log("Failed to prepare UPDATE LastAccessDate: " . $cxn->error);
    }
}

// Initialize variables
$user_id = null;
$username = "Guest User";
$is_logged_in = false;

// Check if user is logged in via $_SESSION['user_id']
if (isset($_SESSION['user_id'])) {
    try {
        $user_id = $_SESSION['user_id'];
        $stmt = $cxn->prepare("SELECT session_id, UserName, email FROM siduser WHERE user_id = ?");
        if (!$stmt) {
            throw new Exception("Failed to prepare SELECT statement: " . $cxn->error);
        }
        $stmt->bind_param("i", $user_id);
        if (!$stmt->execute()) {
            throw new Exception("Failed to execute SELECT statement: " . $stmt->error);
        }
        $result = $stmt->get_result();
        if ($row = $result->fetch_assoc()) {
            // Sync session_id
            if ($row['session_id'] !== ($_SESSION['session_id'] ?? null)) {
                try {
                    $session_id = $_SESSION['session_id'] ?? bin2hex(random_bytes(16));
                    $stmt = $cxn->prepare("UPDATE siduser SET session_id = ?, LastAccessDate = CURDATE() WHERE user_id = ?");
                    if (!$stmt) {
                        throw new Exception("Failed to prepare UPDATE statement: " . $cxn->error);
                    }
                    error_log("Updating session_id to: " . ($session_id ?: 'NULL')); // Debug log
                    $stmt->bind_param("si", $session_id, $user_id);
                    if (!$stmt->execute()) {
                        throw new Exception("Failed to execute UPDATE statement: " . $stmt->error);
                    }
                    setcookie('session_id', $session_id, time() + (30 * 24 * 60 * 60), "/");
                } catch (Exception $e) {
                    error_log("Error syncing session_id for user_id $user_id: " . $e->getMessage());
                    clearSession();
                    $user_id = null;
                }
            }
            updateLastAccess($cxn, $user_id);
            $username = $row['UserName'] ?: "Guest User";
            $_SESSION['email'] = $row['email'] ?: '';
            $is_logged_in = !empty($row['email']);
        } else {
            error_log("No user found for user_id: $user_id");
            unset($_SESSION['user_id']);
            unset($_SESSION['email']);
            $user_id = null;
        }
        $stmt->close();
    } catch (Exception $e) {
        error_log("Error validating user session for user_id $user_id: " . $e->getMessage());
        clearSession();
        $user_id = null;
    }
}

// If no user_id, check for existing session_id (guest user)
if (!$user_id) {
    $session_id = isset($_SESSION['session_id']) ? $_SESSION['session_id'] : (isset($_COOKIE['session_id']) ? $_COOKIE['session_id'] : null);
    if ($session_id && is_string($session_id) && strlen($session_id) === 32) {
        try {
            $stmt = $cxn->prepare("SELECT user_id, UserName, email FROM siduser WHERE session_id = ?");
            if (!$stmt) {
                throw new Exception("Failed to prepare SELECT for session_id: " . $cxn->error);
            }
            $stmt->bind_param("s", $session_id);
            if (!$stmt->execute()) {
                throw new Exception("Failed to execute SELECT for session_id: " . $stmt->error);
            }
            $result = $stmt->get_result();
            if ($row = $result->fetch_assoc()) {
                $user_id = $row['user_id'];
                $_SESSION['user_id'] = $user_id;
                $_SESSION['session_id'] = $session_id;
                $_SESSION['email'] = $row['email'] ?: '';
                $username = $row['UserName'] ?: "Guest User";
                $is_logged_in = !empty($row['email']);
                updateLastAccess($cxn, $user_id);
            } else {
                error_log("No user found for session_id: $session_id");
                unset($_SESSION['session_id']);
                setcookie('session_id', '', time() - 3600, "/");
            }
            $stmt->close();
        } catch (Exception $e) {
            error_log("Error validating session_id $session_id: " . $e->getMessage());
            unset($_SESSION['session_id']);
            setcookie('session_id', '', time() - 3600, "/");
        }
    } else {
        error_log("Invalid or missing session_id: " . (is_null($session_id) ? 'NULL' : $session_id));
        unset($_SESSION['session_id']);
        setcookie('session_id', '', time() - 3600, "/");
    }
}

// Create new guest if no user_id
if (!$user_id) {
    $new_session_id = null;
    try {
        $new_session_id = bin2hex(random_bytes(16));
        if (empty($new_session_id) || !is_string($new_session_id) || strlen($new_session_id) !== 32) {
            throw new Exception("Invalid session_id generated");
        }
    } catch (Exception $e) {
        error_log("Failed to generate session_id: " . $e->getMessage());
        $new_session_id = substr(hash('sha256', microtime(true) . mt_rand()), 0, 32);
        error_log("Using fallback session_id: $new_session_id");
    }

    try {
        $stmt = $cxn->prepare("INSERT INTO siduser (session_id, RegDate, LastAccessDate, player_state) VALUES (?, CURDATE(), CURDATE(), NULL)");
        if (!$stmt) {
            throw new Exception("Failed to prepare INSERT statement: " . $cxn->error);
        }
        error_log("Binding session_id: " . (is_null($new_session_id) ? 'NULL' : $new_session_id)); // Debug log
        $stmt->bind_param("s", $new_session_id);
        if (!$stmt->execute()) {
            throw new Exception("Failed to execute INSERT statement: " . $stmt->error);
        }
        $user_id = $cxn->insert_id;
        $_SESSION['user_id'] = $user_id;
        $_SESSION['session_id'] = $new_session_id;
        $_SESSION['email'] = '';
        setcookie('session_id', $new_session_id, time() + (30 * 24 * 60 * 60), "/");
        error_log("Index: Created new guest user_id $user_id with session_id $new_session_id");
    } catch (Exception $e) {
        error_log("Failed to create guest user: " . $e->getMessage());
        clearSession();
        header('Location: /');
        exit;
    }
    $stmt->close();
}

$cxn->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>sID JAm</title>
    <link rel="stylesheet" href="src/styles.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tektur:wght@400;700&display=swap">
    <script>window.WASM_SEARCH_PATH = 'src/websid/htdocs/';</script>
    <script defer src="src/websid/htdocs/stdlib/scriptprocessor_player.min.js"></script>
    <script defer src="src/websid/htdocs/backend_websid.js"></script>
    <script>
        window.user = <?php echo json_encode(['id' => $user_id, 'session_id' => $_SESSION['session_id']]); ?>;
        window.isLoggedIn = <?php echo json_encode($is_logged_in); ?>;
        window.DEBUG_ENABLED = <?php echo json_encode($debug_enabled); ?>;
        window.LOG_LEVEL = <?php echo json_encode($log_level); ?>;
        window.logmsg = function(msg, msgLogLevel = 0) {
            const PLAYER_LOG_LEVEL = typeof window.LOG_LEVEL === 'number' ? window.LOG_LEVEL : 0;
            if (PLAYER_LOG_LEVEL >= msgLogLevel) console.log(msg);
        };
        console.log("sID JAm Version 2025.05.20 (Beta)");
        window.logmsg("Hello world!");
        window.logmsg(`Log Level: ${window.LOG_LEVEL === 1 ? "VERBOSE" : window.LOG_LEVEL === 2 ? "DEBUGGING" : window.LOG_LEVEL === 0 ? "TERSE" : window.LOG_LEVEL === -1 ? "SILENT" : window.LOG_LEVEL.toString()}`, 1);
    </script>
    <script type="module" src="src/script.js"></script>
    <script type="module" src="src/viz.js"></script>
</head>
<script>
    // Ensure toggleHelpPopUp is defined
    window.toggleHelpPopUp = function() {
        const helpOverlay = document.getElementById('helpOverlay');
        if (helpOverlay) {
            helpOverlay.classList.toggle('hidden');
            const isHidden = helpOverlay.classList.contains('hidden');
            window.logmsg('Toggled help popup, hidden: ' + isHidden, 1);
            if (!isHidden) {
                helpOverlay.style.display = 'block'; // Force display
                helpOverlay.focus();
                window.logmsg('Help overlay displayed, z-index: ' + helpOverlay.style.zIndex, 2);
            } else {
                helpOverlay.style.display = 'none'; // Ensure hidden
            }
        } else {
            console.error('Help overlay not found in DOM');
        }
    };

    // Add event listener for help button
    document.addEventListener('DOMContentLoaded', () => {
        const helpButton = document.getElementById('help-button');
        if (helpButton) {
            helpButton.addEventListener('click', () => {
                window.logmsg('Help button clicked', 1);
                window.toggleHelpPopUp();
            });
        } else {
            console.error('Help button not found in DOM');
        }
    });
</script>
<body>
<header id="header">
    <button id="help-button" title="Help" aria-label="Help">💡</button>
    <?php if ($debug_enabled): ?>
        <button id="log-player-state" title="Log Player State" aria-label="Log Player State">P</button>
    <?php endif; ?>
    <h1 id="title">sID JAm</h1>
</header>

    <div id="profile-package">
        <div id="user-info">
            <span id="greeting"><?php echo htmlspecialchars($username); ?></span>
        </div>
        <div id="profile-icon">
            <div id="profile-bitmap"></div>
        </div>
        <?php if ($is_logged_in): ?>
            <div id="preferences-link"><a href="#" onclick="window.togglePreferencesPopUp(); return false;">My Preferences</a></div>
        <?php else: ?>
            <div id="auth-link"><a href="#" onclick="window.toggleAuthPopUp(); return false;">Sign in / Register</a></div>
        <?php endif; ?>
    </div>

    <div id="version">Version 2025.05.20 (beta)</div>

    <div id="vs-matchup">
        <span id="song1">-</span>
        <span id="vs-text"> - vs - </span>
        <span id="song2">-</span>
    </div>

    <div id="round-info">Press Play</div>

    <section id="player-section">
        <div id="player-info">
            <div id="song-title">-</div>
            <div id="track-details">
                <p id="song-author">Author: -</p>
                <p id="song-released">Released: -</p>
                <div id="track-timer-controls-row">
                    <p id="track-info">Track: -</p>
                    <div id="player-controls">
                        <button id="prevButton" class="control-button image-button image-button--prev" aria-label="Previous Track" onclick="window.prevTrack()" disabled></button>
                        <button id="playPauseButton" class="control-button image-button image-button--play" aria-label="Play or Pause Track" onclick="window.togglePlayPause()" disabled></button>
                        <button id="nextButton" class="control-button image-button image-button--next" aria-label="Next Track" onclick="window.nextTrack()" disabled></button>
                    </div>
                    <p id="timer">Time: 00:00</p>
                </div>
            </div>
            <div id="color-toggle">
                <button id="colorButton" aria-label="Toggle Color Scheme" onclick="window.toggleColorScheme()">
                    <span class="color-toggle__icon"></span>
                </button>
            </div>
        </div>

        <div id="vu-controls">
            <button id="vu-toggle-button" class="viz-toggle-button viz-toggle-button--vu" title="Toggle VU Meters" aria-label="Toggle VU Meters"></button>
        </div>
        <div id="voice-controls-container">
            <div class="voice-control-row" data-voice="1">
                <button id="voice1" class="voice-button" data-state="on" title="Toggle Voice 1 Mute" aria-label="Toggle Voice 1 Mute"></button>
                <canvas id="vu1-canvas" width="120" height="70" title="Voice 1 VU Meter" data-state="on" aria-label="Voice 1 VU Meter">
                    Voice 1 VU Meter (visualization not supported)
                </canvas>
            </div>
            <div class="voice-control-row" data-voice="2">
                <button id="voice2" class="voice-button" data-state="on" title="Toggle Voice 2 Mute" aria-label="Toggle Voice 2 Mute"></button>
                <canvas id="vu2-canvas" width="120" height="70" title="Voice 2 VU Meter" data-state="on" aria-label="Voice 2 VU Meter">
                    Voice 2 VU Meter (visualization not supported)
                </canvas>
            </div>
            <div class="voice-control-row" data-voice="3">
                <button id="voice3" class="voice-button" data-state="on" title="Toggle Voice 3 Mute" aria-label="Toggle Voice 3 Mute"></button>
                <canvas id="vu3-canvas" width="120" height="70" title="Voice 3 VU Meter" data-state="on" aria-label="Voice 3 VU Meter">
                    Voice 3 VU Meter (visualization not supported)
                </canvas>
            </div>
        </div>

        <div id="waveform-controls">
            <button id="wave-toggle-button" class="viz-toggle-button viz-toggle-button--wave" title="Toggle Waveforms" aria-label="Toggle Waveforms"></button>
        </div>
        <div id="voice-visualizations">
            <canvas id="voice1-canvas" width="250" height="100" aria-label="Voice 1 Waveform">
                Voice 1 Waveform (visualization not supported)
            </canvas>
            <canvas id="voice2-canvas" width="250" height="100" aria-label="Voice 2 Waveform">
                Voice 2 Waveform (visualization not supported)
            </canvas>
            <canvas id="voice3-canvas" width="250" height="100" aria-label="Voice 3 Waveform">
                Voice 3 Waveform (visualization not supported)
            </canvas>
        </div>
<div id="waveform-zoom-controls">
    <button id="zoom-out-button" class="zoom-button" onclick="zoomWaveformOut()" aria-label="Zoom Out Waveform"><b>-</b></button>
    <button id="reset-view-button" class="zoom-button" onclick="resetView()" aria-label="Reset Waveform View">⭯</button>
    <button id="zoom-in-button" class="zoom-button" onclick="zoomWaveformIn()" aria-label="Zoom In Waveform"><b>+</b></button>
</div>
    </section>

    <div id="jam-controls">
        <div id="winner-left" class="bitmap-button" onclick="window.setWinner(0)" aria-label="Select Left Winner"></div>
        <button id="jamButton" class="control-button" onclick="window.jamToggle()" disabled aria-label="Toggle Jam"></button>
        <div id="winner-right" class="bitmap-button" onclick="window.setWinner(1)" aria-label="Select Right Winner"></div>
    </div>

    <div id="bracket-flame-row">
        <div id="bracket-controls">
            <div class="bracket-row">
                <select id="bracket-select" onchange="window.changeBracket()" aria-label="Select Bracket"></select>
                <button id="ellipsis-button" onclick="(() => { window.logmsg('[...]', 1); toggleSongList(); })()" disabled aria-label="Toggle Song List">...</button>
            </div>
        </div>
        <div id="flame-wrapper">
            <div id="flame-controls">
                <button id="flameButton" onclick="window.toggleFlame()" disabled aria-label="Toggle Flame"></button>
                <img src="/image/revive.png" id="reviveButton" class="disabled" loading="lazy" onclick="window.toggleRevive()" alt="Revive Button">
            </div>
        </div>
    </div>

    <div id="songListOverlay" class="overlay hidden">
        <div id="songListContainer">
            <button id="closeSongList" class="close-button" onclick="(() => { window.logmsg('(x)', 1); window.toggleSongList(); })()" aria-label="Close Song List">×</button>
            <input type="text" id="filterInput" placeholder="Filter songs..." aria-label="Filter Songs">
            <div id="songListWrapper">
                <ul id="songList"></ul>
            </div>
        </div>
    </div>

    <div id="authOverlay" class="overlay hidden">
        <div id="authContainer">
            <button id="closeAuth" class="close-button" onclick="window.toggleAuthPopUp()" aria-label="Close Authentication Overlay">×</button>
            <div id="authTabs">
                <button id="signInTab" class="tab-button auth-tab active" onclick="window.showAuthTab('signIn')" aria-label="Sign In Tab">Sign In</button>
                <button id="registerTab" class="tab-button auth-tab" onclick="window.showAuthTab('register')" aria-label="Register Tab">Register</button>
            </div>
            <div id="authForms">
                <div id="signInForm" class="auth-form active">
                    <h2>Sign In</h2>
                    <form id="signInFormElement" onsubmit="window.handleSignIn(event)">
                        <div class="form-group">
                            <label for="signInEmail">Email:</label>
                            <input type="email" id="signInEmail" name="email" required aria-required="true">
                        </div>
                        <div class="form-group">
                            <label for="signInPassword">Password:</label>
                            <input type="password" id="signInPassword" name="password" required aria-required="true">
                        </div>
                        <button type="submit">Sign In</button>
                        <p><a href="#" onclick="event.preventDefault(); event.stopPropagation(); window.showAuthTab('forgotPassword')">Forgot Password?</a></p>
                        <p id="signInError" class="error-message"></p>
                    </form>
                </div>
                <div id="registerForm" class="auth-form hidden">
                    <h2>Register</h2>
                    <form id="registerFormElement" onsubmit="window.handleRegister(event)">
                        <div class="form-group">
                            <label for="registerEmail">Email:</label>
                            <input type="email" id="registerEmail" name="email" required aria-required="true">
                        </div>
                        <div class="form-group">
                            <label for="registerUsername">Username:</label>
                            <input type="text" id="registerUsername" name="username" required aria-required="true">
                        </div>                    
                        <div class="form-group">
                            <label for="registerPassword">Password:</label>
                            <input type="password" id="registerPassword" name="password" required aria-required="true">
                        </div>
                        <div class="form-group">
                            <label for="registerConfirmPassword">Confirm Password:</label>
                            <input type="password" id="registerConfirmPassword" name="confirmPassword" required aria-required="true">
                        </div>
                        <button type="submit">Register</button>
                        <p id="registerError" class="error-message"></p>
                    </form>
                </div>
                <div id="forgotPasswordForm" class="auth-form hidden">
                    <h2>Forgot Password</h2>
                    <form id="forgotPasswordFormElement" onsubmit="window.handleForgotPassword(event)">
                        <div class="form-group">
                            <label for="forgotPasswordEmail">Email:</label>
                            <input type="email" id="forgotPasswordEmail" name="email" required aria-required="true">
                        </div>
                        <button type="submit">Send Reset Link</button>
                        <p><a href="#" onclick="window.showAuthTab('signIn')">Back to Sign In</a></p>
                        <p id="forgotPasswordMessage" class="message"></p>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <div id="preferencesOverlay" class="overlay hidden">
        <div id="preferencesContainer">
            <button id="closePreferences" class="close-button" onclick="window.togglePreferencesPopUp()" aria-label="Close Preferences Overlay">×</button>
            <div id="preferencesTabs">
                <button id="passwordTab" class="tab-button preferences-tab active" onclick="window.showPreferencesTab('password')" aria-label="Password Tab">Password</button>
                <button id="usernameTab" class="tab-button preferences-tab" onclick="window.showPreferencesTab('username')" aria-label="Username Tab">Username</button>
                <button id="emailTab" class="tab-button preferences-tab" onclick="window.showPreferencesTab('email')" aria-label="Email Tab">Email</button>
                <button id="advancedTab" class="tab-button preferences-tab" onclick="window.showPreferencesTab('advanced')" aria-label="Advanced Tab">Advanced</button>
            </div>
            <div id="preferencesForms">
                <div id="passwordForm" class="preferences-form active">
                    <h2>Update Password</h2>
                    <div id="updatePasswordSection">
                        <form id="updatePasswordForm" onsubmit="window.handleUpdatePassword(event)">
                            <div class="form-group">
                                <label for="currentPassword">Current Password:</label>
                                <input type="password" id="currentPassword" name="currentPassword" required aria-required="true">
                            </div>
                            <div class="form-group">
                                <label for="newPassword">New Password:</label>
                                <input type="password" id="newPassword" name="newPassword" required aria-required="true">
                            </div>
                            <div class="form-group">
                                <label for="confirmNewPassword">Confirm New Password:</label>
                                <input type="password" id="confirmNewPassword" name="confirmNewPassword" required aria-required="true">
                            </div>
                            <button type="submit" id="updatePasswordButton">Update Password</button>
                            <p id="updatePasswordError" class="error-message"></p>
                        </form>
                    </div>
                    <div id="updatePasswordSuccess" class="hidden">
                        <p class="success-message">Password Changed Successfully</p>
                        <button id="closePasswordPrompt" onclick="window.closePreferencesAndReload()">Close Prompt</button>
                    </div>
                    <div class="logout-link">
                        <a href="#" onclick="window.handleLogout(event)">Logout</a>
                    </div>
                </div>
                <div id="usernameForm" class="preferences-form hidden">
                    <h2>Update Username</h2>
                    <div id="updateUsernameSection">
                        <form id="updateUsernameForm" onsubmit="window.handleUpdateUsername(event)">
                            <div class="form-group">
                                <label for="newUsername">New Username:</label>
                                <input type="text" id="newUsername" name="newUsername" required aria-required="true">
                            </div>
                            <button type="submit" id="updateUsernameButton">Update Username</button>
                            <p id="updateUsernameError" class="error-message"></p>
                        </form>
                    </div>
                    <div id="updateUsernameConfirmation" class="hidden">
                        <p>Confirm Username Change to <span id="confirmNewUsername"></span></p>
                        <div class="button-diffusion">
                            <button type="button" id="confirmUsernameButton" onclick="window.confirmUpdateUsername()">Confirm</button>
                            <button type="button" id="cancelUsernameButton" onclick="window.hideUpdateUsernameConfirmation()">Cancel</button>
                        </div>
                        <p id="confirmUsernameError" class="error-message"></p>
                    </div>
                    <div id="updateUsernameSuccess" class="hidden">
                        <p class="success-message">Username Changed Successfully</p>
                        <button id="closeUsernamePrompt" onclick="window.closePreferencesAndReload()">Close Prompt</button>
                    </div>
                    <div class="logout-link">
                        <a href="#" onclick="window.handleLogout(event)">Logout</a>
                    </div>
                </div>
                <div id="emailForm" class="preferences-form hidden">
                    <h2>Update Email</h2>
                    <div id="updateEmailSection">
                        <p>Current Email: <span id="currentEmail"><?php echo htmlspecialchars($_SESSION['email'] ?? 'Not set'); ?></span></p>
                        <form id="updateEmailForm" onsubmit="window.handleUpdateEmail(event)">
                            <div class="form-group">
                                <label for="newEmail">New Email:</label>
                                <input type="email" id="newEmail" name="newEmail" required aria-required="true">
                            </div>
                            <button type="submit" id="updateEmailButton">Update Email</button>
                            <p id="updateEmailError" class="error-message"></p>
                        </form>
                    </div>
                    <div id="updateEmailConfirmation" class="hidden">
                        <p>Confirm Email Change to <span id="confirmNewEmail"></span></p>
                        <p>Please enter your current password to verify your identity before changing your email.</p>
                        <form id="confirmEmailForm" onsubmit="window.confirmUpdateEmail(event)">
                            <div class="form-group">
                                <label for="confirmPassword">Current Password:</label>
                                <input type="password" id="confirmPassword" name="confirmPassword" required aria-required="true">
                            </div>
                            <div class="button-diffusion">
                                <button type="submit" id="confirmEmailButton">Confirm</button>
                                <button type="button" id="cancelEmailButton" onclick="window.hideUpdateEmailConfirmation()">Cancel</button>
                            </div>
                            <p id="confirmEmailError" class="error-message"></p>
                        </form>
                    </div>
                    <div id="updateEmailSuccess" class="hidden">
                        <p class="success-message">Email Changed Successfully</p>
                        <button id="closeEmailPrompt" onclick="window.closePreferencesAndReload()">Close Prompt</button>
                    </div>
                    <div class="logout-link">
                        <a href="#" onclick="window.handleLogout(event)">Logout</a>
                    </div>
                </div>
                <div id="advancedForm" class="preferences-form hidden">
                    <h2>Advanced Settings</h2>
                    <div id="deleteAccountSection">
                        <p>Delete your account permanently. This action cannot be undone.</p>
                        <button type="button" onclick="window.showDeleteAccountConfirmation()">Delete Account</button>
                    </div>
                    <div id="deleteAccountConfirmation" class="hidden">
                        <p>Confirm Account Deletion</p>
                        <p>Enter your password to confirm:</p>
                        <form id="deleteAccountForm" onsubmit="window.handleDeleteAccount(event)">
                            <div class="form-group">
                                <input type="password" id="deletePassword" name="deletePassword" required aria-required="true">
                            </div>
                            <div class="button-diffusion">
                                <button type="submit" id="deleteAccountButton">Delete Account</button>
                                <button type="button" id="cancelDeleteButton" onclick="window.hideDeleteAccountConfirmation()">Cancel</button>
                            </div>
                            <p id="deleteAccountError" class="error-message"></p>
                        </form>
                    </div>
                    <div class="logout-link">
                        <a href="#" onclick="window.handleLogout(event)">Logout</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="helpOverlay" class="overlay hidden">
    <div id="helpContainer">
        <button id="closeHelp" class="close-button" onclick="window.toggleHelpPopUp()" aria-label="Close Help Overlay">×</button>
        <div id="helpContent">
            <h2>Help</h2>
            <p>More help coming soon. In the meantime, contact:</p>
            <p><a href="mailto:jguinn@bonevalleyfilms.com">jguinn@bonevalleyfilms.com</a></p>
            <p>For questions or issues.</p>
        </div>
    </div>
</div>
</body>
</html>