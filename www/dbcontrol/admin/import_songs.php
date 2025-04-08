<?php
// Move to www to execute
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
include_once "../../dbcontrol/sidcon.php";
$cxn = mysqli_connect($host, $user, $pass, $database) or die("Connection failed: " . mysqli_connect_error());
$songs = json_decode(file_get_contents("songs.json"), true);
$stmt = $cxn->prepare("INSERT IGNORE INTO sidtunes (sid_id, fullpath) VALUES (?, ?)");
$stmt->bind_param("is", $id, $fullpath);
foreach ($songs as $index => $path) {
    $id = $index + 1; // 1-based IDs
    $fullpath = $path;
    $stmt->execute();
}
$stmt->close();
$cxn->close();
echo "Imported " . count($songs) . " songs into sidtunes.";
?>