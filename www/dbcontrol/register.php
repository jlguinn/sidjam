<?php
session_start();
require_once "sidcon.php";
header('Content-Type: application/json');

$username = isset($_POST['username']) ? $_POST['username'] : '';
$email = isset($_POST['email']) ? $_POST['email'] : '';
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

$cxn = mysqli_connect($host, $user, $pass, $database) or die(json_encode(['success' => false, 'message' => "Connection failed: " . mysqli_connect_error()]));

// Check if email or username already exists (for registered users)
$stmt = $cxn->prepare("SELECT user_id FROM siduser WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$email_exists = $stmt->get_result()->fetch_assoc() ? true : false;
$stmt->close();

$stmt = $cxn->prepare("SELECT user_id FROM siduser WHERE UserName = ?"); // Case-sensitive field name
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

if ($user_id) {
    // Update existing guest user
    $stmt = $cxn->prepare("UPDATE siduser SET UserName = ?, email = ?, password = ?, LastAccessDate = CURDATE(), current_bracket = '0-0', current_theme = 1 WHERE user_id = ?");
    $stmt->bind_param("sssi", $username, $email, $hashed_password, $user_id);
    $stmt->execute();
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
        setcookie('session_id', $new_session_id, time() + (30 * 24 * 60 * 60), "/");

        error_log("Register: Successfully updated user_id $user_id");
        echo json_encode(['success' => true]);
    } else {
        error_log("Register: Failed to update user_id $user_id");
        echo json_encode(['success' => false, 'message' => 'Failed to update user']);
    }
} else {
    // Insert new user
    $stmt = $cxn->prepare("INSERT INTO siduser (session_id, UserName, email, password, RegDate, LastAccessDate, current_bracket, current_theme) VALUES (?, ?, ?, ?, CURDATE(), CURDATE(), '0-0', 0)");
    $new_session_id = bin2hex(random_bytes(16));
    $stmt->bind_param("ssss", $new_session_id, $username, $email, $hashed_password);
    $stmt->execute();
    $user_id = $cxn->insert_id;
    $stmt->close();

    if ($user_id) {
        $_SESSION['user_id'] = $user_id;
        $_SESSION['session_id'] = $new_session_id;
        setcookie('session_id', $new_session_id, time() + (30 * 24 * 60 * 60), "/");
        error_log("Register: Created new user_id $user_id");
        echo json_encode(['success' => true]);
    } else {
        error_log("Register: Failed to create new user");
        echo json_encode(['success' => false, 'message' => 'Registration failed']);
    }
}

$cxn->close();
?>