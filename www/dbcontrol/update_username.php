<?php
session_start();
$sidconPath = file_exists(__DIR__ . '/../../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/sidcon.php';

require_once $sidconPath;
// Correctly include autoload.php if not already done by a main entry script
require_once __DIR__ . '/../vendor/autoload.php'; // Adjust this path if your vendor is located elsewhere

require_once "Mailer.php"; // Load your updated Mailer class
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
    echo json_encode(['success' => false, 'message' => 'Username is required']);
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

$stmt = $cxn->prepare("SELECT user_id FROM siduser WHERE UserName = ? AND user_id != ?");
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
$email = $result['email']; // Get the user's email before updating the username
$stmt->close();

$stmt = $cxn->prepare("UPDATE siduser SET UserName = ? WHERE user_id = ?");
if (!$stmt) {
    error_log("Update Username: Prepare update statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    exit;
}
$stmt->bind_param("si", $newUsername, $_SESSION['user_id']);
$stmt->execute();
$stmt->close();

// --- SES Email Sending for Username Update Notification ---
$subject = "sID JAm - User Name Updated";
$bodyHtml = "
    <p>Hello,</p>
    <p>The user name for the sID JAm account registered to this e-mail address has been successfully updated.</p>
    <p>You can click the profile image on <a href=\"https://sidjam.com\">https://sidjam.com</a> to access additional sign in and user registration settings.</p>
    <p>Thank you for using sID JAm!</p>
";
$bodyText = "Hello,\n\nThe user name for the sID JAm account registered to this e-mail address has been successfully updated.\nYou can click the profile image on https://sidjam.com to access additional sign in and user registration settings.\nThank you for using sID JAm!";

// Initialize Mailer with SES credentials from sidcon.php
// These variables ($awsAccessKeyId, etc.) are loaded from require_once $sidconPath;
$mailer = new Mailer($awsAccessKeyId, $awsSecretAccessKey, $awsRegion, $sesSenderEmail, $sesSenderName);

error_log("Update Username: Sending email notification to $email");
// Use the updated bodyHtml for sending, and indicate it's HTML
if (!$mailer->send($email, $subject, $bodyHtml, true)) {
    error_log("Update Username: Email notification failed for username update to $email");
} else {
    error_log("Update Username: Successfully sent username update notification to $email");
}

$cxn->close();
error_log("Update Username: Successfully updated username for user ID {$_SESSION['user_id']}");
echo json_encode(['success' => true]);
?>