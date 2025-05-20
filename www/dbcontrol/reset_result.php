<?php
$sidconPath = file_exists(__DIR__ . '/../../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/sidcon.php';

include_once $sidconPath;
$cxn = mysqli_connect($host, $user, $pass, $database) or die(json_encode(["error" => "Connection failed"]));

$data = json_decode(file_get_contents("php://input"), true);
$sid_id = $data['id'] ?? 0; // Updated variable name for clarity
$user_id = $data['user_id'] ?? 0; // Assume user_id is sent
if ($sid_id == 0 || $user_id == 0) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "Invalid id or user_id"]));
}

$stmt = $cxn->prepare("UPDATE sidjam SET win = 0, loss = 0 WHERE user_id = ? AND sid_id = ?");
$stmt->bind_param("ii", $user_id, $sid_id);
if ($stmt->execute()) {
    header('Content-Type: application/json');
    echo json_encode(["success" => true]);
} else {
    header('Content-Type: application/json');
    echo json_encode(["error" => "Reset failed: " . $stmt->error]);
}
$stmt->close();
$cxn->close();
?>