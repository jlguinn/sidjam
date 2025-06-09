<?php
session_start();
$sidconPath = file_exists(__DIR__ . '/../../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/sidcon.php';

require_once $sidconPath;
require_once "Mailer.php";
header('Content-Type: application/json');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

if (!isset($_SESSION['user_id'])) {
    error_log("Update Email: User not logged in");
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$newEmail = isset($_POST['newEmail']) ? trim($_POST['newEmail']) : '';
$confirmPassword = isset($_POST['confirmPassword']) ? $_POST['confirmPassword'] : '';

if (empty($newEmail) || empty($confirmPassword)) {
    error_log("Update Email: Missing required fields");
    echo json_encode(['success' => false, 'message' => 'All fields are required']);
    exit;
}

// Validate email format
if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
    error_log("Update Email: Invalid email format: $newEmail");
    echo json_encode(['success' => false, 'message' => 'Invalid email format']);
    exit;
}

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("Update Email: Database connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

// Check if the new email is already in use
$stmt = $cxn->prepare("SELECT user_id FROM siduser WHERE email = ? AND user_id != ?");
if (!$stmt) {
    error_log("Update Email: Prepare statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    $cxn->close();
    exit;
}
$stmt->bind_param("si", $newEmail, $_SESSION['user_id']);
$stmt->execute();
if ($stmt->get_result()->num_rows > 0) {
    error_log("Update Email: Email already in use: $newEmail");
    echo json_encode(['success' => false, 'message' => 'Email already in use']);
    $stmt->close();
    $cxn->close();
    exit;
}
$stmt->close();

// Verify the current password and get the old email
$stmt = $cxn->prepare("SELECT email, password FROM siduser WHERE user_id = ?");
if (!$stmt) {
    error_log("Update Email: Prepare statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    $cxn->close();
    exit;
}
$stmt->bind_param("i", $_SESSION['user_id']);
$stmt->execute();
$result = $stmt->get_result()->fetch_assoc();

if (!$result || !password_verify($confirmPassword, $result['password'])) {
    error_log("Update Email: Incorrect password for user ID {$_SESSION['user_id']}");
    echo json_encode(['success' => false, 'message' => 'Incorrect password']);
    $stmt->close();
    $cxn->close();
    exit;
}

$oldEmail = $result['email'];
$stmt->close();

// Update the email
$stmt = $cxn->prepare("UPDATE siduser SET email = ? WHERE user_id = ?");
if (!$stmt) {
    error_log("Update Email: Prepare update statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    $cxn->close();
    exit;
}
$stmt->bind_param("si", $newEmail, $_SESSION['user_id']);
$stmt->execute();
$stmt->close();

// Update session email
$_SESSION['email'] = $newEmail;

// Send email notifications to both old and new email addresses
$mailer = new Mailer($awsAccessKeyId, $awsSecretAccessKey, $awsRegion, $sesSenderEmail, $sesSenderName);

// Notify the old email
$subject = "sID JAm - Email Address Changed";
$body = "Your email address has been changed to $newEmail. You can click the profile image on https://sidjam.com to access additional sign in and user registration settings.\nThank you for using sID JAm!";
error_log("Update Email: Sending email notification to old email $oldEmail");
if (!$mailer->send($oldEmail, $subject, $body)) {
    error_log("Update Email: Email notification failed for old email $oldEmail");
}

// Notify the new email
$body = "Your email address has been updated to $newEmail. You can click the profile image on https://sidjam.com to access additional sign in and user registration settings.\nThank you for using sID JAm!";
error_log("Update Email: Sending email notification to new email $newEmail");
if (!$mailer->send($newEmail, $subject, $body)) {
    error_log("Update Email: Email notification failed for new email $newEmail");
}

$cxn->close();
error_log("Update Email: Successfully updated email for user ID {$_SESSION['user_id']}");
echo json_encode(['success' => true]);
?>