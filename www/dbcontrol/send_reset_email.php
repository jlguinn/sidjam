<?php
session_start();
require_once "sidcon.php";
require_once "Mailer.php";
header('Content-Type: application/json');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

$email = isset($_POST['email']) ? trim($_POST['email']) : '';

if (empty($email)) {
    error_log("Send Reset Email: Missing email");
    echo json_encode(['success' => false, 'message' => 'Email is required']);
    exit;
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    error_log("Send Reset Email: Invalid email format: $email");
    echo json_encode(['success' => false, 'message' => 'Invalid email format']);
    exit;
}

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("Send Reset Email: Database connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

// Check if the email exists
$stmt = $cxn->prepare("SELECT user_id FROM siduser WHERE email = ?");
if (!$stmt) {
    error_log("Send Reset Email: Prepare statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    $cxn->close();
    exit;
}
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
$user_id = $user ? $user['user_id'] : null;
$stmt->close();

// Always return a success message to avoid revealing if the email exists
$response = ['success' => true, 'message' => 'If this email address was registered, a password reset link will be sent.'];

// If the email exists, generate a reset token and send the email
if ($user_id) {
    // Generate a reset token
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+1 hour')); // Token expires in 1 hour

    // Store the token in the database
    $stmt = $cxn->prepare("INSERT INTO password_resets (user_id, token, expires) VALUES (?, ?, ?)");
    if (!$stmt) {
        error_log("Send Reset Email: Prepare token insert failed: " . $cxn->error);
        echo json_encode(['success' => false, 'message' => 'Database error']);
        $cxn->close();
        exit;
    }
    $stmt->bind_param("iss", $user_id, $token, $expires);
    $stmt->execute();
    $stmt->close();

    // Send the reset email
    $reset_link = "http://localhost:8080/help/reset_password.php?token=$token"; // Updated path to /help/
    $subject = "sID JAm - Password Reset Request";
    $body = "A password reset for the sID JAm account associated with this e-mail has been requested. You can click the link below to reset your password:\n\n$reset_link\n\nThis link will expire in 1 hour. If did not make this request or otherwise no longer need a password change, you may ignore this request. You can visit https://sidjam.com to access your account or learn more about sID JAm.";
    
    $mailer = new Mailer();
    error_log("Send Reset Email: Sending reset email to $email");
    if (!$mailer->send($email, $subject, $body)) {
        error_log("Send Reset Email: Failed to send reset email to $email");
        // Still return the success message to avoid revealing the failure
    } else {
        error_log("Send Reset Email: Successfully sent reset email to $email");
    }
}

$cxn->close();
echo json_encode($response);
?>