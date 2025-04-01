<?php
include_once "sidcon.php";
$cxn = mysqli_connect($host, $user, $pass, $database) or die(json_encode(["error" => "Connection failed"]));

$data = json_decode(file_get_contents("php://input"), true);
$id = $data['id'] ?? 0;
$user_id = $data['user_id'] ?? 0; // Assume user_id is sent
if ($id == 0 || $user_id == 0) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "Invalid id or user_id"]));
}

$stmt = $cxn->prepare("UPDATE sidjam SET win = 0, loss = 0 WHERE user_id = ? AND id = ?");
$stmt->bind_param("ii", $user_id, $id);
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