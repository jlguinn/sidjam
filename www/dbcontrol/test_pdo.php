<?php
// test_pdo.php
$sidconPath = file_exists(__DIR__ . '/../../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/sidcon.php';

require_once $sidconPath;

ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: text/plain');

try {
    // Create PDO connection
    $pdo = new PDO("mysql:host=$host;dbname=$database", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Test query: List tables in the database
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // Output success message and tables
    echo "PDO connection successful!\n";
    echo "Database: $database\n";
    echo "Tables found:\n";
    if (empty($tables)) {
        echo "- None\n";
    } else {
        foreach ($tables as $table) {
            echo "- $table\n";
        }
    }

    error_log("TestPDO: Successful connection for database $database");
} catch (PDOException $e) {
    // Log and display error
    $error = "Connection failed: " . $e->getMessage();
    error_log("TestPDO: $error");
    echo $error;
} finally {
    // Close connection
    $pdo = null;
}
?>