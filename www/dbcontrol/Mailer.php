<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require '/var/www/html/vendor/autoload.php';

class Mailer {
    private $mail;

    public function __construct() {
        $this->mail = new PHPMailer(true);
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
        }
    }

    public function send($to, $subject, $body) {
        try {
            // Recipient
            $this->mail->addAddress($to);

            // Content
            $this->mail->isHTML(false);
            $this->mail->Subject = $subject;
            $this->mail->Body = $body;

            error_log("Attempting to send email to $to with subject: $subject");
            $this->mail->send();
            error_log("Successfully sent email to $to");
            return true;
        } catch (Exception $e) {
            error_log("Failed to send email to $to: {$this->mail->ErrorInfo}");
            return false;
        } finally {
            $this->mail->clearAddresses();
        }
    }
}
?>