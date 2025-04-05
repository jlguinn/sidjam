<?php
include_once "sidcon.php";
$cxn = mysqli_connect($host, $user, $pass, $database) or die(json_encode(["error" => "Connection failed"]));

// Get parameters
$filter = isset($_GET['filter']) ? $_GET['filter'] : '';
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50; // Will be 500 from script.js
$full_list = isset($_GET['full_list']) && $_GET['full_list'] === 'true';
$wins = isset($_GET['wins']) ? (int)$_GET['wins'] : -1;
$losses = isset($_GET['losses']) ? (int)$_GET['losses'] : -1;
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

$filter = mysqli_real_escape_string($cxn, $filter);

// Build the query
if ($full_list) {
    $query = "SELECT id, fullpath FROM alltunes";
    if ($filter !== '') {
        $query .= " WHERE fullpath LIKE '%$filter%'";
    }
} else {
    $query = "SELECT a.fullpath FROM alltunes a";
    $conditions = [];
    if ($filter !== '') {
        $conditions[] = "a.fullpath LIKE '%$filter%'";
    }
    if ($wins >= 0 && $losses >= 0 && $user_id > 0) {
        $query .= " LEFT JOIN (SELECT id, SUM(win) as wins, SUM(loss) as losses 
                       FROM sidjam 
                       WHERE user_id = $user_id 
                       GROUP BY id) s ON a.id = s.id";
        $conditions[] = "(s.wins = $wins AND s.losses = $losses)";
    } else if ($losses === 2 && $user_id > 0) { // Special case for "Eliminated Contenders"
        $query .= " LEFT JOIN (SELECT id, SUM(win) as wins, SUM(loss) as losses 
                       FROM sidjam 
                       WHERE user_id = $user_id 
                       GROUP BY id) s ON a.id = s.id";
        $conditions[] = "(s.losses >= 2)";
    }
    if (!empty($conditions)) {
        $query .= " WHERE " . implode(" AND ", $conditions);
    }
    $query .= " LIMIT $limit OFFSET $offset";
}

$result = mysqli_query($cxn, $query) or die(json_encode(["error" => "Query failed: " . mysqli_error($cxn)]));
$files = [];
if ($full_list) {
    while ($row = mysqli_fetch_assoc($result)) {
        $files[] = ['id' => (int)$row['id'], 'fullpath' => $row['fullpath']];
    }
} else {
    while ($row = mysqli_fetch_assoc($result)) {
        $files[] = $row['fullpath'];
    }
}
mysqli_close($cxn);

// Return the results
header('Content-Type: application/json');
if ($full_list) {
    echo json_encode($files);
} else {
    echo json_encode([
        'files' => $files,
        'offset' => $offset,
        'limit' => $limit,
        'hasMore' => count($files) === $limit
    ]);
}
?>