<?php
session_start();
$sidconPath = file_exists(__DIR__ . '/../../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/sidcon.php';

require_once $sidconPath;

ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');

$user_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
if ($user_id === 0 || $user_id >= 1100) {
    error_log("GetRegisteredUsers: Unauthorized access attempt for user_id $user_id");
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("GetRegisteredUsers: Connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => 'Connection failed']);
    exit;
}

$query = "SELECT COUNT(*) AS user_count FROM siduser WHERE email IS NOT NULL";
$result = mysqli_query($cxn, $query);

if ($result) {
    $row = mysqli_fetch_assoc($result);
    $user_count = (int)$row['user_count'];
    error_log("GetRegisteredUsers: Successfully retrieved $user_count registered users for user_id $user_id");
    echo json_encode(['success' => true, 'user_count' => $user_count]);
} else {
    error_log("GetRegisteredUsers: Query failed: " . mysqli_error($cxn));
    echo json_encode(['success' => false, 'message' => 'Query failed']);
}

mysqli_free_result($result);
mysqli_close($cxn);
?>