<?php
session_start();
require_once "sidcon.php";
header('Content-Type: application/json');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// Destroy the current session
$user_id = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : 'unknown';
error_log("Logout: Destroying session for user ID $user_id");
session_destroy();

// Start a new session for the guest user
session_start();
session_set_cookie_params(30 * 24 * 60 * 60); // 30 days
$_SESSION['session_id'] = bin2hex(random_bytes(16));

// Insert a new guest user record
$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("Logout: Database connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

$stmt = $cxn->prepare("INSERT INTO siduser (session_id, RegDate, LastAccessDate) VALUES (?, CURDATE(), CURDATE())");
if (!$stmt) {
    error_log("Logout: Prepare statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    $cxn->close();
    exit;
}
$stmt->bind_param("s", $_SESSION['session_id']);
$stmt->execute();
$stmt->close();
$cxn->close();

error_log("Logout: Successfully created new guest session with session_id {$_SESSION['session_id']}");
echo json_encode(['success' => true]);
?>