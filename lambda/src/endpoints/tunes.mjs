// get_sidtunes.php + get_results.php
import { getCatalog } from '../lib/catalog.mjs';
import { getVotesByUser, getAllVotes, getRegisteredUserIds } from '../lib/db.mjs';
import { likeMatcher, displayString } from '../lib/php.mjs';
import { jsonResponse } from '../lib/http.mjs';

// --- exact SQL text the PHP builds (returned in the non-full_list envelope) ---
const SEL_BROWSE = "SELECT a.fullpath, COALESCE(s.wins, 0) as wins, COALESCE(s.losses, 0) as losses \n              FROM sidtunes a";
const JOIN_LEADER_BROWSE = " INNER JOIN (\n                      SELECT sid_id, SUM(win) as wins, SUM(loss) as losses \n                      FROM sidjam \n                      WHERE user_id IN (SELECT user_id FROM siduser WHERE email IS NOT NULL)\n                      GROUP BY sid_id\n                      HAVING SUM(win) > 0\n                  ) s ON a.sid_id = s.sid_id";
const JOIN_USER_BROWSE = " LEFT JOIN (\n                          SELECT sid_id, SUM(win) as wins, SUM(loss) as losses \n                          FROM sidjam \n                          WHERE user_id = ? \n                          GROUP BY sid_id\n                      ) s ON a.sid_id = s.sid_id";
const COND_FILTER = "LOWER(CONCAT('(', COALESCE(s.wins, 0), ' - ', COALESCE(s.losses, 0), ') ', REPLACE(a.fullpath, '/sid/C64Music', ''))) LIKE LOWER(?)";
const COND_ZERO = "((s.wins = 0 AND s.losses = 0) OR (s.wins IS NULL AND s.losses IS NULL))";
const COND_EQ = "(COALESCE(s.wins, 0) = ? AND COALESCE(s.losses, 0) = ?)";
const COND_ELIM = "(COALESCE(s.losses, 0) >= 2)";
const ORDER = " ORDER BY COALESCE(s.wins, 0) DESC, COALESCE(s.losses, 0) ASC, a.fullpath ASC";
const LIMIT = " LIMIT ? OFFSET ?";

// votes -> Map(sid_id -> {wins, losses})
function voteMap(votes) {
    const m = new Map();
    for (const v of votes) {
        const cur = m.get(v.sid_id) ?? { wins: 0, losses: 0 };
        cur.wins += v.win; cur.losses += v.loss;
        m.set(v.sid_id, cur);
    }
    return m;
}

// SUM over registered users' votes, HAVING SUM(win) > 0
async function leaderboardMap() {
    const [votes, registered] = await Promise.all([getAllVotes(), getRegisteredUserIds()]);
    const m = voteMap(votes.filter(v => registered.has(v.user_id)));
    for (const [sid, rec] of m) if (!(rec.wins > 0)) m.delete(sid);
    return m;
}

// wins DESC, losses ASC, fullpath ASC (catalog index = MySQL fullpath order)
function sortRows(rows) {
    rows.sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.idx - b.idx);
    return rows;
}

export async function getSidtunes(req) {
    const q = req.query;
    const filter = q.filter ?? '';
    const offset = parseInt(q.offset ?? '0') || 0;
    const limit = parseInt(q.limit ?? '0') || 0;
    const fullList = q.full_list === 'true';
    const wins = q.wins !== undefined ? (parseInt(q.wins) || 0) : -1;
    const losses = q.losses !== undefined ? (parseInt(q.losses) || 0) : -1;
    const userId = parseInt(q.user_id ?? '0') || 0;
    const bracket = q.bracket ?? '';
    const isLeader = bracket === 'Leaderboard';

    const catalog = await getCatalog();
    const matches = likeMatcher(filter);

    let rows; // {id, fullpath, wins, losses, idx}
    if (isLeader) {
        const lb = await leaderboardMap();
        rows = catalog.filter(t => lb.has(t.id))
            .map(t => ({ ...t, ...lb.get(t.id) }));
    } else if (fullList || userId > 0) {
        const uv = voteMap(await getVotesByUser(userId));
        rows = catalog.map(t => {
            const r = uv.get(t.id);
            return { ...t, wins: r?.wins ?? 0, losses: r?.losses ?? 0, hasRow: !!r };
        });
    } else {
        // Browse with user_id=0: the PHP builds SQL referencing s.* with no
        // join and dies in prepare(). Replicate the observable error shape.
        return jsonResponse({ error: "Prepare failed: Unknown column 's.wins' in 'field list'" });
    }

    if (filter !== '') {
        rows = rows.filter(r => matches(displayString(r.wins, r.losses, r.fullpath)));
    }

    if (!fullList && !isLeader && userId > 0) {
        if (wins >= 0 && losses >= 0) {
            if (wins === 0 && losses === 0) {
                // (s.wins=0 AND s.losses=0) OR (both NULL): vote row at 0-0, or no row
                rows = rows.filter(r => (r.hasRow && r.wins === 0 && r.losses === 0) || !r.hasRow);
            } else {
                rows = rows.filter(r => r.wins === wins && r.losses === losses);
            }
        } else if (losses === 2) {
            rows = rows.filter(r => r.losses >= 2);
        }
    }

    sortRows(rows);
    const page = limit > 0 ? rows.slice(offset, offset + limit) : rows;

    if (fullList) {
        return jsonResponse(page.map(r => ({ id: r.id, fullpath: r.fullpath, wins: r.wins, losses: r.losses })));
    }

    // Rebuild the SQL string exactly as the PHP would have
    let query = SEL_BROWSE;
    const conditions = [];
    if (isLeader) query += JOIN_LEADER_BROWSE;
    else if (userId > 0) query += JOIN_USER_BROWSE;
    if (filter !== '') conditions.push(COND_FILTER);
    if (!isLeader && wins >= 0 && losses >= 0 && userId > 0) {
        conditions.push(wins === 0 && losses === 0 ? COND_ZERO : COND_EQ);
    } else if (!isLeader && losses === 2 && userId > 0) {
        conditions.push(COND_ELIM);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ORDER;
    if (limit > 0) query += LIMIT;

    return jsonResponse({
        query,
        files: page.map(r => ({ fullpath: r.fullpath, wins: r.wins, losses: r.losses })),
        offset,
        limit,
        hasMore: page.length > 0,
    });
}

export async function getResults(req) {
    const userId = parseInt(req.query.user_id ?? '0') || 0;
    if (userId === 0) return jsonResponse({ error: 'No user_id provided' });

    const [catalog, votes] = await Promise.all([getCatalog(), getVotesByUser(userId)]);
    const byId = new Map(catalog.map(t => [t.id, t.fullpath]));
    const results = {};
    for (const v of votes) {
        const fullpath = byId.get(v.sid_id);
        if (fullpath === undefined) continue; // JOIN sidtunes
        results[fullpath] = { wins: v.win, losses: v.loss };
    }
    return jsonResponse(results);
}
