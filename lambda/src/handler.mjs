// Lambda entry point: routes /dbcontrol/* to the ported endpoints.
import { parseRequest, jsonResponse } from './lib/http.mjs';
import { getSidtunes, getResults } from './endpoints/tunes.mjs';
import { getPlayerState, saveState } from './endpoints/state.mjs';
import { logResult, resetResult, reviveSong } from './endpoints/votes.mjs';
import { bootstrap, signin, register, logout } from './endpoints/auth.mjs';
import { updateUsername, updateEmail, updatePassword, deleteAccount } from './endpoints/account.mjs';
import { sendResetEmail, resetPassword } from './endpoints/resets.mjs';
import { getRegisteredUserCounts } from './endpoints/admin.mjs';

const routes = {
    'bootstrap.php': bootstrap,
    'get_sidtunes.php': getSidtunes,
    'get_results.php': getResults,
    'get_player_state.php': getPlayerState,
    'save_state.php': saveState,
    'log_result.php': logResult,
    'reset_result.php': resetResult,
    'revive_song.php': reviveSong,
    'signin.php': signin,
    'register.php': register,
    'logout.php': logout,
    'update_username.php': updateUsername,
    'update_email.php': updateEmail,
    'update_password.php': updatePassword,
    'delete_account.php': deleteAccount,
    'send_reset_email.php': sendResetEmail,
    'reset_password.php': resetPassword,
    'get_registered_users.php': getRegisteredUserCounts,
};

export async function handler(event) {
    const req = parseRequest(event);
    const name = req.path.replace(/^.*\/dbcontrol\//, '');
    const route = routes[name];
    if (!route) {
        return { statusCode: 404, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Not found' }) };
    }
    try {
        return await route(req);
    } catch (e) {
        console.error(`${name}: ${e.stack}`);
        return jsonResponse({ error: 'Internal error' });
    }
}
