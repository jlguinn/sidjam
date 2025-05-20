<?php
$sidconPath = file_exists(__DIR__ . '/../../../dbcontrol_sidjam/sidcon.php')
    ? __DIR__ . '/../../../dbcontrol_sidjam/sidcon.php'
    : __DIR__ . '/sidcon.php';

require_once $sidconPath;
$cxn = mysqli_connect($host, $user, $pass, $database) or die("Could not connect to $host: " . mysqli_connect_error());
echo "Connected successfully!";
mysqli_close($cxn);
?>