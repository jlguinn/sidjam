<?php
include_once "sidcon.php";
$cxn = mysqli_connect($host, $user, $pass, $database) or die(json_encode(["error" => "Connection failed"]));

// Get parameters
$filter = isset($_GET['filter']) ? $_GET['filter'] : '';
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
$full_list = isset($_GET['full_list']) && $_GET['full_list'] === 'true';
$wins = isset($_GET['wins']) ? (int)$_GET['wins'] : -1;
$losses = isset($_GET['losses']) ? (int)$_GET['losses'] : -1;
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

// Use prepared statements for safety
if ($full_list) {
    $query = "SELECT sid_id, fullpath FROM sidtunes";
    if ($filter !== '') {
        $query .= " WHERE fullpath LIKE ?";
        $stmt = $cxn->prepare($query);
        $filterParam = "%$filter%";
        $stmt->bind_param("s", $filterParam);
    } else {
        $stmt = $cxn->prepare($query);
    }
} else {
    $query = "SELECT a.fullpath FROM sidtunes a";
    $conditions = [];
    $params = [];
    $types = "";

    if ($filter !== '') {
        $conditions[] = "a.fullpath LIKE ?";
        $params[] = "%$filter%";
        $types .= "s";
    }
    if ($wins >= 0 && $losses >= 0 && $user_id > 0) {
        $query .= " LEFT JOIN (SELECT sid_id, SUM(win) as wins, SUM(loss) as losses 
                       FROM sidjam 
                       WHERE user_id = ? 
                       GROUP BY sid_id) s ON a.sid_id = s.sid_id";
        $params[] = $user_id;
        $types .= "i";
        if ($wins === 0 && $losses === 0) {
            $conditions[] = "((s.wins = 0 AND s.losses = 0) OR (s.wins IS NULL AND s.losses IS NULL))";
        } else {
            $conditions[] = "(s.wins = ? AND s.losses = ?)";
            $params[] = $wins;
            $params[] = $losses;
            $types .= "ii";
        }
    } else if ($losses === 2 && $user_id > 0) {
        $query .= " LEFT JOIN (SELECT sid_id, SUM(win) as wins, SUM(loss) as losses 
                       FROM sidjam 
                       WHERE user_id = ? 
                       GROUP BY sid_id) s ON a.sid_id = s.sid_id";
        $params[] = $user_id;
        $types .= "i";
        $conditions[] = "(s.losses >= 2)";
    }
    if (!empty($conditions)) {
        $query .= " WHERE " . implode(" AND ", $conditions);
    }
    $query .= " LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    $types .= "ii";

    $stmt = $cxn->prepare($query);
    if (!$stmt) {
        die(json_encode(["error" => "Prepare failed: " . $cxn->error]));
    }
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
}

$stmt->execute();
$result = $stmt->get_result();
$files = [];
if ($full_list) {
    while ($row = $result->fetch_assoc()) {
        $files[] = ['id' => (int)$row['sid_id'], 'fullpath' => $row['fullpath']];
    }
} else {
    while ($row = $result->fetch_assoc()) {
        $files[] = $row['fullpath'];
    }
}
$stmt->close();
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