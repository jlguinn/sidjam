// PHP-compatibility helpers: behaviors the reference backend gets from PHP
// builtins and MySQL semantics.
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

// password_verify(): bcrypt; tolerate null/empty hashes (guests) -> false.
export async function passwordVerify(password, hash) {
    if (!hash || typeof hash !== 'string') return false;
    try { return await bcrypt.compare(password, hash); } catch { return false; }
}

// password_hash($p, PASSWORD_DEFAULT) -> bcrypt cost 10 (PHP default).
export async function passwordHash(password) {
    return bcrypt.hash(password, 10);
}

// bin2hex(random_bytes(16))
export function newSessionId() {
    return crypto.randomBytes(16).toString('hex');
}

// bin2hex(random_bytes(32)) - password reset token
export function newResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

// filter_var(FILTER_VALIDATE_EMAIL) approximation. The reference's exact
// RFC-822 edge behavior doesn't matter to the frontend; this matches it for
// all realistic addresses.
export function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// CURDATE() in the reference runs in UTC containers; match it.
export function curdate() {
    return new Date().toISOString().slice(0, 10);
}

// MySQL utf8mb4 *_ci comparisons are case-insensitive; DynamoDB keys are
// exact, so case-insensitive lookups (email, username) go through lowercased
// GSI attributes.
export function ciKey(s) {
    return (s ?? '').toLowerCase();
}

// wildcardToSqlLike() + LIKE, as a predicate on the display string.
// PHP: escape % _ as \% \_, then * -> %, ? -> _, then wrap in %...%.
// MySQL LIKE: % = any run, _ = one char, \x = literal x, case-insensitive.
export function likeMatcher(filter) {
    if (filter === '') return () => true;
    let re = '';
    let i = 0;
    while (i < filter.length) {
        const ch = filter[i];
        if (ch === '%' || ch === '_') {           // PHP escaped these -> literal
            re += '\\' + ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            i++;
        } else if (ch === '*') { re += '.*'; i++; }
        else if (ch === '?') { re += '.'; i++; }
        else if (ch === '\\') {                    // literal backslash in input:
            re += '\\\\'; i++;                     // MySQL treats \x as literal x,
        }                                          // close enough for path data
        else { re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i++; }
    }
    const regex = new RegExp(re, 'is');            // implied %...% = contains
    return (display) => regex.test(display);
}

// The "(w - l) path" display string the SQL filter matches against,
// with REPLACE(fullpath, '/sid/C64Music', '').
export function displayString(wins, losses, fullpath) {
    return `(${wins} - ${losses}) ${fullpath.split('/sid/C64Music').join('')}`;
}

// PHP strip_tags() approximation for the HTML->text email fallback.
export function stripTags(html) {
    return html.replace(/<[^>]*>/g, '');
}
