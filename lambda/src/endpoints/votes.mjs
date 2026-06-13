// log_result.php + reset_result.php + revive_song.php
import { applyVotes, resetVote, reviveVote } from '../lib/db.mjs';
import { jsonResponse } from '../lib/http.mjs';

export async function logResult(req) {
    const data = req.json ?? {};
    const userId = parseInt(data.user_id ?? 0) || 0;
    if (userId === 0) return jsonResponse({ error: 'No user_id provided' });
    if (!Array.isArray(data.votes) || data.votes.length === 0) {
        return jsonResponse({ error: 'Invalid or empty votes data' });
    }

    const parsed = [];
    for (const vote of data.votes) {
        const sidId = parseInt(vote.id ?? 0) || 0;
        const increment = parseInt(vote.increment ?? 0) || 0;
        if (sidId === 0) return jsonResponse({ error: `Invalid song ID: ${sidId}` });
        parsed.push({
            sid_id: sidId,
            win: increment > 0 ? increment : 0,
            loss: increment < 0 ? Math.abs(increment) : 0,
        });
    }
    await applyVotes(userId, parsed);
    return jsonResponse({ success: true });
}

export async function resetResult(req) {
    const data = req.json ?? {};
    const sidId = parseInt(data.id ?? 0) || 0;
    const userId = parseInt(data.user_id ?? 0) || 0;
    if (sidId === 0 || userId === 0) return jsonResponse({ error: 'Invalid id or user_id' });
    await resetVote(userId, sidId);
    return jsonResponse({ success: true });
}

export async function reviveSong(req) {
    const userId = parseInt(req.query.user_id ?? '0') || 0;
    const sidId = parseInt(req.query.sid_id ?? '0') || 0;
    if (userId === 0 || sidId === 0) return jsonResponse({ error: 'Invalid user_id or sid_id' });
    await reviveVote(userId, sidId);
    return jsonResponse({ success: true });
}
