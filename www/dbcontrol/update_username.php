<?php
session_start();
require_once "sidcon.php";
require_once "Mailer.php"; // Use Mailer.php with PHPMailer
header('Content-Type: application/json');

ini_set('display_errors', 0); // Disable display_errors
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

if (!isset($_SESSION['user_id'])) {
    error_log("Update Username: User not logged in");
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$newUsername = isset($_POST['newUsername']) ? trim($_POST['newUsername']) : '';

if (empty($newUsername)) {
    error_log("Update Username: Missing required field");
    echo json_encode(['success' => false, 'message' => 'Username is required']); // Fixed syntax
    exit;
}

if (strlen($newUsername) < 3) {
    error_log("Update Username: Username too short");
    echo json_encode(['success' => false, 'message' => 'Username must be at least 3 characters long']);
    exit;
}

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("Update Username: Database connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

$stmt = $cxn->prepare("SELECT user_id FROM siduser WHERE username = ? AND user_id != ?");
if (!$stmt) {
    error_log("Update Username: Prepare statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    exit;
}
$stmt->bind_param("si", $newUsername, $_SESSION['user_id']);
$stmt->execute();
if ($stmt->get_result()->num_rows > 0) {
    error_log("Update Username: Username already taken: $newUsername");
    echo json_encode(['success' => false, 'message' => 'Username already taken']);
    $stmt->close();
    $cxn->close();
    exit;
}
$stmt->close();

$stmt = $cxn->prepare("SELECT email FROM siduser WHERE user_id = ?");
if (!$stmt) {
    error_log("Update Username: Prepare statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    exit;
}
$stmt->bind_param("i", $_SESSION['user_id']);
$stmt->execute();
$result = $stmt->get_result()->fetch_assoc();
$email = $result['email'];
$stmt->close();

$stmt = $cxn->prepare("UPDATE siduser SET username = ? WHERE user_id = ?");
if (!$stmt) {
    error_log("Update Username: Prepare update statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    exit;
}
$stmt->bind_param("si", $newUsername, $_SESSION['user_id']);
$stmt->execute();
$stmt->close();

$subject = "sID JAm - Username Updated";
$body = "Your username has been updated to $newUsername. If you did not request this change, please contact support.";
$mailer = new Mailer();
error_log("Update Username: Sending email notification to $email");
if (!$mailer->send($email, $subject, $body)) {
    error_log("Update Username: Email notification failed for username update to $email");
}

$cxn->close();
error_log("Update Username: Successfully updated username for user ID {$_SESSION['user_id']}");
echo json_encode(['success' => true]);
?>