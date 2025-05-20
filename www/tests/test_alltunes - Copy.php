<?php
# include_once "../../../dbcontrol_sidjam/sidcon.php";
include_once "../dbcontrol/sidcon.php";


$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    die("Connection failed: " . mysqli_connect_error());
}

$stmt = $cxn->prepare("SELECT fullpath FROM sidtunes");
$stmt->execute();
$result = $stmt->get_result();
$songs = [];
while ($row = $result->fetch_assoc()) {
    $songs[] = $row['fullpath'];
}
$stmt->close();
$cxn->close();

header('Content-Type: application/json');
echo json_encode($songs);

if (count($songs) > 0 && is_array($songs)) {
    echo "\nTest passed: Returned " . count($songs) . " songs";
} else {
    echo "\nTest failed: No songs or invalid format";
}
?>