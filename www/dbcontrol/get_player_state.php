<?php
// Suppress error output to the response
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once "sidcon.php";

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "Connection failed: " . mysqli_connect_error()]));
}

$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
if ($user_id == 0) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "No user_id provided"]));
}

$stmt = $cxn->prepare("SELECT player_state FROM siduser WHERE user_id = ?");
if (!$stmt) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "Prepare failed: " . $cxn->error]));
}
$stmt->bind_param("i", $user_id);
if (!$stmt->execute()) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "Execute failed: " . $stmt->error]));
}

$result = $stmt->get_result();
$player_state = null;
if ($row = $result->fetch_assoc()) {
    $player_state = $row['player_state'] ? json_decode($row['player_state'], true) : null;
}

$stmt->close();
$cxn->close();

header('Content-Type: application/json');
echo json_encode([
    "success" => true,
    "player_state" => $player_state
]);
?>