<?php
// Suppress error output to the response
ini_set('display_errors', 0);
// Log errors to a file for debugging
ini_set('log_errors', 1);
ini_set('error_log', '/var/log/php_errors.log'); // Adjust path as needed

$sidconPath = file_exists(__DIR__ . '/../../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/sidcon.php';

include_once $sidconPath;
$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "Connection failed: " . mysqli_connect_error()]));
}

$data = json_decode(file_get_contents("php://input"), true);
$user_id = $data['user_id'] ?? 0;
if ($user_id == 0) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "No user_id provided"]));
}

if (!isset($data['votes']) || !is_array($data['votes']) || empty($data['votes'])) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "Invalid or empty votes data"]));
}

$stmt = $cxn->prepare("INSERT INTO sidjam (user_id, sid_id, win, loss) VALUES (?, ?, ?, ?) 
                       ON DUPLICATE KEY UPDATE win = win + VALUES(win), loss = loss + VALUES(loss)");
if (!$stmt) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "Prepare failed: " . $cxn->error]));
}
$stmt->bind_param("iiii", $user_id, $sid_id, $win, $loss);

// Process votes in a transaction for atomicity
$cxn->begin_transaction();
try {
    foreach ($data['votes'] as $vote) {
        $sid_id = $vote['id'] ?? 0;
        $increment = $vote['increment'] ?? 0;
        $win = $increment > 0 ? $increment : 0;
        $loss = $increment < 0 ? abs($increment) : 0;

        if ($sid_id == 0) {
            throw new Exception("Invalid song ID: $sid_id");
        }

        if (!$stmt->execute()) {
            throw new Exception("Execute failed: " . $stmt->error);
        }
    }
    $cxn->commit();
} catch (Exception $e) {
    $cxn->rollback();
    header('Content-Type: application/json');
    die(json_encode(["error" => $e->getMessage()]));
}

$stmt->close();
$cxn->close();
header('Content-Type: application/json');
echo json_encode(["success" => true]);
?>