// bootstrap (new: the session logic from index.php's PHP prologue) +
// signin.php + register.php + logout.php
import { getUserById, getUserBySessionId, getUserByEmail, getUserByUsername,
         allocateUserId, putUser, updateUser } from '../lib/db.mjs';
import { passwordVerify, passwordHash, newSessionId, validateEmail, curdate } from '../lib/php.mjs';
import { jsonResponse, sessionCookie } from '../lib/http.mjs';
import { sendMail } from '../lib/mail.mjs';

async function createGuest() {
    const userId = await allocateUserId();
    const sessionId = newSessionId();
    const today = curdate();
    await putUser({
        user_id: userId, session_id: sessionId,
        reg_date: today, last_access_date: today,
        username: null, email: null, password: null, player_state: null,
    });
    return { userId, sessionId };
}

// index.php prologue: resolve the session_id cookie to a user (updating
// LastAccessDate), else mint a guest. Returns the window.user payload.
export async function bootstrap(req) {
    const cookieSession = req.cookies.session_id;
    if (cookieSession && cookieSession.length === 32) {
        const user = await getUserBySessionId(cookieSession);
        if (user) {
            await updateUser(user.user_id, { last_access_date: curdate() });
            return jsonResponse({
                user: { id: user.user_id, session_id: user.session_id, email: user.email ?? '' },
                isLoggedIn: !!user.email,
                username: user.username ?? 'Guest User',
            }, { setCookie: sessionCookie(user.session_id) });
        }
    }
    const { userId, sessionId } = await createGuest();
    return jsonResponse({
        user: { id: userId, session_id: sessionId, email: '' },
        isLoggedIn: false,
        username: 'Guest User',
    }, { setCookie: sessionCookie(sessionId) });
}

export async function signin(req) {
    const email = (req.form.email ?? '').trim();
    const password = req.form.password ?? '';
    if (!email || !password) {
        return jsonResponse({ success: false, message: 'Email and password are required' });
    }
    const user = await getUserByEmail(email);
    if (!user || !(await passwordVerify(password, user.password))) {
        return jsonResponse({ success: false, message: 'Invalid email or password' });
    }
    const sessionId = newSessionId();
    await updateUser(user.user_id, { session_id: sessionId, last_access_date: curdate() });
    return jsonResponse({ success: true }, { setCookie: sessionCookie(sessionId) });
}

export async function register(req) {
    const username = (req.form.username ?? '').trim();
    const email = (req.form.email ?? '').trim();
    const password = req.form.password ?? '';

    if (!username || !email || !password) {
        return jsonResponse({ success: false, message: 'All fields are required' });
    }
    if (!validateEmail(email)) {
        return jsonResponse({ success: false, message: 'Invalid email format' });
    }
    if (password.length < 8) {
        return jsonResponse({ success: false, message: 'Password must be at least 8 characters long' });
    }
    if (await getUserByEmail(email)) {
        return jsonResponse({ success: false, message: 'Email already exists' });
    }
    if (await getUserByUsername(username)) {
        return jsonResponse({ success: false, message: 'Username already exists' });
    }

    const hashed = await passwordHash(password);
    const playerState = JSON.stringify({ bracket: '0-0', theme: 1 });
    const today = curdate();
    const sessionId = newSessionId();

    // Upgrade the current guest (cookie session) if it exists and has no email
    const cookieSession = req.cookies.session_id;
    const guest = cookieSession ? await getUserBySessionId(cookieSession) : null;
    let userId;
    if (guest && !guest.email) {
        userId = guest.user_id;
        await updateUser(userId, {
            username, email, password: hashed,
            reg_date: today, last_access_date: today,
            player_state: playerState, session_id: sessionId,
        });
    } else {
        userId = await allocateUserId();
        await putUser({
            user_id: userId, session_id: sessionId,
            username, email, password: hashed,
            reg_date: today, last_access_date: today,
            player_state: playerState,
        });
    }

    const bodyHtml = `
    <p>Thank you for registering to sID JAm!</p>
    <p>Visit <a href="https://sidjam.com">https://sidjam.com</a> to access sID JAm.</p>
    <p>See also: <a href="https://sidjam.com/help.html">https://sidjam.com/help.html</a> for help.</p>
    <p>Thank you!</p>
`;
    await sendMail(email, 'Welcome to sID JAm!', bodyHtml, true);

    return jsonResponse({ success: true, message: 'Registration successful!' },
                        { setCookie: sessionCookie(sessionId) });
}

export async function logout(req) {
    // The PHP destroys the session and inserts a fresh guest row; under
    // cookie-only sessions that means a new guest + new cookie.
    const { sessionId } = await createGuest();
    return jsonResponse({ success: true }, { setCookie: sessionCookie(sessionId) });
}
