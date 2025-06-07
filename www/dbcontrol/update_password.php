<?php
session_start();

// Paths to sidcon.php and vendor/autoload.php
// Assuming sidcon.php is truly one level above public_html (e.g., in /home/youruser/dbcontrol_sidjam/sidcon.php)
$sidconPath = __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'; // Adjust if path is different
if (!file_exists($sidconPath)) {
    // Fallback for local dev or if sidcon.php is in the same directory for testing
    $sidconPath = __DIR__ . '/sidcon.php';
}
require_once $sidconPath;

// This require_once for autoload.php should ideally be at the main entry point,
// but if this script is standalone, it's fine here.
// Adjust path relative to THIS script. If vendor is in www, and this script is in www, it's like this:
require_once __DIR__ . '/../vendor/autoload.php'; // Make sure this path is correct!

require_once "Mailer.php"; // Load your updated Mailer class
header('Content-Type: application/json');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

if (!isset($_SESSION['user_id'])) {
    error_log("Update Password: User not logged in");
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$currentPassword = isset($_POST['currentPassword']) ? $_POST['currentPassword'] : '';
$newPassword = isset($_POST['newPassword']) ? $_POST['newPassword'] : '';

if (empty($currentPassword) || empty($newPassword)) {
    error_log("Update Password: Missing required fields");
    echo json_encode(['success' => false, 'message' => 'All fields are required']);
    exit;
}

if (strlen($newPassword) < 8) {
    error_log("Update Password: New password too short");
    echo json_encode(['success' => false, 'message' => 'New password must be at least 8 characters long']);
    exit;
}

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("Update Password: Database connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

$stmt = $cxn->prepare("SELECT email, password FROM siduser WHERE user_id = ?");
if (!$stmt) {
    error_log("Update Password: Prepare statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    exit;
}
$stmt->bind_param("i", $_SESSION['user_id']);
$stmt->execute();
$result = $stmt->get_result()->fetch_assoc();

if (!$result || !password_verify($currentPassword, $result['password'])) {
    error_log("Update Password: Incorrect current password for user ID {$_SESSION['user_id']}");
    echo json_encode(['success' => false, 'message' => 'Current password is incorrect']);
    $stmt->close();
    $cxn->close();
    exit;
}

$hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
$stmt = $cxn->prepare("UPDATE siduser SET password = ? WHERE user_id = ?");
if (!$stmt) {
    error_log("Update Password: Prepare update statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    exit;
}
$stmt->bind_param("si", $hashedPassword, $_SESSION['user_id']);
$stmt->execute();
$stmt->close();

// --- SES Email Sending for Password Update Notification ---
$email = $result['email']; // The user's email address from the database query
$subject = "sID JAm - Password Updated";
$bodyHtml = "
    <p>Hello,</p>
    <p>The password for the sID JAm account registered to this e-mail address has been successfully updated.</p>
    <p>You can click the profile image on https://sidjam.com to access additional sign in and user registration settings.</p>
    <p>Thank you for using sID JAm!</p>
";
$bodyText = "Hello,\n\nThe password for the sID JAm account registered to this e-mail address has been successfully updated.\n\nYou can click the profile image on https://sidjam.com to access additional sign in and user registration settings.\n\nThank you for using sID JAm!";


// Initialize Mailer with SES credentials from sidcon.php
// These variables are loaded from require_once $sidconPath;
$mailer = new Mailer($awsAccessKeyId, $awsSecretAccessKey, $awsRegion, $sesSenderEmail, $sesSenderName);

error_log("Update Password: Sending email notification to $email");
// Use the updated bodyHtml for sending, and indicate it's HTML
if (!$mailer->send($email, $subject, $bodyHtml, true)) {
    error_log("Update Password: Email notification failed for password update to $email");
} else {
    error_log("Update Password: Successfully sent password update notification to $email");
}

$cxn->close();
error_log("Update Password: Successfully updated password for user ID {$_SESSION['user_id']}");
echo json_encode(['success' => true]);
?>