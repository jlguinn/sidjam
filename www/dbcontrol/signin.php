<?php
session_start();
$sidconPath = file_exists(__DIR__ . '/../../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/sidcon.php';

require_once $sidconPath;
header('Content-Type: application/json');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$password = isset($_POST['password']) ? $_POST['password'] : '';

if (empty($email) || empty($password)) {
    error_log("Signin: Missing required fields");
    echo json_encode(['success' => false, 'message' => 'Email and password are required']);
    exit;
}

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("Signin: Database connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

// Check if the email exists and get the password hash
$stmt = $cxn->prepare("SELECT user_id, UserName, email, password FROM siduser WHERE email = ?");
if (!$stmt) {
    error_log("Signin: Prepare statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    $cxn->close();
    exit;
}
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

if (!$user || !password_verify($password, $user['password'])) {
    error_log("Signin: Invalid email or password for email $email");
    echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
    $stmt->close();
    $cxn->close();
    exit;
}

// Update session data
$user_id = $user['user_id'];
$new_session_id = bin2hex(random_bytes(16));
$_SESSION['user_id'] = $user_id;
$_SESSION['username'] = $user['UserName']; // Updated key to match schema
$_SESSION['email'] = $user['email'];
$_SESSION['session_id'] = $new_session_id;

// Update session_id and last access date in siduser
$stmt = $cxn->prepare("UPDATE siduser SET session_id = ?, LastAccessDate = CURDATE() WHERE user_id = ?");
if (!$stmt) {
    error_log("Signin: Prepare update statement failed: " . $cxn->error);
    echo json_encode(['success' => false, 'message' => 'Database error']);
    $cxn->close();
    exit;
}
$stmt->bind_param("si", $new_session_id, $user_id);
$stmt->execute();
$stmt->close();

// Set the session_id cookie
setcookie('session_id', $new_session_id, time() + (30 * 24 * 60 * 60), "/");

$cxn->close();

error_log("Signin: Successfully signed in user ID {$user_id}");
echo json_encode(['success' => true]);
?>