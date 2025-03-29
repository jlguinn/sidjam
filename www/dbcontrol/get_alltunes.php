<?php
include_once "sidcon.php";
$cxn = mysqli_connect($host, $user, $pass, $database) or die(json_encode(["error" => "Connection failed"]));

// Get parameters
$filter = isset($_GET['filter']) ? $_GET['filter'] : '';
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
$full_list = isset($_GET['full_list']) && $_GET['full_list'] === 'true';

$filter = mysqli_real_escape_string($cxn, $filter);

// Build the query
$query = "SELECT fullpath FROM alltunes";
if ($filter !== '') {
    $query .= " WHERE fullpath LIKE '%$filter%'";
}

if (!$full_list) {
    $query .= " LIMIT $limit OFFSET $offset";
}

$result = mysqli_query($cxn, $query) or die(json_encode(["error" => "Query failed: " . mysqli_error($cxn)]));
$files = [];
while ($row = mysqli_fetch_assoc($result)) {
    $files[] = $row['fullpath'];
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