// get_registered_users.php
import { getRegisteredUsers, getAllVotes } from '../lib/db.mjs';
import { jsonResponse } from '../lib/http.mjs';

export async function getRegisteredUserCounts() {
    const [registered, votes] = await Promise.all([getRegisteredUsers(), getAllVotes()]);
    const votedUserIds = new Set(votes.map(v => v.user_id));
    // Active = registered users with >=1 vote row, GROUP BY UserName
    const activeNames = new Set();
    for (const u of registered) {
        if (votedUserIds.has(u.user_id)) activeNames.add(u.username_lc ?? u.username ?? '');
    }
    return jsonResponse({
        success: true,
        user_count: registered.length,
        active_user_count: activeNames.size,
    });
}
