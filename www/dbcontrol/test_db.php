<?php
include_once "../dbcontrol/sidcon.php";
$cxn = mysqli_connect($host, $user, $pass, $database) or die("Could not connect to $host: " . mysqli_connect_error());
echo "Connected successfully!";
mysqli_close($cxn);
?>