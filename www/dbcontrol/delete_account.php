<?php
session_start();
require_once "sidcon.php";
require_once "Mailer.php";
header('Content-Type: application/json');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

if (!isset($_SESSION['user_id'])) {
    error_log("Delete Account: User not logged in");
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$password = isset($_POST['password']) ? $_POST['password'] : '';

if (empty($password)) {
    error_log("Delete Account: Missing password");
    echo json_encode(['success' => false, 'message' => 'Password is required']);
    exit;
}

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("Delete Account: Database connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

// Verify the password and get the email
$stmt = $cxn->prepare("SELECT email, password FROM siduser WHERE user_id = ?");
if (!$stmt) {
    error_log("Delete Account: Prepare statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    $cxn->close();
    exit;
}
$stmt->bind_param("i", $_SESSION['user_id']);
$stmt->execute();
$result = $stmt->get_result()->fetch_assoc();

if (!$result || !password_verify($password, $result['password'])) {
    error_log("Delete Account: Incorrect password for user ID {$_SESSION['user_id']}");
    echo json_encode(['success' => false, 'message' => 'Incorrect password']);
    $stmt->close();
    $cxn->close();
    exit;
}

$email = $result['email'];
$stmt->close();

// Delete the user account
$stmt = $cxn->prepare("DELETE FROM siduser WHERE user_id = ?");
if (!$stmt) {
    error_log("Delete Account: Prepare delete statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    $cxn->close();
    exit;
}
$stmt->bind_param("i", $_SESSION['user_id']);
$stmt->execute();
$stmt->close();
$cxn->close();

// Send email notification
$mailer = new Mailer();
$subject = "sID JAm - Account Deleted";
$body = "Your sID JAm account has been deleted. If you did not request this, please contact support.";
error_log("Delete Account: Sending email notification to $email");
if (!$mailer->send($email, $subject, $body)) {
    error_log("Delete Account: Email notification failed for account deletion to $email");
}

// Destroy the session
session_unset();
session_destroy();

error_log("Delete Account: Successfully deleted account for user ID {$_SESSION['user_id']}");
echo json_encode(['success' => true]);
?>