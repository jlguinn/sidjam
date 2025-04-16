<?php
session_start();
require_once "sidcon.php";
header('Content-Type: application/json');

ini_set('display_errors', 0);
ini_set('log_errors', 1);

$user_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
if ($user_id === 0) {
    error_log("SaveState: No user_id in session");
    echo json_encode(['success' => false, 'message' => 'User not authenticated']);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
$player_state = isset($data['player_state']) ? $data['player_state'] : null;

if (!$player_state) {
    error_log("SaveState: No player_state provided for user_id $user_id");
    echo json_encode(['success' => false, 'message' => 'No state data provided']);
    exit;
}

// Validate player_state structure
if (!is_array($player_state) ||
    !isset($player_state['contenders'], $player_state['peekBracket'], $player_state['activeBracket'], 
           $player_state['currentMode'], $player_state['theme']) ||
    !is_array($player_state['contenders']) ||
    !is_string($player_state['peekBracket']) ||
    !is_string($player_state['activeBracket']) ||
    !is_string($player_state['currentMode']) ||
    !is_numeric($player_state['theme']) ||
    !in_array($player_state['currentMode'], ['bout', 'nowPlaying']) ||
    (isset($player_state['nowPlayingSong']) && !is_string($player_state['nowPlayingSong']) && !is_null($player_state['nowPlayingSong']))
) {
    error_log("SaveState: Invalid player_state format for user_id $user_id: " . json_encode($player_state));
    echo json_encode(['success' => false, 'message' => 'Invalid state format']);
    exit;
}

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("SaveState: Connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => 'Connection failed']);
    exit;
}

$player_state_json = json_encode($player_state);
$stmt = $cxn->prepare("UPDATE siduser SET player_state = ? WHERE user_id = ?");
$stmt->bind_param("si", $player_state_json, $user_id);

if ($stmt->execute()) {
    error_log("SaveState: Successfully saved state for user_id $user_id");
    echo json_encode(['success' => true]);
} else {
    error_log("SaveState: Failed to save state for user_id $user_id: " . $stmt->error);
    echo json_encode(['success' => false, 'message' => 'Failed to save state']);
}

$stmt->close();
$cxn->close();
?>