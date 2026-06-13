// update_username.php + update_email.php + update_password.php + delete_account.php
// "Logged in" in the PHP means $_SESSION exists - here: a resolvable session cookie.
import { getUserBySessionId, getUserByEmail, getUserByUsername, updateUser, deleteUser } from '../lib/db.mjs';
import { passwordVerify, passwordHash, validateEmail } from '../lib/php.mjs';
import { jsonResponse } from '../lib/http.mjs';
import { sendMail } from '../lib/mail.mjs';

async function sessionUser(req) {
    const sid = req.cookies.session_id;
    return sid ? await getUserBySessionId(sid) : null;
}

export async function updateUsername(req) {
    const user = await sessionUser(req);
    if (!user) return jsonResponse({ success: false, message: 'Not logged in' });

    const newUsername = (req.form.newUsername ?? '').trim();
    if (!newUsername) return jsonResponse({ success: false, message: 'Username is required' });
    if (newUsername.length < 3) {
        return jsonResponse({ success: false, message: 'Username must be at least 3 characters long' });
    }
    const taken = await getUserByUsername(newUsername);
    if (taken && taken.user_id !== user.user_id) {
        return jsonResponse({ success: false, message: 'Username already taken' });
    }
    await updateUser(user.user_id, { username: newUsername });

    const bodyHtml = `
    <p>Hello,</p>
    <p>The user name for the sID JAm account registered to this e-mail address has been successfully updated.</p>
    <p>You can click the profile image on <a href="https://sidjam.com">https://sidjam.com</a> to access additional sign in and user registration settings.</p>
    <p>Thank you for using sID JAm!</p>
`;
    await sendMail(user.email, 'sID JAm - User Name Updated', bodyHtml, true);
    return jsonResponse({ success: true });
}

export async function updateEmail(req) {
    const user = await sessionUser(req);
    if (!user) return jsonResponse({ success: false, message: 'Not logged in' });

    const newEmail = (req.form.newEmail ?? '').trim();
    const confirmPassword = req.form.confirmPassword ?? '';
    if (!newEmail || !confirmPassword) {
        return jsonResponse({ success: false, message: 'All fields are required' });
    }
    if (!validateEmail(newEmail)) {
        return jsonResponse({ success: false, message: 'Invalid email format' });
    }
    const inUse = await getUserByEmail(newEmail);
    if (inUse && inUse.user_id !== user.user_id) {
        return jsonResponse({ success: false, message: 'Email already in use' });
    }
    if (!(await passwordVerify(confirmPassword, user.password))) {
        return jsonResponse({ success: false, message: 'Incorrect password' });
    }
    const oldEmail = user.email;
    await updateUser(user.user_id, { email: newEmail });

    const subject = 'sID JAm - Email Address Changed';
    await sendMail(oldEmail, subject,
        `Your email address has been changed to ${newEmail}. You can click the profile image on https://sidjam.com to access additional sign in and user registration settings.\nThank you for using sID JAm!`);
    await sendMail(newEmail, subject,
        `Your email address has been updated to ${newEmail}. You can click the profile image on https://sidjam.com to access additional sign in and user registration settings.\nThank you for using sID JAm!`);
    return jsonResponse({ success: true });
}

export async function updatePassword(req) {
    const user = await sessionUser(req);
    if (!user) return jsonResponse({ success: false, message: 'Not logged in' });

    const currentPassword = req.form.currentPassword ?? '';
    const newPassword = req.form.newPassword ?? '';
    if (!currentPassword || !newPassword) {
        return jsonResponse({ success: false, message: 'All fields are required' });
    }
    if (newPassword.length < 8) {
        return jsonResponse({ success: false, message: 'New password must be at least 8 characters long' });
    }
    if (!(await passwordVerify(currentPassword, user.password))) {
        return jsonResponse({ success: false, message: 'Current password is incorrect' });
    }
    await updateUser(user.user_id, { password: await passwordHash(newPassword) });

    const bodyHtml = `
    <p>Hello,</p>
    <p>The password for the sID JAm account registered to this e-mail address has been successfully updated.</p>
    <p>You can click the profile image on https://sidjam.com to access additional sign in and user registration settings.</p>
    <p>Thank you for using sID JAm!</p>
`;
    await sendMail(user.email, 'sID JAm - Password Updated', bodyHtml, true);
    return jsonResponse({ success: true });
}

export async function deleteAccount(req) {
    const user = await sessionUser(req);
    if (!user) return jsonResponse({ success: false, message: 'Not logged in' });

    const password = req.form.password ?? '';
    if (!password) return jsonResponse({ success: false, message: 'Password is required' });
    if (!(await passwordVerify(password, user.password))) {
        return jsonResponse({ success: false, message: 'Incorrect password' });
    }
    const email = user.email;
    await deleteUser(user.user_id);
    // Note: like the PHP (DELETE FROM siduser only), vote rows are left behind.

    const body = 'The sID JAm account registered to this e-mail address has been deleted. \nFeel free to register a new account on https://sidjam.com at any time.\nThank you for trying sID JAm!';
    await sendMail(email, 'sID JAm - Account Deleted', body);
    return jsonResponse({ success: true });
}
