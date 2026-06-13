// Behavioral diff harness: replays identical requests against the PHP
// reference stack (:8090, MySQL) and the Lambda port (:9090, DynamoDB), which
// start from migrated-identical data, and compares responses. Mutations run
// on both sides to keep the stores in lockstep.
//
//   node lambda/tools/diff_endpoints.mjs
const PHP = 'http://localhost:8090';
const LAMBDA = 'http://localhost:9090';

let pass = 0, fail = 0;
const failures = [];

// Per-side cookie jars (session values legitimately differ between sides)
const jars = { php: {}, lambda: {} };

function jarHeader(jar) {
    const c = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    return c ? { Cookie: c } : {};
}
function storeCookies(jar, res) {
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
        const [pair] = c.split(';');
        const eq = pair.indexOf('=');
        const name = pair.slice(0, eq), val = pair.slice(eq + 1);
        if (val) jar[name] = val; else delete jar[name];
    }
}

async function call(base, jar, path, { method = 'GET', form, json } = {}) {
    const opts = { method, headers: { ...jarHeader(jar) } };
    if (form) {
        opts.method = 'POST';
        opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        opts.body = new URLSearchParams(form).toString();
    } else if (json) {
        opts.method = 'POST';
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(json);
    }
    const res = await fetch(base + path, opts);
    storeCookies(jar, res);
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
}

// Deep-equal with masking: paths in `mask` are checked for same-type then ignored.
function deepEqual(a, b, mask = [], path = '') {
    if (mask.includes(path)) return typeof a === typeof b ? [] : [`${path}: type ${typeof a} vs ${typeof b}`];
    if (a === b) return [];
    if (typeof a !== typeof b) return [`${path}: ${JSON.stringify(a)?.slice(0,80)} vs ${JSON.stringify(b)?.slice(0,80)}`];
    if (typeof a !== 'object' || a === null || b === null) {
        return [`${path}: ${JSON.stringify(a)?.slice(0,120)} vs ${JSON.stringify(b)?.slice(0,120)}`];
    }
    if (Array.isArray(a) !== Array.isArray(b)) return [`${path}: array vs object`];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const diffs = [];
    for (const k of keys) {
        diffs.push(...deepEqual(a[k], b[k], mask, path ? `${path}.${k}` : k));
        if (diffs.length > 5) return diffs; // cap noise
    }
    return diffs;
}

async function check(name, path, opts = {}, { mask = [], normalize } = {}) {
    const [p, l] = await Promise.all([
        call(PHP, jars.php, path, opts),
        call(LAMBDA, jars.lambda, path, opts),
    ]);
    let pb = p.body, lb = l.body;
    if (normalize) { pb = normalize(pb); lb = normalize(lb); }
    const diffs = deepEqual(pb, lb, mask);
    if (diffs.length === 0) {
        pass++;
        console.log(`PASS ${name}`);
    } else {
        fail++;
        failures.push(name);
        console.log(`FAIL ${name}`);
        for (const d of diffs.slice(0, 5)) console.log(`     ${d}`);
    }
    return { p, l };
}

// HTML pages: layout whitespace is not part of the contract
const squashWs = (s) => typeof s === 'string' ? s.replace(/\s+/g, '') : s;

