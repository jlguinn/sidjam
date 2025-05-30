<?php
// dbcontrol/get_sidtunes.php
// Prevent HTML output from errors
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

$sidconPath = file_exists(__DIR__ . '/../../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/sidcon.php';

include_once $sidconPath;
$cxn = mysqli_connect($host, $user, $pass, $database) or die(json_encode(["error" => "Connection failed"]));

// Get parameters
$filter = isset($_GET['filter']) ? $_GET['filter'] : '';
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 0; // Default to 0 for no limit
$full_list = isset($_GET['full_list']) && $_GET['full_list'] === 'true';
$wins = isset($_GET['wins']) ? (int)$_GET['wins'] : -1;
$losses = isset($_GET['losses']) ? (int)$_GET['losses'] : -1;
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

// Log the request
error_log("Request: " . json_encode($_GET));

// Use prepared statements for safety
if ($full_list) {
    $query = "SELECT sid_id, fullpath FROM sidtunes";
    $params = [];
    $types = '';
    if ($filter !== '') {
        $query .= " WHERE fullpath LIKE ?";
        $params[] = $filter;
        $types .= 's';
    }
    $query .= " ORDER BY fullpath";
    if ($limit > 0) {
        $query .= " LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        $types .= 'ii';
    }

    $stmt = $cxn->prepare($query);
    if (!$stmt) {
        error_log("Prepare failed: " . $cxn->error);
        die(json_encode(["error" => "Prepare failed: " . $cxn->error]));
    }
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
} else {
    $query = "SELECT a.fullpath FROM sidtunes a";
    $conditions = [];
    $params = [];
    $types = "";

    // Add the LEFT JOIN first and add its parameter immediately
    if ($wins >= 0 && $losses >= 0 && $user_id > 0) {
        $query .= " LEFT JOIN (SELECT sid_id, SUM(win) as wins, SUM(loss) as losses 
                       FROM sidjam 
                       WHERE user_id = ? 
                       GROUP BY sid_id) s ON a.sid_id = s.sid_id";
        $params[] = $user_id;
        $types .= "i";
    } else if ($losses == 2 && $user_id > 0) {
        $query .= " LEFT JOIN (SELECT sid_id, SUM(win) as wins, SUM(loss) as losses 
                       FROM sidjam 
                       WHERE user_id = ? 
                       GROUP BY sid_id) s ON a.sid_id = s.sid_id";
        $params[] = $user_id;
        $types .= "i";
    }

    // Now add conditions and their parameters
    if ($filter !== '') {
        $conditions[] = "a.fullpath LIKE ?";
        $params[] = $filter;
        $types .= "s";
    }

    if ($wins >= 0 && $losses >= 0 && $user_id > 0) {
        if ($wins == 0 && $losses == 0) {
            $conditions[] = "((s.wins = 0 AND s.losses = 0) OR (s.wins IS NULL AND s.losses IS NULL))";
        } else {
            $conditions[] = "(s.wins = ? AND s.losses = ?)";
            $params[] = $wins;
            $params[] = $losses;
            $types .= "ii";
        }
    } else if ($losses == 2 && $user_id > 0) {
        $conditions[] = "(s.losses >= 2)";
    } else {
        // For user_id = 0 (Guest User), don't join with sidjam
        if ($filter !== '') {
            $conditions[] = "a.fullpath LIKE ?";
            $params[] = $filter;
            $types .= "s";
        }
    }

    if (!empty($conditions)) {
        $query .= " WHERE " . implode(" AND ", $conditions);
    }
    $query .= " ORDER BY a.fullpath";
    if ($limit > 0) {
        $query .= " LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        $types .= "ii";
    }

    $stmt = $cxn->prepare($query);
    if (!$stmt) {
        error_log("Prepare failed: " . $cxn->error);
        die(json_encode(["error" => "Prepare failed: " . $cxn->error]));
    }
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
}

// Log the query for debugging
error_log("Query: $query");
$encodedParams = json_encode($params);
if ($encodedParams === false) {
    error_log("Parameters: Unable to encode params - " . json_last_error_msg());
} else {
    error_log("Parameters: " . $encodedParams);
}
error_log("Types: $types");

$stmt->execute();
error_log("Executed query: $query");
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
error_log("Results count: " . count($files));
$stmt->close();
mysqli_close($cxn);

// Return the results
header('Content-Type: application/json');
if ($full_list) {
    echo json_encode($files);
} else {
    echo json_encode([
        'query' => $query,
        'files' => $files,
        'offset' => $offset,
        'limit' => $limit,
        'hasMore' => count($files) > 0 // Continue fetching if any files returned
    ]);
}
?>