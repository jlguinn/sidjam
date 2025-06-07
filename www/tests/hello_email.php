<?php
// hello_email.php

// Error logging setup
ini_set('display_errors', 0); // Hide errors on screen
ini_set('log_errors', 1); // Enable error logging
ini_set('error_log', __DIR__ . '/email_errors.log'); // Log to a file
error_reporting(E_ALL);

// Email details
$recipients = [
    'jguinn@bonevalleyfilms.com', // Replace with your first email
    'guinnjl@twc.com' // Replace with your second email
];
$subject = 'Hello World from sID JAm - Test ' . date('Y-m-d H:i:s');
$body = 'This is a test email sent from sID JAm on GoDaddy at ' . date('Y-m-d H:i:s') . '.';
$headers = "From: noreply@sidjam.com\r\n";
$headers .= "Reply-To: support@sidjam.com\r\n";
$headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// Send email to each recipient
$results = [];
foreach ($recipients as $to) {
    if (filter_var($to, FILTER_VALIDATE_EMAIL)) {
        error_log("Attempting to send email to $to with subject: $subject");
        if (mail($to, $subject, $body, $headers)) {
            error_log("Successfully sent email to $to");
            $results[] = "Email to $to sent successfully!";
        } else {
            error_log("Failed to send email to $to");
            $results[] = "Email to $to failed to send.";
        }
    } else {
        error_log("Invalid email address: $to");
        $results[] = "Invalid email address: $to";
    }
}

// Display results
echo "<h2>Email Test Results</h2>";
echo "<ul>";
foreach ($results as $result) {
    echo "<li>$result</li>";
}
echo "</ul>";
echo "<p>Check <code>email_errors.log</code> in the same directory for detailed logs.</p>";
echo "<p>PHP Version: " . PHP_VERSION . "</p>";
echo "<p>Server: " . $_SERVER['SERVER_SOFTWARE'] . "</p>";
?>