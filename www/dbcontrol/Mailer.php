<?php
/*
Production Readiness:
For a live environment (e.g., sidjam.com), replace MailHog with a real SMTP server (e.g., Gmail, SendGrid):
php

$this->mail->Host = 'smtp.gmail.com';
$this->mail->Port = 587;
$this->mail->SMTPAuth = true;
$this->mail->SMTPSecure = 'tls';
$this->mail->Username = 'your-email@gmail.com';
$this->mail->Password = 'your-app-password';

*/
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require '/var/www/html/vendor/autoload.php';

class Mailer {
    private $mail;

    public function __construct() {
        $this->mail = new PHPMailer(true); // Enable exceptions
        try {
            // Server settings
            $this->mail->isSMTP();
            $this->mail->Host = 'sidjam-mailhog-1'; // MailHog container name
            $this->mail->Port = 1025; // MailHog SMTP port
            $this->mail->SMTPAuth = false; // No authentication for MailHog
            $this->mail->SMTPSecure = false; // No encryption for MailHog
            $this->mail->SMTPAutoTLS = false; // Disable auto TLS

            // Sender and reply-to
            $this->mail->setFrom('noreply@sidjam.com', 'sID JAm');
            $this->mail->addReplyTo('noreply@sidjam.com', 'sID JAm');
        } catch (Exception $e) {
            error_log("Mailer setup failed: {$this->mail->ErrorInfo}");
            throw $e; // Re-throw to allow callers to handle
        }
    }

    public function send($to, $subject, $body) {
        try {
            // Recipient
            $this->mail->addAddress($to);

            // Content
            $this->mail->isHTML(false); // Plain text email
            $this->mail->Subject = $subject;
            $this->mail->Body = $body;

            error_log("Mailer: Attempting to send email to $to with subject: $subject");
            $this->mail->send();
            error_log("Mailer: Successfully sent email to $to");
            return true;
        } catch (Exception $e) {
            error_log("Mailer: Failed to send email to $to: {$this->mail->ErrorInfo}");
            return false;
        } finally {
            $this->mail->clearAddresses(); // Reset recipients
        }
    }
}
?>