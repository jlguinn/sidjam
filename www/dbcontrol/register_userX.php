<?php
// Enable error logging, disable display
ini_set('display_errors', 0);
ini_set('log_errors', 1);
// Use a Windows-friendly path (adjust based on your project directory)
$log_dir = dirname(__DIR__) . '/logs'; // Assuming 'logs' folder in project root
$log_file = $log_dir . '/php_errors.log';
if (!file_exists($log_dir)) {
    mkdir($log_dir, 0777, true); // Create logs directory if it doesn't exist
}
if (!file_exists($log_file)) {
    file_put_contents($log_file, ''); // Create empty log file
    chmod($log_file, 0666); // Make it writable
}
ini_set('error_log', $log_file);
error_reporting(E_ALL);

error_log("Starting register_user.php at " . date('Y-m-d H:i:s'));

ob_start();

include_once "sidcon.php";
$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("Connection failed: " . mysqli_connect_error());
    header('Content-Type: application/json');
    die(json_encode(["error" => "Connection failed: " . mysqli_connect_error()]));
}

error_log("Connected to database");

$data = json_decode(file_get_contents("php://input"), true);
$user_id = $data['user_id'] ?? 0;
$email = $data['email'] ?? '';
$username = $data['username'] ?? '';

if ($user_id == 0 || empty($email) || empty($username)) {
    error_log("Missing user_id, email, or username: user_id=$user_id, email=$email, username=$username");
    header('Content-Type: application/json');
    die(json_encode(["error" => "Missing user_id, email, or username"]));
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    error_log("Invalid email format: $email");
    header('Content-Type: application/json');
    die(json_encode(["error" => "Invalid email format"]));
}

error_log("Input validated: user_id=$user_id, email=$email, username=$username");

// Update siduser with email, username, and is_registered
$stmt = $cxn->prepare("UPDATE siduser SET email = ?, UserName = ?, is_registered = 1 WHERE user_id = ?");
if (!$stmt) {
    error_log("Prepare failed for update: " . $cxn->error);
    header('Content-Type: application/json');
    die(json_encode(["error" => "Prepare failed: " . $cxn->error]));
}
$stmt->bind_param("ssi", $email, $username, $user_id);
if (!$stmt->execute()) {
    error_log("Execute failed for update: " . $stmt->error);
    header('Content-Type: application/json');
    die(json_encode(["error" => "Execute failed: " . $stmt->error]));
}
$stmt->close();

error_log("Database updated successfully");

$cxn->close();
error_log("Database connection closed");

ob_end_clean();
header('Content-Type: application/json');
echo json_encode(["success" => true]);
error_log("Script completed successfully at " . date('Y-m-d H:i:s'));
?>