<?php
// Mailer.php
// Ensure this path is correct based on where your Composer vendor directory is relative to Mailer.php
// If Mailer.php is in public_html, and vendor is in public_html:
// require_once __DIR__ . '/vendor/autoload.php';
// If Mailer.php is in a subfolder like 'classes', and vendor is in public_html:
// require_once __DIR__ . '/../vendor/autoload.php';
// Using a relative path from the script that calls Mailer.php is generally safer:
require_once dirname(__DIR__, 1) . '/vendor/autoload.php'; // Adjust this path if your vendor is not in the parent of Mailer.php's directory


use Aws\Ses\SesClient;
use Aws\Exception\AwsException;

class Mailer
{
    private $sesClient;
    private $senderEmail;
    private $senderName;

    // Constructor to initialize the SES client with credentials
    public function __construct($awsAccessKeyId, $awsSecretAccessKey, $awsRegion, $senderEmail, $senderName)
    {
        $this->senderEmail = $senderEmail;
        $this->senderName = $senderName;

        try {
            $this->sesClient = new SesClient([
                'version' => 'latest',
                'region' => $awsRegion,
                'credentials' => [
                    'key' => $awsAccessKeyId,
                    'secret' => $awsSecretAccessKey,
                ],
                // Optional: Set a timeout for the API call (in seconds)
                'http' => [
                    'timeout' => 30,
                    'connect_timeout' => 10
                ]
            ]);
        } catch (AwsException $e) {
            error_log("Mailer Initialization Error: " . $e->getMessage());
            $this->sesClient = null; // Mark client as not initialized
        } catch (Exception $e) {
            error_log("Mailer Initialization Unexpected Error: " . $e->getMessage());
            $this->sesClient = null;
        }
    }

    /**
     * Sends an email using Amazon SES.
     *
     * @param string $toEmail The recipient's email address.
     * @param string $subject The email subject.
     * @param string $body The plain text or HTML body of the email.
     * @param bool $isHtml Whether the body is HTML (true) or plain text (false).
     * @return bool True on success, false on failure.
     */
    public function send($toEmail, $subject, $body, $isHtml = false)
    {
        if ($this->sesClient === null) {
            error_log("Mailer: SES client not initialized. Cannot send email to $toEmail.");
            return false;
        }

        try {
            $messageBody = [];
            if ($isHtml) {
                $messageBody['Html'] = ['Charset' => 'UTF-8', 'Data' => $body];
                $messageBody['Text'] = ['Charset' => 'UTF-8', 'Data' => strip_tags($body)]; // Generate plain text from HTML
            } else {
                $messageBody['Text'] = ['Charset' => 'UTF-8', 'Data' => $body];
            }

            $result = $this->sesClient->sendEmail([
                'Destination' => [
                    'ToAddresses' => [$toEmail],
                ],
                'Message' => [
                    'Body' => $messageBody,
                    'Subject' => [
                        'Charset' => 'UTF-8',
                        'Data' => $subject,
                    ],
                ],
                'Source' => $this->senderName . ' <' . $this->senderEmail . '>', // Formatted sender
                'ReplyToAddresses' => [$this->senderEmail], // Optional: Where replies go
            ]);

            error_log("Email sent successfully to $toEmail. Message ID: " . $result['MessageId']);
            return true;

        } catch (AwsException $e) {
            error_log("Mailer Send Error (AWS SDK): Failed to send email to $toEmail. Error: " . $e->getMessage());
            return false;
        } catch (Exception $e) {
            error_log("Mailer Send Error (Unexpected): Failed to send email to $toEmail. Error: " . $e->getMessage());
            return false;
        }
    }
}