// ---------- read-only parity ----------
await check('full_list user 1 (heaviest)', '/dbcontrol/get_sidtunes.php?full_list=true&user_id=1');
await check('full_list user 0', '/dbcontrol/get_sidtunes.php?full_list=true&user_id=0');
await check('full_list leaderboard', '/dbcontrol/get_sidtunes.php?full_list=true&bracket=Leaderboard');
await check('full_list filter plain', '/dbcontrol/get_sidtunes.php?full_list=true&user_id=1&filter=hubbard');
await check('full_list filter wildcard', '/dbcontrol/get_sidtunes.php?full_list=true&user_id=1&filter=' + encodeURIComponent('Comm*do?e'));
await check('full_list filter record', '/dbcontrol/get_sidtunes.php?full_list=true&user_id=1&filter=' + encodeURIComponent('(2 - 0)'));
await check('full_list filter underscore', '/dbcontrol/get_sidtunes.php?full_list=true&user_id=1&filter=' + encodeURIComponent('Last_Ninja'));
await check('full_list limit/offset', '/dbcontrol/get_sidtunes.php?full_list=true&user_id=1&limit=50&offset=25');
await check('browse 1-1 bracket user 1', '/dbcontrol/get_sidtunes.php?user_id=1&wins=1&losses=1&limit=100&offset=0');
await check('browse 0-0 bracket user 1 page', '/dbcontrol/get_sidtunes.php?user_id=1&wins=0&losses=0&limit=20&offset=40');
await check('browse eliminated user 1', '/dbcontrol/get_sidtunes.php?user_id=1&losses=2&limit=100');
await check('browse leaderboard w/ filter', '/dbcontrol/get_sidtunes.php?bracket=Leaderboard&filter=sid&limit=30');
await check('browse filter+bracket user 4817', '/dbcontrol/get_sidtunes.php?user_id=4817&wins=0&losses=2&limit=50');
await check('get_results user 1', '/dbcontrol/get_results.php?user_id=1');
await check('get_results user 4817', '/dbcontrol/get_results.php?user_id=4817');
await check('get_results no votes', '/dbcontrol/get_results.php?user_id=5');
await check('get_results user 0', '/dbcontrol/get_results.php?user_id=0');
await check('player_state user 1', '/dbcontrol/get_player_state.php?user_id=1');
await check('player_state null state', '/dbcontrol/get_player_state.php?user_id=5057');
await check('player_state missing user', '/dbcontrol/get_player_state.php?user_id=9999999');
await check('player_state user 0', '/dbcontrol/get_player_state.php?user_id=0');
await check('registered_users', '/dbcontrol/get_registered_users.php');

// ---------- auth & session flows ----------
// PHP bootstraps sessions via index.php (HTML), Lambda via bootstrap.php (JSON):
// exercise each side's native bootstrap to seed a guest session cookie.
await call(PHP, jars.php, '/index.php');
const lboot = await call(LAMBDA, jars.lambda, '/dbcontrol/bootstrap.php');
if (jars.php.session_id && lboot.body.user?.session_id) { pass++; console.log('PASS guest bootstrap (both sides issued sessions)'); }
else { fail++; failures.push('guest bootstrap'); console.log('FAIL guest bootstrap', jars.php, lboot.body); }

await check('signin missing fields', '/dbcontrol/signin.php', { form: { email: '' } });
await check('signin unknown email', '/dbcontrol/signin.php', { form: { email: 'nobody@example.com', password: 'whatever123' } });
await check('register missing fields', '/dbcontrol/register.php', { form: { username: 'x' } });
await check('register bad email', '/dbcontrol/register.php', { form: { username: 'difftest', email: 'not-an-email', password: 'longenough1' } });
await check('register short password', '/dbcontrol/register.php', { form: { username: 'difftest', email: 'difftest@example.com', password: 'short' } });
await check('register dup email', '/dbcontrol/register.php', { form: { username: 'unique_name_xyz', email: 'jguinn@bonevalleyfilms.com', password: 'longenough1' } });
await check('register dup username', '/dbcontrol/register.php', { form: { username: 'Dan Nearly', email: 'unique_xyz@example.com', password: 'longenough1' } });

// Successful register: upgrades each side's current guest
await check('register success (guest upgrade)', '/dbcontrol/register.php',
    { form: { username: 'difftest', email: 'difftest@example.com', password: 'longenough1' } });
await check('signin wrong password', '/dbcontrol/signin.php', { form: { email: 'difftest@example.com', password: 'wrongwrong1' } });
await check('signin success', '/dbcontrol/signin.php', { form: { email: 'difftest@example.com', password: 'longenough1' } });
await check('signin case-insensitive email', '/dbcontrol/signin.php', { form: { email: 'DIFFTEST@EXAMPLE.COM', password: 'longenough1' } });

// ---------- state save/load via session ----------
const goodState = { contenders: ['/DEMOS/0-9/10_Orbyte.sid', '/MUSICIANS/Z/ZZR/ZZR_01.sid'],
                    peekBracket: '0 - 0', activeBracket: '0 - 0', currentMode: 'bout',
                    nowPlayingSong: null, theme: 3 };
