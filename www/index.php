<?php
// Set session cookie lifetime to 30 days (30 * 24 * 60 * 60 seconds)
session_set_cookie_params(30 * 24 * 60 * 60);
session_start();
require_once "dbcontrol/sidcon.php";
$cxn = mysqli_connect($host, $user, $pass, $database) or die("Connection failed: " . mysqli_connect_error());

// Initialize variables
$user_id = null;

// Check if user is logged in via $_SESSION['user_id']
if (isset($_SESSION['user_id'])) {
    $user_id = $_SESSION['user_id'];
    // Verify the user exists and sync session_id
    $stmt = $cxn->prepare("SELECT session_id FROM siduser WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($row = $result->fetch_assoc()) {
        // Ensure session_id matches
        if ($row['session_id'] !== $_SESSION['session_id']) {
            $stmt = $cxn->prepare("UPDATE siduser SET session_id = ?, LastAccessDate = CURDATE() WHERE user_id = ?");
            $stmt->bind_param("si", $_SESSION['session_id'], $user_id);
            $stmt->execute();
            $stmt->close();
            // Update the cookie to match
            setcookie('session_id', $_SESSION['session_id'], time() + (30 * 24 * 60 * 60), "/");
        }
        // Update LastAccessDate
        $stmt = $cxn->prepare("UPDATE siduser SET LastAccessDate = CURDATE() WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
    } else {
        // Edge case: user_id in session but not in DB (shouldn't happen)
        unset($_SESSION['user_id']);
        $user_id = null;
    }
    $stmt->close();
}

// If no user_id, check for existing session_id (guest user)
if (!$user_id) {
    $session_id = $_SESSION['session_id'] ?? $_COOKIE['session_id'] ?? null;
    if ($session_id) {
        $stmt = $cxn->prepare("SELECT user_id FROM siduser WHERE session_id = ?");
        $stmt->bind_param("s", $session_id);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($row = $result->fetch_assoc()) {
            $user_id = $row['user_id'];
            $_SESSION['user_id'] = $user_id; // Ensure session is set
            // Update LastAccessDate
            $stmt = $cxn->prepare("UPDATE siduser SET LastAccessDate = CURDATE() WHERE user_id = ?");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
        }
        $stmt->close();
    }
}

// If no user_id found, create a new guest
if (!$user_id) {
    $new_session_id = bin2hex(random_bytes(16));
    $stmt = $cxn->prepare("INSERT INTO siduser (session_id, RegDate, LastAccessDate) VALUES (?, CURDATE(), CURDATE())");
    $stmt->bind_param("s", $new_session_id);
    $stmt->execute();
    $user_id = $cxn->insert_id;
    $stmt->close();

    $_SESSION['user_id'] = $user_id;
    $_SESSION['session_id'] = $new_session_id;
    setcookie('session_id', $new_session_id, time() + (30 * 24 * 60 * 60), "/");
    error_log("Index: Created new guest user_id $user_id with session_id $new_session_id");
}

// Check if the user is logged in (registered user) and get their username
$username = "Guest User"; // Default for guests
$is_logged_in = false;
if (isset($_SESSION['user_id'])) {
    $stmt = $cxn->prepare("SELECT UserName, email FROM siduser WHERE user_id = ?"); // Fixed 'username' to 'UserName'
    $stmt->bind_param("i", $_SESSION['user_id']);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($row = $result->fetch_assoc()) {
        $username = $row['UserName'] ?: "Guest User"; // Fixed key to 'UserName'
        // A user is considered logged in only if they have an email (i.e., registered)
        $is_logged_in = !empty($row['email']);
    }
    $stmt->close();
}

$cxn->close();
?>
<!DOCTYPE html>
<html>
<head>
    <title>sID JAm</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="src/styles.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tektur:wght@400;700&display=swap">
    <script>window.WASM_SEARCH_PATH = 'src/websid/htdocs/';</script>
    <script src="src/websid/htdocs/stdlib/scriptprocessor_player.min.js"></script>
    <script src="src/websid/htdocs/backend_websid.js"></script>
    <script>window.user = { id: <?php echo $user_id; ?>, session_id: "<?php echo $_SESSION['session_id']; ?>" };</script>
    <script>
        window.isLoggedIn = <?php echo json_encode($is_logged_in); ?>;
    </script>
    <script>console.log("sID JAm Version (ALPHA) 2025.03.19a");</script>
    <script type="module" src="src/script.js"></script>
</head>
<body>
    <div id="header">
        <div id="title-wrapper">
            <h1 id="title">sID JAm</h1>
        </div>
    </div>
    <div id="profile-package">
        <div id="user-info">
            <span id="greeting"><?php echo htmlspecialchars($username); ?></span>
        </div>
        <div id="profile-icon">
            <div id="profile-bitmap" style="display: grid; grid-template-columns: repeat(15, 4px); grid-template-rows: repeat(18, 4px); width: 60px; height: 72px; cursor: pointer;"></div>
        </div>
        <?php if ($is_logged_in): ?>
            <div id="preferences-link"><a href="#" onclick="window.togglePreferencesPopUp(); return false;">My Preferences</a></div>
        <?php else: ?>
            <div id="auth-link"><a href="#" onclick="window.toggleAuthPopUp(); return false;">Sign in / Register</a></div>
        <?php endif; ?>
    </div>
    <div id="version">Version (ALPHA) 2025.03.19a</div>
    <div id="vs-matchup">
        <span id="song1">-</span>
        <span id="vs-text"> - vs - </span>
        <span id="song2">-</span>
    </div>
    <div id="round-info">
        Press Play
    </div>
    <div id="player-info">
        <div id="song-title">-</div>
        <div id="track-details">
            <p id="song-author">Author: -</p>
            <p id="song-released">Released: -</p>
            <p id="track-info">Track: -</p>
            <p id="timer">Time: 00:00</p>
        </div>
    </div>
    <div id="color-toggle">
        <button id="colorButton" onclick="window.toggleColorScheme()"><span class="inner-box"></span></button>
    </div>
    <div id="control-row">
        <div id="player-controls">
            <button id="prevButton" class="control-button image-button" style="background-image: url('image/prev.png')" onclick="window.prevTrack()" disabled></button>
            <button id="playPauseButton" class="control-button image-button" style="background-image: url('image/play.png')" onclick="window.togglePlayPause()" disabled></button>
            <button id="nextButton" class="control-button image-button" style="background-image: url('image/next.png')" onclick="window.nextTrack()" disabled></button>
        </div>
        <div class="voice-controls">
            <input type="checkbox" id="voice1" checked>
            <input type="checkbox" id="voice2" checked>
            <input type="checkbox" id="voice3" checked>
        </div>
    </div>
    <div id="jam-controls">
        <button id="jamButton" class="control-button" onclick="window.jamToggle()" disabled>jAM</button>
    </div>
    <div id="winner-controls">
        <button id="winner0" class="control-button" onclick="window.setWinner(0)">Winner</button>
        <button id="winner1" class="control-button" onclick="window.setWinner(1)">Winner</button>
    </div>
    <div id="bracket-flame-row">
        <div id="bracket-controls">
            <span id="bracket-label">Bracket</span>
            <div class="bracket-row">
                <select id="bracket-select" onchange="window.changeBracket()"></select>
                <button id="ellipsis-button" class="control-button" onclick="window.toggleSongList()" disabled>...</button>
            </div>
        </div>
        <div id="flame-wrapper">
            <div id="flame-controls">
                <button id="flameButton" onclick="window.toggleFlame()" disabled></button>
                <button id="reviveButton" style="display: none;" onclick="window.toggleRevive()">Revive</button>
            </div>
        </div>
    </div>
    <div id="songListOverlay">
        <div id="songListContainer">
            <button id="closeSongList" onclick="window.toggleSongList()">×</button>
            <input type="text" id="filterInput" placeholder="Filter songs...">
            <div id="songListWrapper">
                <ul id="songList"></ul>
            </div>
        </div>
    </div>

    <!-- Login/Registration Pop-Up -->
    <div id="authOverlay" style="display: none;">
        <div id="authContainer">
            <button id="closeAuth" onclick="window.toggleAuthPopUp()">×</button>
            <div id="authTabs">
                <button id="signInTab" class="auth-tab active" onclick="window.showAuthTab('signIn')">Sign In</button>
                <button id="registerTab" class="auth-tab" onclick="window.showAuthTab('register')">Register</button>
            </div>
            <div id="authForms">
                <!-- Sign In Form -->
                <div id="signInForm" class="auth-form active">
                    <h2>Sign In</h2>
                    <form id="signInFormElement" onsubmit="window.handleSignIn(event)">
                        <div class="form-group">
                            <label for="signInEmail">Email:</label>
                            <input type="email" id="signInEmail" name="email" required>
                        </div>
                        <div class="form-group">
                            <label for="signInPassword">Password:</label>
                            <input type="password" id="signInPassword" name="password" required>
                        </div>
                        <button type="submit">Sign In</button>
                        <p><a href="#" onclick="event.preventDefault(); event.stopPropagation(); window.showAuthTab('forgotPassword')">Forgot Password?</a></p>
                        <p id="signInError" class="error-message"></p>
                    </form>
                </div>
                <!-- Register Form -->
                <div id="registerForm" class="auth-form" style="display: none;">
                <h2>Register</h2>
                <form id="registerFormElement" onsubmit="window.handleRegister(event)">
                    <div class="form-group">
                        <label for="registerEmail">Email:</label>
                        <input type="email" id="registerEmail" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="registerUsername">Username:</label>
                        <input type="text" id="registerUsername" name="username" required>
                    </div>                    
                    <div class="form-group">
                        <label for="registerPassword">Password:</label>
                        <input type="password" id="registerPassword" name="password" required>
                    </div>
                    <div class="form-group">
                        <label for="registerConfirmPassword">Confirm Password:</label>
                        <input type="password" id="registerConfirmPassword" name="confirmPassword" required>
                    </div>
                    <button type="submit">Register</button>
                    <p id="registerError" class="error-message"></p>
                </form>
            </div>
                <!-- Forgot Password Form -->
                <div id="forgotPasswordForm" class="auth-form" style="display: none;">
                    <h2>Forgot Password</h2>
                    <form id="forgotPasswordFormElement" onsubmit="window.handleForgotPassword(event)">
                        <div class="form-group">
                            <label for="forgotPasswordEmail">Email:</label>
                            <input type="email" id="forgotPasswordEmail" name="email" required>
                        </div>
                        <button type="submit">Send Reset Link</button>
                        <p><a href="#" onclick="window.showAuthTab('signIn')">Back to Sign In</a></p>
                        <p id="forgotPasswordMessage" class="message"></p>
                    </form>
                </div>
            </div>
        </div>
    </div>
    <!-- My Preferences Pop-Up -->
    <div id="preferencesOverlay" style="display: none;">
        <div id="preferencesContainer">
            <button id="closePreferences" onclick="window.togglePreferencesPopUp()">×</button>
            <div id="preferencesTabs">
                <button id="passwordTab" class="preferences-tab active" onclick="window.showPreferencesTab('password')">Password</button>
                <button id="usernameTab" class="preferences-tab" onclick="window.showPreferencesTab('username')">Username</button>
                <button id="emailTab" class="preferences-tab" onclick="window.showPreferencesTab('email')">Email</button>
                <button id="advancedTab" class="preferences-tab" onclick="window.showPreferencesTab('advanced')">Advanced</button>
            </div>
            <div id="preferencesForms">
                <!-- Password Tab -->
                <div id="passwordForm" class="preferences-form active">
                    <h2>Update Password</h2>
                    <div id="updatePasswordSection">
                        <form id="updatePasswordForm" onsubmit="window.handleUpdatePassword(event)">
                            <div class="form-group">
                                <label for="currentPassword">Current Password:</label>
                                <input type="password" id="currentPassword" name="currentPassword" required>
                            </div>
                            <div class="form-group">
                                <label for="newPassword">New Password:</label>
                                <input type="password" id="newPassword" name="newPassword" required>
                            </div>
                            <div class="form-group">
                                <label for="confirmNewPassword">Confirm New Password:</label>
                                <input type="password" id="confirmNewPassword" name="confirmNewPassword" required>
                            </div>
                            <button type="submit" id="updatePasswordButton">Update Password</button>
                            <p id="updatePasswordError" class="error-message"></p>
                        </form>
                    </div>
                    <div id="updatePasswordSuccess" style="display: none;">
                        <p class="success-message">Password Changed Successfully</p>
                        <button id="closePasswordPrompt" onclick="window.closePreferencesAndReload()">Close Prompt</button>
                    </div>
                    <div class="logout-link">
                        <a href="#" onclick="window.handleLogout(event)">Logout</a>
                    </div>
                </div>
                <!-- Username Tab -->
                <div id="usernameForm" class="preferences-form">
                    <h2>Update Username</h2>
                    <div id="updateUsernameSection">
                        <form id="updateUsernameForm" onsubmit="window.handleUpdateUsername(event)">
                            <div class="form-group">
                                <label for="newUsername">New Username:</label>
                                <input type="text" id="newUsername" name="newUsername" required>
                            </div>
                            <button type="submit" id="updateUsernameButton">Update Username</button>
                            <p id="updateUsernameError" class="error-message"></p>
                        </form>
                    </div>
                    <div id="updateUsernameConfirmation" style="display: none;">
                        <p>Confirm Username Change to <span id="confirmNewUsername"></span></p>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <button type="button" id="confirmUsernameButton" onclick="window.confirmUpdateUsername()" style="width: 100%; box-sizing: border-box;">Confirm</button>
                            <button type="button" id="cancelUsernameButton" onclick="window.hideUpdateUsernameConfirmation()" style="width: 100%; box-sizing: border-box;">Cancel</button>
                        </div>
                        <p id="confirmUsernameError" class="error-message"></p>
                    </div>
                    <div id="updateUsernameSuccess" style="display: none;">
                        <p class="success-message">Username Changed Successfully</p>
                        <button id="closeUsernamePrompt" onclick="window.closePreferencesAndReload()">Close Prompt</button>
                    </div>
                    <div class="logout-link">
                        <a href="#" onclick="window.handleLogout(event)">Logout</a>
                    </div>
                </div>
                <!-- Email Tab -->
                <div id="emailForm" class="preferences-form">
                    <h2>Update Email</h2>
                    <div id="updateEmailSection">
                        <p>Current Email: <span id="currentEmail"><?php echo htmlspecialchars($_SESSION['email'] ?? 'Not set'); ?></span></p>
                        <form id="updateEmailForm" onsubmit="window.handleUpdateEmail(event)">
                            <div class="form-group">
                                <label for="newEmail">New Email:</label>
                                <input type="email" id="newEmail" name="newEmail" required>
                            </div>
                            <button type="submit" id="updateEmailButton">Update Email</button>
                            <p id="updateEmailError" class="error-message"></p>
                        </form>
                    </div>
                    <div id="updateEmailConfirmation" style="display: none;">
                        <p>Confirm Email Change to <span id="confirmNewEmail"></span></p>
                        <p>Please enter your current password to verify your identity before changing your email.</p>
                        <form id="confirmEmailForm" onsubmit="window.confirmUpdateEmail(event)">
                            <div class="form-group">
                                <label for="confirmPassword">Current Password:</label>
                                <input type="password" id="confirmPassword" name="confirmPassword" required>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <button type="submit" id="confirmEmailButton" style="width: 100%; box-sizing: border-box;">Confirm</button>
                                <button type="button" id="cancelEmailButton" onclick="window.hideUpdateEmailConfirmation()" style="width: 100%; box-sizing: border-box;">Cancel</button>
                            </div>
                            <p id="confirmEmailError" class="error-message"></p>
                        </form>
                    </div>
                    <div id="updateEmailSuccess" style="display: none;">
                        <p class="success-message">Email Changed Successfully</p>
                        <button id="closeEmailPrompt" onclick="window.closePreferencesAndReload()">Close Prompt</button>
                    </div>
                    <!-- Logout link -->
                    <div class="logout-link">
                        <a href="#" onclick="window.handleLogout(event)">Logout</a>
                    </div>
                </div>
                <!-- Advanced Tab -->
                <div id="advancedForm" class="preferences-form">
                    <h2>Advanced Settings</h2>
                    <div id="deleteAccountSection">
                        <p>Delete your account permanently. This action cannot be undone.</p>
                        <button type="button" onclick="window.showDeleteAccountConfirmation()">Delete Account</button>
                    </div>
                    <div id="deleteAccountConfirmation" style="display: none;">
                        <p>Confirm Account Deletion</p>
                        <p>Enter your password to confirm:</p>
                        <form id="deleteAccountForm" onsubmit="window.handleDeleteAccount(event)">
                            <div class="form-group">
                                <input type="password" id="deletePassword" name="deletePassword" required>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <button type="submit" id="deleteAccountButton" style="width: 100%; box-sizing: border-box;">Delete Account</button>
                                <button type="button" id="cancelDeleteButton" onclick="window.hideDeleteAccountConfirmation()" style="width: 100%; box-sizing: border-box;">Cancel</button>
                            </div>
                            <p id="deleteAccountError" class="error-message"></p>
                        </form>
                    </div>
                    <!-- Logout link -->
                    <div class="logout-link">
                        <a href="#" onclick="window.handleLogout(event)">Logout</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>