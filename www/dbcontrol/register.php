<?php
session_start();
$sidconPath = file_exists(__DIR__ . '/../../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/sidcon.php';

require_once $sidconPath;
// It's good practice to include autoload.php once at a higher level (e.g., index.php)
// or ensure this specific path is correct for register.php's location relative to vendor/
require_once __DIR__ . '/../vendor/autoload.php';
require_once "Mailer.php"; // Load your updated Mailer class
header('Content-Type: application/json');

// Ensure errors are logged, not displayed, to avoid breaking JSON response
ini_set('display_errors', 0);
ini_set('log_errors', 1);

$username = isset($_POST['username']) ? trim($_POST['username']) : '';
$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$password = isset($_POST['password']) ? $_POST['password'] : '';

if (empty($username) || empty($email) || empty($password)) {
    error_log("Register: Missing required fields");
    echo json_encode(['success' => false, 'message' => 'All fields are required']);
    exit;
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    error_log("Register: Invalid email format: $email");
    echo json_encode(['success' => false, 'message' => 'Invalid email format']);
    exit;
}

// Validate password length (minimum 8 characters)
if (strlen($password) < 8) {
    error_log("Register: Password too short: " . strlen($password));
    echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters long']);
    exit;
}

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("Register: Connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => "Connection failed: " . mysqli_connect_error()]);
    exit;
}

// Check if email or username already exists (for registered users)
$stmt = $cxn->prepare("SELECT user_id FROM siduser WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$email_exists = $stmt->get_result()->fetch_assoc() ? true : false;
$stmt->close();

$stmt = $cxn->prepare("SELECT user_id FROM siduser WHERE UserName = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$username_exists = $stmt->get_result()->fetch_assoc() ? true : false;
$stmt->close();

if ($email_exists) {
    error_log("Register: Email already exists: $email");
    echo json_encode(['success' => false, 'message' => 'Email already exists']);
    $cxn->close();
    exit;
} elseif ($username_exists) {
    error_log("Register: Username already exists: $username");
    echo json_encode(['success' => false, 'message' => 'Username already exists']);
    $cxn->close();
    exit;
}

// Check for existing guest user by session_id
$current_session_id = $_SESSION['session_id'] ?? $_COOKIE['session_id'] ?? null;
error_log("Register: Current session_id - SESSION: " . ($_SESSION['session_id'] ?? 'null') . ", COOKIE: " . ($_COOKIE['session_id'] ?? 'null'));
$user_id = null;

if ($current_session_id) {
    $stmt = $cxn->prepare("SELECT user_id FROM siduser WHERE session_id = ?");
    $stmt->bind_param("s", $current_session_id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($row = $result->fetch_assoc()) {
        $user_id = $row['user_id'];
        error_log("Register: Found user_id $user_id for session_id $current_session_id");
    } else {
        error_log("Register: No user found for session_id $current_session_id");
    }
    $stmt->close();
} else {
    error_log("Register: No session_id found");
}

$hashed_password = password_hash($password, PASSWORD_DEFAULT);
// Prepare the player_state JSON
$player_state = json_encode(['bracket' => '0-0', 'theme' => 1]);

// Determine if we are updating an existing guest or inserting a new user
$is_update_guest = false;
if ($user_id) {
    // Verify if this user_id is actually a guest (has no email yet)
    $stmt_check_guest = $cxn->prepare("SELECT email FROM siduser WHERE user_id = ?");
    $stmt_check_guest->bind_param("i", $user_id);
    $stmt_check_guest->execute();
    $guest_result = $stmt_check_guest->get_result()->fetch_assoc();
    $stmt_check_guest->close();

    if (empty($guest_result['email'])) {
        $is_update_guest = true;
    }
}

if ($is_update_guest) {
    // Update existing guest user
    $stmt = $cxn->prepare("UPDATE siduser SET UserName = ?, email = ?, password = ?, RegDate = CURDATE(), LastAccessDate = CURDATE(), player_state = ? WHERE user_id = ?");
    $stmt->bind_param("ssssi", $username, $email, $hashed_password, $player_state, $user_id);
    if (!$stmt->execute()) {
        error_log("Register: Failed to update user_id $user_id: " . $stmt->error);
        echo json_encode(['success' => false, 'message' => 'Failed to update user']);
        $stmt->close();
        $cxn->close();
        exit;
    }
    $affected_rows = $stmt->affected_rows;
    $stmt->close();

    if ($affected_rows > 0) {
        // Regenerate session_id for security
        $new_session_id = bin2hex(random_bytes(16));
        $stmt = $cxn->prepare("UPDATE siduser SET session_id = ? WHERE user_id = ?");
        $stmt->bind_param("si", $new_session_id, $user_id);
        $stmt->execute();
        $stmt->close();

        // Update session and cookie
        $_SESSION['user_id'] = $user_id;
        $_SESSION['session_id'] = $new_session_id;
        $_SESSION['email'] = $email; // Set email in session for newly registered user
        setcookie('session_id', $new_session_id, time() + (30 * 24 * 60 * 60), "/");

        error_log("Register: Successfully updated guest user_id $user_id to full user.");
        // Continue to send email after success message
    } else {
        error_log("Register: No rows affected for user_id $user_id during guest update.");
        echo json_encode(['success' => false, 'message' => 'Failed to update user']);
        $cxn->close();
        exit;
    }
} else {
    // Insert new user
    $stmt = $cxn->prepare("INSERT INTO siduser (session_id, UserName, email, password, RegDate, LastAccessDate, player_state) VALUES (?, ?, ?, ?, CURDATE(), CURDATE(), ?)");
    $new_session_id = bin2hex(random_bytes(16));
    $stmt->bind_param("sssss", $new_session_id, $username, $email, $hashed_password, $player_state);
    if (!$stmt->execute()) {
        error_log("Register: Failed to insert new user: " . $stmt->error);
        echo json_encode(['success' => false, 'message' => 'Registration failed']);
        $stmt->close();
        $cxn->close();
        exit;
    }
    $user_id = $cxn->insert_id;
    $stmt->close();

    if ($user_id) {
        $_SESSION['user_id'] = $user_id;
        $_SESSION['session_id'] = $new_session_id;
        $_SESSION['email'] = $email; // Set email in session for newly registered user
        setcookie('session_id', $new_session_id, time() + (30 * 24 * 60 * 60), "/");
        error_log("Register: Created new user_id $user_id.");
        // Continue to send email after success message
    } else {
        error_log("Register: Failed to retrieve new user_id.");
        echo json_encode(['success' => false, 'message' => 'Registration failed']);
        $cxn->close();
        exit;
    }
}

// --- SES Email Sending for Registration Confirmation ---
// These variables ($awsAccessKeyId, etc.) are loaded from require_once $sidconPath;
// Make sure sidcon.php defines these: awsAccessKeyId, awsSecretAccessKey, awsRegion, sesSenderEmail, sesSenderName
require_once "Mailer.php"; // Load Mailer after sidconPath for credential access
$mailer = new Mailer($awsAccessKeyId, $awsSecretAccessKey, $awsRegion, $sesSenderEmail, $sesSenderName);

$subject = "Welcome to sID JAm!";
$bodyHtml = "
    <p>Thank you for registering to sID JAm!</p>
    <p>We're excited to have you as part of our community.</p>
    <p>You can now sign in and enjoy all the features.</p>
    <p>Visit <a href=\"https://sidjam.com\">https://sidjam.com</a> to get started.</p>
    <p>Thank you!</p>
    <p>The sID JAm Team</p>
";
$bodyText = "Thank you for registering to sID JAm!\n\nWe're excited to have you as part of our community.\nYou can now sign in and enjoy all the features.\n\nVisit https://sidjam.com to get started.\n\nThank you!\nThe sID JAm Team";

error_log("Register: Attempting to send welcome email to $email");
if (!$mailer->send($email, $subject, $bodyHtml, true)) { // Pass true for HTML body
    error_log("Register: Failed to send welcome email to $email");
    // Decide if registration should still succeed if email fails.
    // For a welcome email, usually it's okay to succeed the registration.
} else {
    error_log("Register: Successfully sent welcome email to $email");
}

$cxn->close();
echo json_encode(['success' => true, 'message' => 'Registration successful!']);
?>