<?php
session_start();
require_once "sidcon.php";
require_once "Mailer.php";
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

$email = $result['email'];
$subject = "sID JAm - Password Updated";
$body = "Your password has been updated. If you did not request this change, please contact support.";
$mailer = new Mailer();
error_log("Update Password: Sending email notification to $email");
if (!$mailer->send($email, $subject, $body)) {
    error_log("Update Password: Email notification failed for password update to $email");
}

$cxn->close();
error_log("Update Password: Successfully updated password for user ID {$_SESSION['user_id']}");
echo json_encode(['success' => true]);
?>