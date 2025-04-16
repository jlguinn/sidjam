<?php
session_start();
require_once "sidcon.php";

ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');

$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
if ($user_id === 0) {
    error_log("GetPlayerState: No user_id provided");
    echo json_encode(['success' => false, 'message' => 'No user_id provided']);
    exit;
}

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("GetPlayerState: Connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => 'Connection failed']);
    exit;
}

$stmt = $cxn->prepare("SELECT player_state FROM siduser WHERE user_id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$player_state = null;
if ($row = $result->fetch_assoc()) {
    $player_state = $row['player_state'] ? json_decode($row['player_state'], true) : null;
    if ($player_state && (
        !is_array($player_state) ||
        !isset($player_state['contenders'], $player_state['peekBracket'], $player_state['activeBracket'],
               $player_state['currentMode'], $player_state['theme']) ||
        !is_array($player_state['contenders']) ||
        !is_string($player_state['peekBracket']) ||
        !is_string($player_state['activeBracket']) ||
        !is_string($player_state['currentMode']) ||
        !is_numeric($player_state['theme']) ||
        !in_array($player_state['currentMode'], ['bout', 'nowPlaying']) ||
        (isset($player_state['nowPlayingSong']) && !is_string($player_state['nowPlayingSong']) && !is_null($player_state['nowPlayingSong']))
    )) {
        error_log("GetPlayerState: Invalid player_state format for user_id $user_id: " . json_encode($player_state));
        $player_state = null;
    }
}

$stmt->close();
$cxn->close();

error_log("GetPlayerState: Successfully retrieved state for user_id $user_id");
echo json_encode(['success' => true, 'player_state' => $player_state]);
?>