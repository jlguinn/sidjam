<?php
include_once "sidcon.php";
$cxn = mysqli_connect($host, $user, $pass, $database) or die(json_encode(["error" => "Connection failed"]));
$user_id = $_GET['user_id'] ?? 0; // Get from client
if ($user_id == 0) die(json_encode(["error" => "No user_id provided"]));

$stmt = $cxn->prepare("SELECT a.fullpath, SUM(s.win) as wins, SUM(s.loss) as losses
                       FROM sidjam s
                       JOIN alltunes a ON s.id = a.id
                       WHERE s.user_id = ?
                       GROUP BY s.id, a.fullpath");
if (!$stmt) {
    error_log("get_results.php: Prepare statement failed: " . $cxn->error);
    die(json_encode(["error" => "Prepare statement failed"]));
}
$stmt->bind_param("i", $user_id);
if (!$stmt->execute()) {
    error_log("get_results.php: Execute failed: " . $stmt->error);
    die(json_encode(["error" => "Execute failed"]));
}
$result = $stmt->get_result();
$results = (object)[];
while ($row = $result->fetch_assoc()) {
    $results->{$row['fullpath']} = ["wins" => (int)$row['wins'], "losses" => (int)$row['losses']];
}
$stmt->close();
$cxn->close();
header('Content-Type: application/json');
echo json_encode($results);
?>