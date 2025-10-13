<?php
header('Content-Type: application/json');
// Return counts of registered users and "active" users (users with sidjam entries)

$sidconPath = file_exists(__DIR__ . '/../../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/sidcon.php';

require_once $sidconPath;

// Expect $host, $user, $pass, $database to be defined in sidcon.php
$cxn = mysqli_connect($host, $user, $pass, $database);
if (!$cxn) {
    error_log("get_registered_users: DB connection failed: " . mysqli_connect_error());
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

// Total registered users (users with an email)
$user_count = 0;
$active_user_count = 0;

$res = $cxn->query("SELECT COUNT(*) AS cnt FROM siduser WHERE email IS NOT NULL");
if ($res) {
    $row = $res->fetch_assoc();
    $user_count = (int)($row['cnt'] ?? 0);
    $res->free();
} else {
    error_log("get_registered_users: Query failed (user_count): " . $cxn->error);
}

// Active users: users that have entries in sidjam and a non-null email
// Using the provided logic: count distinct usernames that have sidjam rows and non-null emails
$res2 = $cxn->query(
    "SELECT COUNT(*) AS cnt FROM (SELECT 1 AS ActiveUser FROM siduser u JOIN sidjam s ON u.user_id = s.user_id WHERE u.email IS NOT NULL GROUP BY u.UserName) x"
);
if ($res2) {
    $row2 = $res2->fetch_assoc();
    $active_user_count = (int)($row2['cnt'] ?? 0);
    $res2->free();
} else {
    // Fallback to DISTINCT username count if the above fails for any reason
    error_log("get_registered_users: Query failed (active_user_count), trying fallback: " . $cxn->error);
    $res3 = $cxn->query("SELECT COUNT(DISTINCT u.UserName) AS cnt FROM siduser u JOIN sidjam s ON u.user_id = s.user_id WHERE u.email IS NOT NULL");
    if ($res3) {
        $row3 = $res3->fetch_assoc();
        $active_user_count = (int)($row3['cnt'] ?? 0);
        $res3->free();
    }
}

$cxn->close();

echo json_encode([
    'success' => true,
    'user_count' => $user_count,
    'active_user_count' => $active_user_count
]);

?>