<?php
include_once "sidcon.php";
$cxn = mysqli_connect($host, $user, $pass, $database) or die(json_encode(["error" => "Connection failed"]));
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
$sid_id = isset($_GET['sid_id']) ? (int)$_GET['sid_id'] : 0;

if ($user_id == 0 || $sid_id == 0) {
    error_log("revive_song.php: Invalid user_id or sid_id");
    die(json_encode(["error" => "Invalid user_id or sid_id"]));
}

// Reset the song's win-loss record to 0-0
$query = "INSERT INTO sidjam (user_id, sid_id, win, loss) 
          VALUES (?, ?, 0, 0) 
          ON DUPLICATE KEY UPDATE win = 0, loss = 0";
$stmt = $cxn->prepare($query);
if (!$stmt) {
    error_log("revive_song.php: Prepare statement failed: " . $cxn->error);
    die(json_encode(["error" => "Prepare statement failed"]));
}
$stmt->bind_param("ii", $user_id, $sid_id);
if (!$stmt->execute()) {
    error_log("revive_song.php: Execute failed: " . $stmt->error);
    die(json_encode(["error" => "Execute failed"]));
}

$stmt->close();
$cxn->close();

header('Content-Type: application/json');
echo json_encode(["success" => true]);
?>