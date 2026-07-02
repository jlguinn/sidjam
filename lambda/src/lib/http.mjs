// Request/response helpers for the Lambda Function URL payload (v2.0).
// The PHP reference accepts form-encoded POSTs (auth/account endpoints) and
// JSON bodies (save_state, log_result, reset_result); responses are JSON
// except reset_password.php which returns an HTML page.

export function parseRequest(event) {
    const method = event.requestContext?.http?.method ?? 'GET';
    const ip = event.requestContext?.http?.sourceIp ?? null;
    const path = event.rawPath ?? '/';
    const query = Object.fromEntries(new URLSearchParams(event.rawQueryString ?? ''));

    const cookies = {};
    for (const c of event.cookies ?? []) {
        const eq = c.indexOf('=');
        if (eq > 0) cookies[c.slice(0, eq)] = decodeURIComponent(c.slice(eq + 1));
    }

    let rawBody = event.body ?? '';
    if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, 'base64').toString('utf8');

    const headers = {};
    for (const [k, v] of Object.entries(event.headers ?? {})) headers[k.toLowerCase()] = v;

    const contentType = headers['content-type'] ?? '';
    let form = {};
    let json = null;
    if (contentType.includes('application/x-www-form-urlencoded')) {
        form = Object.fromEntries(new URLSearchParams(rawBody));
    } else if (contentType.includes('application/json')) {
        try { json = JSON.parse(rawBody); } catch { json = null; }
    }

    return { method, ip, path, query, cookies, form, json, rawBody, headers };
}

// PHP's json_encode escapes "/" as "\/" by default; replicate so responses
// diff cleanly against the reference (fullpaths are full of slashes).
export function phpJson(value) {
    return JSON.stringify(value).replace(/\//g, '\\/');
}

export function jsonResponse(value, { setCookie } = {}) {
    const res = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: phpJson(value),
    };
    if (setCookie) res.cookies = [setCookie];
    return res;
}

export function htmlResponse(body, { setCookie } = {}) {
    const res = {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        body,
    };
    if (setCookie) res.cookies = [setCookie];
    return res;
}

export function sessionCookie(sessionId) {
    return `session_id=${sessionId}; Max-Age=${30 * 24 * 60 * 60}; Path=/`;
}

export function clearSessionCookie() {
    return 'session_id=; Max-Age=0; Path=/';
}
