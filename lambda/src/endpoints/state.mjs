// get_player_state.php + save_state.php
import { getUserById, getUserBySessionId, updateUser } from '../lib/db.mjs';
import { jsonResponse } from '../lib/http.mjs';

// The shared validation block from both PHP files, verbatim semantics.
function isValidPlayerState(ps) {
    // PHP json_decode(..., true) + is_array() accepts any JSON object/array.
    if (typeof ps !== 'object' || ps === null) return false;
    if (!('contenders' in ps) || !('peekBracket' in ps) || !('activeBracket' in ps)
        || !('currentMode' in ps) || !('theme' in ps)) return false;
    if (!Array.isArray(ps.contenders)) return false;
    if (typeof ps.peekBracket !== 'string') return false;
    if (typeof ps.activeBracket !== 'string') return false;
    if (typeof ps.currentMode !== 'string') return false;
    if (typeof ps.theme !== 'number' && !(typeof ps.theme === 'string' && ps.theme.trim() !== '' && !isNaN(ps.theme))) return false;
    if (!['bout', 'nowPlaying'].includes(ps.currentMode)) return false;
    if ('nowPlayingSong' in ps && ps.nowPlayingSong !== null && typeof ps.nowPlayingSong !== 'string') return false;
    return true;
}

export async function getPlayerState(req) {
    const userId = parseInt(req.query.user_id ?? '0') || 0;
    if (userId === 0) return jsonResponse({ success: false, message: 'No user_id provided' });

    const user = await getUserById(userId);
    let playerState = null;
    if (user && user.player_state) {
        try { playerState = JSON.parse(user.player_state); } catch { playerState = null; }
        if (playerState && !isValidPlayerState(playerState)) playerState = null;
    }
    return jsonResponse({ success: true, player_state: playerState });
}

// The PHP takes the user from $_SESSION; the session_id cookie is the
// durable equivalent under static hosting.
export async function saveState(req) {
    const sessionId = req.cookies.session_id;
    const user = sessionId ? await getUserBySessionId(sessionId) : null;
    if (!user) return jsonResponse({ success: false, message: 'User not authenticated' });

    const playerState = req.json?.player_state ?? null;
    if (!playerState) return jsonResponse({ success: false, message: 'No state data provided' });
    if (!isValidPlayerState(playerState)) {
        return jsonResponse({ success: false, message: 'Invalid state format' });
    }
    await updateUser(user.user_id, { player_state: JSON.stringify(playerState) });
    return jsonResponse({ success: true });
}
