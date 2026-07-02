// Abuse throttling for the SES-sending endpoints (register, send_reset_email).
// No PHP equivalent - this is post-cutover hardening against bot form-spam that
// was driving SES bounce/complaint rates toward the suppression threshold.
// Counters are fixed-window items in the main table that auto-expire via its
// TTL attribute (`ttl`). Every path fails OPEN: a DynamoDB hiccup must never
// lock a real user out (same principle as sendMail never failing a request).
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from './db.mjs';

// CloudFront appends the viewer IP to X-Forwarded-For, so the LAST entry is the
// edge-trusted client address; a client-supplied XFF prefix can't spoof it.
export function clientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
        const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length) return parts[parts.length - 1];
    }
    return req.ip || 'unknown';
}

// Increment a fixed-window counter and report whether it is still within limit.
// Returns { allowed, count }. Fails open (allowed:true) on any error.
export async function hit(scope, key, limit, windowSec = 3600) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const windowStart = now - (now % windowSec);
        const pk = `RATE#${scope}#${key}#${windowStart}`;
        const r = await ddb.send(new UpdateCommand({
            TableName: TABLE,
            Key: { PK: pk, SK: 'META' },
            UpdateExpression: 'ADD #c :one SET #t = :ttl',
            ExpressionAttributeNames: { '#c': 'count', '#t': 'ttl' },
            // keep the item ~1h past the window close so TTL sweeps it cleanly
            ExpressionAttributeValues: { ':one': 1, ':ttl': windowStart + windowSec + 3600 },
            ReturnValues: 'UPDATED_NEW',
        }));
        const count = r.Attributes?.count ?? 1;
        return { allowed: count <= limit, count };
    } catch (e) {
        console.error(`ratelimit hit failed (${scope}/${key}): ${e.message}`);
        return { allowed: true, count: 0 };
    }
}
