// Email notifications. Production sends via SES using the Lambda execution
// role (no stored keypair - replaces the IAM key in sidcon.php). Locally
// (MAIL_MODE=local) messages are appended to a log file for the diff harness
// to inspect; like the PHP reference, send failures never fail the request.
import { stripTags, validateEmail } from './php.mjs';

const SENDER_EMAIL = process.env.SES_SENDER_EMAIL ?? 'admin@sidjam.com';
const SENDER_NAME = process.env.SES_SENDER_NAME ?? 'sID JAm';

// Has this address already hard-bounced? SES drops sends to a suppressed
// destination on its own, but it still books the attempt as a bounce and still
// emits the notification that lands in the admin inbox - so ask first and skip
// the send entirely. Fails OPEN: a suppression-API hiccup must never stop real
// mail (same principle as sendMail itself never failing a request).
let sesv2;
async function isSuppressed(toEmail) {
    try {
        const { SESv2Client, GetSuppressedDestinationCommand } = await import('@aws-sdk/client-sesv2');
        sesv2 ??= new SESv2Client({});
        await sesv2.send(new GetSuppressedDestinationCommand({ EmailAddress: toEmail.trim().toLowerCase() }));
        return true;
    } catch (e) {
        // NotFoundException is the ordinary "clean address" answer, not an error
        if (e?.name === 'NotFoundException') return false;
        console.error(`suppression check failed for ${toEmail}: ${e.message}`);
        return false;
    }
}

export async function sendMail(toEmail, subject, body, isHtml = false) {
    // Last line of defence for every send path: an address no MTA can accept is
    // a guaranteed bounce, so never hand it to SES even if some caller skipped
    // its own validation.
    if (!validateEmail(toEmail ?? '')) {
        console.warn(`[MAIL] skipped ${toEmail} | "${subject}" | invalid address`);
        return false;
    }
    if (process.env.MAIL_MODE === 'local') {
        const { appendFile } = await import('node:fs/promises');
        const entry = JSON.stringify({ to: toEmail, subject, isHtml, body }) + '\n';
        await appendFile(process.env.MAIL_LOG ?? '/tmp/sidjam_mail.log', entry).catch(() => {});
        return true;
    }
    if (await isSuppressed(toEmail)) {
        console.warn(`[MAIL] skipped ${toEmail} | "${subject}" | on SES suppression list`);
        return false;
    }
    try {
        const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
        const ses = new SESClient({});
        const Body = isHtml
            ? { Html: { Charset: 'UTF-8', Data: body }, Text: { Charset: 'UTF-8', Data: stripTags(body) } }
            : { Text: { Charset: 'UTF-8', Data: body } };
        const res = await ses.send(new SendEmailCommand({
            Destination: { ToAddresses: [toEmail] },
            Message: { Body, Subject: { Charset: 'UTF-8', Data: subject } },
            Source: `${SENDER_NAME} <${SENDER_EMAIL}>`,
            ReplyToAddresses: [SENDER_EMAIL],
        }));
        console.log(`[MAIL] sent to ${toEmail} | "${subject}" | MessageId=${res?.MessageId ?? 'unknown'}`);
        return true;
    } catch (e) {
        console.error(`sendMail failed for ${toEmail}: ${e.message}`);
        return false;
    }
}
