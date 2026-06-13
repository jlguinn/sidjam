// Email notifications. Production sends via SES using the Lambda execution
// role (no stored keypair - replaces the IAM key in sidcon.php). Locally
// (MAIL_MODE=local) messages are appended to a log file for the diff harness
// to inspect; like the PHP reference, send failures never fail the request.
import { stripTags } from './php.mjs';

const SENDER_EMAIL = process.env.SES_SENDER_EMAIL ?? 'admin@sidjam.com';
const SENDER_NAME = process.env.SES_SENDER_NAME ?? 'sID JAm';

export async function sendMail(toEmail, subject, body, isHtml = false) {
    if (process.env.MAIL_MODE === 'local') {
        const { appendFile } = await import('node:fs/promises');
        const entry = JSON.stringify({ to: toEmail, subject, isHtml, body }) + '\n';
        await appendFile(process.env.MAIL_LOG ?? '/tmp/sidjam_mail.log', entry).catch(() => {});
        return true;
    }
    try {
        const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
        const ses = new SESClient({});
        const Body = isHtml
            ? { Html: { Charset: 'UTF-8', Data: body }, Text: { Charset: 'UTF-8', Data: stripTags(body) } }
            : { Text: { Charset: 'UTF-8', Data: body } };
        await ses.send(new SendEmailCommand({
            Destination: { ToAddresses: [toEmail] },
            Message: { Body, Subject: { Charset: 'UTF-8', Data: subject } },
            Source: `${SENDER_NAME} <${SENDER_EMAIL}>`,
            ReplyToAddresses: [SENDER_EMAIL],
        }));
        return true;
    } catch (e) {
        console.error(`sendMail failed for ${toEmail}: ${e.message}`);
        return false;
    }
}
