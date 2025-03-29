<?php
include_once "sidcon.php";
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

$stmt = $cxn->prepare("INSERT INTO sidjam (user_id, id, win, loss) VALUES (?, ?, ?, ?)");
if (!$stmt) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "Prepare failed: " . $cxn->error]));
}
$stmt->bind_param("iiii", $user_id, $id, $win, $loss);

foreach ($data['votes'] as $vote) {
    $id = $vote['id'] ?? 0;
    $increment = $vote['increment'] ?? 0;
    $win = $increment > 0 ? $increment : 0;
    $loss = $increment < 0 ? abs($increment) : 0;
    if (!$stmt->execute()) {
        header('Content-Type: application/json');
        die(json_encode(["error" => "Execute failed: " . $stmt->error]));
    }
}
$stmt->close();
$cxn->close();
header('Content-Type: application/json');
echo json_encode(["success" => true]);
?>