await check('save_state ok', '/dbcontrol/save_state.php', { json: { player_state: goodState } });
await check('save_state invalid', '/dbcontrol/save_state.php', { json: { player_state: { theme: 'x' } } });
await check('save_state empty', '/dbcontrol/save_state.php', { json: {} });

// ---------- votes ----------
// Each side's difftest user id differs; vote identical tunes, compare via fullpath maps.
async function selfId(base, jar) {
    // bootstrap returns the session's user id on the lambda; PHP exposes it via
    // index.php's window.user JSON - parse it out of the HTML.
    if (base === LAMBDA) {
        const r = await call(LAMBDA, jar, '/dbcontrol/bootstrap.php');
        return r.body.user.id;
    }
    const r = await call(PHP, jar, '/index.php');
    const m = String(r.body).match(/window\.user = (\{.*?\});/);
    return m ? JSON.parse(m[1]).id : null;
}
const ids = { php: await selfId(PHP, jars.php), lambda: await selfId(LAMBDA, jars.lambda) };
console.log(`     (side-local difftest ids: php=${ids.php} lambda=${ids.lambda})`);

{
    const [p, l] = await Promise.all([
        call(PHP, jars.php, `/dbcontrol/get_player_state.php?user_id=${ids.php}`),
        call(LAMBDA, jars.lambda, `/dbcontrol/get_player_state.php?user_id=${ids.lambda}`),
    ]);
    const diffs = deepEqual(p.body, l.body);
    if (!diffs.length) { pass++; console.log('PASS player_state round-trip (per-side ids)'); }
    else { fail++; failures.push('player_state round-trip'); console.log('FAIL player_state round-trip'); diffs.slice(0,5).forEach(d => console.log('     ' + d)); }
}

async function voteBoth(votesFor) {
    const [p, l] = await Promise.all([
        call(PHP, jars.php, '/dbcontrol/log_result.php', { json: { user_id: ids.php, votes: votesFor } }),
        call(LAMBDA, jars.lambda, '/dbcontrol/log_result.php', { json: { user_id: ids.lambda, votes: votesFor } }),
    ]);
    return deepEqual(p.body, l.body);
}
{
    const d1 = await voteBoth([{ id: 100, increment: 1 }, { id: 200, increment: -1 }]);
    const d2 = await voteBoth([{ id: 100, increment: 1 }, { id: 300, increment: -2 }]);
    const d3 = await voteBoth([{ id: 0, increment: 1 }]); // invalid id error
    const all = [...d1, ...d2, ...d3];
    if (!all.length) { pass++; console.log('PASS log_result x3 (incl. invalid)'); }
    else { fail++; failures.push('log_result'); all.slice(0,5).forEach(d => console.log('     ' + d)); }
}
{
    const [p, l] = await Promise.all([
        call(PHP, jars.php, `/dbcontrol/get_results.php?user_id=${ids.php}`),
        call(LAMBDA, jars.lambda, `/dbcontrol/get_results.php?user_id=${ids.lambda}`),
    ]);
    const diffs = deepEqual(p.body, l.body);
    if (!diffs.length) { pass++; console.log('PASS get_results after votes'); }
    else { fail++; failures.push('get_results after votes'); diffs.slice(0,5).forEach(d => console.log('     ' + d)); }
}
// difftest is registered: its wins now appear on the leaderboard - global compare
await check('leaderboard after votes', '/dbcontrol/get_sidtunes.php?full_list=true&bracket=Leaderboard');
{
    const [p, l] = await Promise.all([
        call(PHP, jars.php, `/dbcontrol/reset_result.php`, { json: { id: 100, user_id: ids.php } }),
        call(LAMBDA, jars.lambda, `/dbcontrol/reset_result.php`, { json: { id: 100, user_id: ids.lambda } }),
    ]);
    const d1 = deepEqual(p.body, l.body);
    const [p2, l2] = await Promise.all([
        call(PHP, jars.php, `/dbcontrol/reset_result.php`, { json: { id: 55555, user_id: ids.php } }),
        call(LAMBDA, jars.lambda, `/dbcontrol/reset_result.php`, { json: { id: 55555, user_id: ids.lambda } }),
    ]);
    const d2 = deepEqual(p2.body, l2.body);
    const [p3, l3] = await Promise.all([
        call(PHP, jars.php, `/dbcontrol/revive_song.php?user_id=${ids.php}&sid_id=300`),
        call(LAMBDA, jars.lambda, `/dbcontrol/revive_song.php?user_id=${ids.lambda}&sid_id=300`),
    ]);
    const d3 = deepEqual(p3.body, l3.body);
    const [p4, l4] = await Promise.all([
        call(PHP, jars.php, `/dbcontrol/get_results.php?user_id=${ids.php}`),
        call(LAMBDA, jars.lambda, `/dbcontrol/get_results.php?user_id=${ids.lambda}`),
    ]);
    const d4 = deepEqual(p4.body, l4.body);
    const all = [...d1, ...d2, ...d3, ...d4];
    if (!all.length) { pass++; console.log('PASS reset/revive + results'); }
    else { fail++; failures.push('reset/revive'); all.slice(0,5).forEach(d => console.log('     ' + d)); }
}
await check('leaderboard after reset/revive', '/dbcontrol/get_sidtunes.php?full_list=true&bracket=Leaderboard');

