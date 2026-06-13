// Build the static index.html from www/index.php (task 483).
//
// The PHP prologue (session bootstrap) became dbcontrol/bootstrap.php; the
// inline PHP interpolations become client-side equivalents. Everything else
// ships byte-identical. Output: www/index.html (gitignored, built per release).
//
//   node lambda/tools/build_index.mjs
import { readFile, writeFile } from 'node:fs/promises';

const SRC = new URL('../../www/index.php', import.meta.url);
const OUT = new URL('../../www/index.html', import.meta.url);

let php = await readFile(SRC, 'utf8');

const version = php.match(/\$version = "([^"]+)"/)?.[1];
if (!version) throw new Error('no $version stamp found in index.php');

// Drop the PHP prologue: everything through the first closing tag.
const closeTag = php.indexOf('?>\n');
if (closeTag < 0 || !php.slice(0, closeTag).includes('$cxn')) {
    throw new Error('index.php prologue not where expected');
}
let html = php.slice(closeTag + 3);

// The window.user / isLoggedIn / DEBUG / LOG_LEVEL injections -> bootstrap fetch
// + client-side query parsing. window.userReady is awaited by initializeApp().
const injection = /        window\.user = <\?php [^\n]*\n        window\.isLoggedIn = <\?php [^\n]*\n        window\.DEBUG_ENABLED = <\?php [^\n]*\n        window\.LOG_LEVEL = <\?php [^\n]*\n/;
if (!injection.test(html)) throw new Error('window.* PHP injection block not found');
html = html.replace(injection, `        const _params = new URLSearchParams(location.search);
        window.DEBUG_ENABLED = _params.get('debug') === 'true';
        const _ll = parseInt(_params.get('logLevel'), 10);
        window.LOG_LEVEL = (Number.isInteger(_ll) && _ll >= -1 && _ll <= 2) ? _ll : 0;
        window.userReady = fetch('dbcontrol/bootstrap.php', { credentials: 'same-origin' })
            .then(r => { if (!r.ok) throw new Error('bootstrap failed: ' + r.status); return r.json(); })
            .then(d => { window.user = d.user; window.isLoggedIn = d.isLoggedIn; window.username = d.username; });
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.DEBUG_ENABLED) document.getElementById('log-player-state')?.remove();
            window.userReady.then(d => {
                document.getElementById('greeting').textContent = window.username;
                const ce = document.getElementById('currentEmail');
                if (ce) ce.textContent = (window.user.email || 'Not set');
            });
        });
`);

// Debug-only button: ship it in the HTML; the head script removes it unless
// ?debug=true (was a server-side conditional).
html = html.replace(/        <\?php if \(\$debug_enabled\): \?>\n            (<button id="log-player-state"[^\n]*)\n        <\?php endif; \?>\n/,
    '        $1\n');

// Server-rendered user fields: placeholders, filled by the bootstrap script.
html = html.replace('<?php echo htmlspecialchars($username); ?>', '');
html = html.replace("<?php echo htmlspecialchars($_SESSION['email'] ?? 'Not set'); ?>", 'Not set');

// Remaining PHP interpolations are all version stamps.
html = html.replace(/<\?php echo \$version; \?>/g, version);

const leftover = html.match(/<\?php[\s\S]{0,80}/);
if (leftover) throw new Error('unhandled PHP remains: ' + leftover[0]);

await writeFile(OUT, html);
console.log(`www/index.html built (version ${version}, ${html.length} bytes)`);
