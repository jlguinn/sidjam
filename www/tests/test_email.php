<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require '../vendor/autoload.php';

$mail = new PHPMailer(true);

try {
    // Server settings
    $mail->isSMTP();
    $mail->Host = 'mailhog'; // Use the service name from docker-compose.yml
    $mail->Port = 1025; // MailHog's SMTP port
    $mail->SMTPAuth = false; // MailHog doesn't require authentication
    $mail->SMTPSecure = ''; // No encryption for MailHog

    // Recipients
    $mail->setFrom('noreply@sidjam.com', 'sID JAm');
    $mail->addAddress('test@example.com'); // This email won't be sent; MailHog will capture it

    // Content
    $mail->Subject = 'Test Email from sID JAm';
    $mail->Body    = 'This is a test email sent from sID JAm to verify the mail server setup.';

    $mail->send();
    echo 'Email sent successfully! Check MailHog at http://localhost:8025.';
} catch (Exception $e) {
    echo "Failed to send email. Error: {$mail->ErrorInfo}";
}
?>