// ---------- account ops ----------
await check('update_username too short', '/dbcontrol/update_username.php', { form: { newUsername: 'ab' } });
await check('update_username taken', '/dbcontrol/update_username.php', { form: { newUsername: 'Dan Nearly' } });
await check('update_username ok', '/dbcontrol/update_username.php', { form: { newUsername: 'difftest2' } });
await check('update_email wrong pw', '/dbcontrol/update_email.php', { form: { newEmail: 'difftest2@example.com', confirmPassword: 'nope12345' } });
await check('update_email in use', '/dbcontrol/update_email.php', { form: { newEmail: 'jguinn@bonevalleyfilms.com', confirmPassword: 'longenough1' } });
await check('update_email ok', '/dbcontrol/update_email.php', { form: { newEmail: 'difftest2@example.com', confirmPassword: 'longenough1' } });
await check('update_password wrong current', '/dbcontrol/update_password.php', { form: { currentPassword: 'nope12345', newPassword: 'evenlonger12' } });
await check('update_password short new', '/dbcontrol/update_password.php', { form: { currentPassword: 'longenough1', newPassword: 'short' } });
await check('update_password ok', '/dbcontrol/update_password.php', { form: { currentPassword: 'longenough1', newPassword: 'evenlonger12' } });
await check('signin with new password', '/dbcontrol/signin.php', { form: { email: 'difftest2@example.com', password: 'evenlonger12' } });

// ---------- password reset ----------
await check('send_reset missing', '/dbcontrol/send_reset_email.php', { form: { email: '' } });
await check('send_reset invalid format', '/dbcontrol/send_reset_email.php', { form: { email: 'bogus' } });
await check('send_reset unknown email', '/dbcontrol/send_reset_email.php', { form: { email: 'ghost@example.com' } });
await check('send_reset known email', '/dbcontrol/send_reset_email.php', { form: { email: 'difftest2@example.com' } });
await check('reset_password page no token', '/dbcontrol/reset_password.php', {}, { normalize: squashWs });
await check('reset_password page bad token', '/dbcontrol/reset_password.php?token=deadbeef', {}, { normalize: squashWs });

// ---------- logout & delete ----------
await check('logout', '/dbcontrol/logout.php');
// after logout both sides are fresh guests; sign back in to delete
await check('signin for delete', '/dbcontrol/signin.php', { form: { email: 'difftest2@example.com', password: 'evenlonger12' } });
await check('delete wrong pw', '/dbcontrol/delete_account.php', { form: { password: 'nope12345' } });
await check('delete ok', '/dbcontrol/delete_account.php', { form: { password: 'evenlonger12' } });
await check('signin after delete', '/dbcontrol/signin.php', { form: { email: 'difftest2@example.com', password: 'evenlonger12' } });
await check('registered_users after delete', '/dbcontrol/get_registered_users.php');

console.log(`\n${pass} passed, ${fail} failed${fail ? ': ' + failures.join(', ') : ''}`);
process.exit(fail ? 1 : 0);
