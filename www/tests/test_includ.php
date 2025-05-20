<?php
include_once __DIR__ . '/../dbcontrol/sidcon.php';
echo "host: " . (isset($host) ? $host : 'undefined') . "\n";
echo "user: " . (isset($user) ? $user : 'undefined') . "\n";
echo "pass: " . (isset($pass) ? 'defined' : 'undefined') . "\n";
echo "database: " . (isset($database) ? $database : 'undefined') . "\n";
?>