<?php
include_once "../dbcontrol/sidcon.php";

$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    die("Connection failed: " . mysqli_connect_error());
}

$user_id = 1;
$stmt = $cxn->prepare("SELECT a.fullpath, SUM(s.win) as wins, SUM(s.loss) as losses FROM sidjam s JOIN sidtunes a ON s.id = a.id WHERE s.user_id = ? GROUP BY s.id, a.fullpath");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();
$results = (object)[];
while ($row = $result->fetch_assoc()) {
    $results->{$row['fullpath']} = ["wins" => (int)$row['wins'], "losses" => (int)$row['losses']];
}
$stmt->close();
$cxn->close();

header('Content-Type: application/json');
echo json_encode($results);

if (is_object($results)) {
    echo "\nTest passed: Returned valid results object";
} else {
    echo "\nTest failed: Expected object, got " . gettype($results);
}
?>