// send_reset_email.php + reset_password.php (the latter returns an HTML page -
// it is the link target in the reset email, not a frontend XHR endpoint).
import { getUserByEmail, putResetToken, getResetToken, deleteResetToken, updateUser } from '../lib/db.mjs';
import { validateEmail, newResetToken, passwordHash } from '../lib/php.mjs';
import { jsonResponse, htmlResponse } from '../lib/http.mjs';
import { sendMail } from '../lib/mail.mjs';

export async function sendResetEmail(req) {
    const email = (req.form.email ?? '').trim();
    if (!email) return jsonResponse({ success: false, message: 'Email is required' });
    if (!validateEmail(email)) return jsonResponse({ success: false, message: 'Invalid email format' });

    const user = await getUserByEmail(email);
    if (user) {
        const token = newResetToken();
        const expires = Math.floor(Date.now() / 1000) + 3600;
        await putResetToken(token, user.user_id, expires);

        const resetLink = `https://sidjam.com/dbcontrol/reset_password.php?token=${token}`;
        const bodyHtml = `
        <p>A password reset for the sID JAm account associated with this e-mail has been requested. You can click the link below to reset your password:</p>
        <p><a href="${resetLink}">Reset Your Password</a></p>
        <p>This link will expire in 1 hour. If you did not make this request or otherwise no longer need a password change, you may ignore this request.</p>
        <p>You can visit <a href="https://sidjam.com">https://sidjam.com</a> to access your account or learn more about sID JAm.</p>
`;
        await sendMail(email, 'sID JAm - Password Reset Request', bodyHtml, true);
    }
    // Same response either way: don't reveal whether the email exists
    return jsonResponse({ success: true, message: 'If this email address was registered, a password reset link will be sent.' });
}

function resetPage(message, showForm) {
    const color = message.includes('successfully') ? 'green' : 'red';
    return `
<!DOCTYPE html>
<html>
<head>
    <title>sID JAm - Reset Password</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="src/styles.css">
</head>
<body>
    <div id="resetPasswordContainer">
        <h2>Reset Password</h2>
        ${message ? `<p style="color: ${color};">${message}</p>` : ''}
        ${showForm ? `<form method="POST">
                <div class="form-group">
                    <label for="newPassword">New Password:</label>
                    <input type="password" id="newPassword" name="new_password" required>
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password:</label>
                    <input type="password" id="confirmPassword" name="confirm_password" required>
                </div>
                <button type="submit">Reset Password</button>
            </form>` : ''}
        <p><a href="index.php">Back to Sign In</a></p>
    </div>
</body>
</html>`;
}

export async function resetPassword(req) {
    const token = (req.query.token ?? '').trim();
    let message = '';

    if (!token) {
        message = 'Invalid or missing token.';
    } else {
        const reset = await getResetToken(token);
        if (!reset) {
            message = 'Invalid or expired token.';
        } else if (reset.expires < Math.floor(Date.now() / 1000)) {
            message = 'This token has expired.';
        } else if (req.method === 'POST') {
            const newPassword = req.form.new_password ?? '';
            const confirmPassword = req.form.confirm_password ?? '';
            if (!newPassword || !confirmPassword) {
                message = 'Both password fields are required.';
            } else if (newPassword !== confirmPassword) {
                message = 'Passwords do not match.';
            } else if (newPassword.length < 8) {
                message = 'Password must be at least 8 characters long.';
            } else {
                await updateUser(reset.user_id, { password: await passwordHash(newPassword) });
                await deleteResetToken(token);
                message = 'Password reset successfully! You can now sign in with your new password.';
            }
        }
    }

    // Form shows when the token is workable (same predicate as the PHP page)
    const showForm = !message || (!message.includes('successfully') && !message.includes('expired') && !message.includes('Invalid'));
    return htmlResponse(resetPage(message, showForm));
}
