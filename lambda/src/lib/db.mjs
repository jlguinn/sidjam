// DynamoDB single-table data layer.
//
// Items (table keys PK, SK):
//   USER#<id>   / META           user record (username, email, password, session_id,
//                                reg_date, last_access_date, player_state, user_id)
//   USER#<id>   / TUNE#<sid_id>  vote record (win, loss, user_id, sid_id)
//   RESET#<tok> / META           password-reset token (user_id, expires, ttl)
//   COUNTER     / META           next_user_id allocator (the PHP contract exposes
//                                MySQL auto-increment ids; keep allocating them)
// GSIs:
//   gsi_email:   email_lc   -> user META (MySQL email compares are case-insensitive)
//   gsi_session: session_id -> user META
//   gsi_uname:   username_lc-> user META
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand,
         QueryCommand, ScanCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

export const TABLE = process.env.SIDJAM_TABLE ?? 'sidjam';

const client = new DynamoDBClient(
    process.env.DDB_ENDPOINT
        ? { endpoint: process.env.DDB_ENDPOINT, region: 'us-east-1',
            credentials: { accessKeyId: 'local', secretAccessKey: 'local' } }
        : {}
);
export const ddb = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
});

const userPK = (id) => `USER#${id}`;

// ---- users ----

export async function getUserById(userId) {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: userPK(userId), SK: 'META' } }));
    return r.Item ?? null;
}

async function queryOneGsi(index, attr, value) {
    const r = await ddb.send(new QueryCommand({
        TableName: TABLE, IndexName: index,
        KeyConditionExpression: '#a = :v',
        ExpressionAttributeNames: { '#a': attr },
        ExpressionAttributeValues: { ':v': value },
        Limit: 1,
    }));
    return r.Items?.[0] ?? null;
}

export const getUserBySessionId = (sessionId) => queryOneGsi('gsi_session', 'session_id', sessionId);
export const getUserByEmail = (email) => queryOneGsi('gsi_email', 'email_lc', email.toLowerCase());
export const getUserByUsername = (username) => queryOneGsi('gsi_uname', 'username_lc', username.toLowerCase());

export async function allocateUserId() {
    const r = await ddb.send(new UpdateCommand({
        TableName: TABLE, Key: { PK: 'COUNTER', SK: 'META' },
        UpdateExpression: 'ADD next_user_id :one',
        ExpressionAttributeValues: { ':one': 1 },
        ReturnValues: 'UPDATED_NEW',
    }));
    return r.Attributes.next_user_id;
}

export async function putUser(item) {
    // Derived GSI attributes are maintained here, nowhere else.
    const u = { ...item, PK: userPK(item.user_id), SK: 'META' };
    if (u.email) u.email_lc = u.email.toLowerCase(); else delete u.email_lc;
    if (u.username) u.username_lc = u.username.toLowerCase(); else delete u.username_lc;
    await ddb.send(new PutCommand({ TableName: TABLE, Item: u }));
    return u;
}

export async function updateUser(userId, fields) {
    const u = await getUserById(userId);
    if (!u) return null;
    return putUser({ ...u, ...fields, user_id: userId });
}

export async function deleteUser(userId) {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: userPK(userId), SK: 'META' } }));
}

// ---- votes ----

export async function getVotesByUser(userId) {
    const r = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :tune)',
        ExpressionAttributeValues: { ':pk': userPK(userId), ':tune': 'TUNE#' },
    }));
    return r.Items ?? [];
}

// INSERT ... ON DUPLICATE KEY UPDATE win = win + n, loss = loss + n, atomically
// across the whole votes array like the PHP transaction.
export async function applyVotes(userId, votes) {
    const items = votes.map(({ sid_id, win, loss }) => ({
        Update: {
            TableName: TABLE,
            Key: { PK: userPK(userId), SK: `TUNE#${sid_id}` },
            UpdateExpression: 'ADD win :w, loss :l SET user_id = :u, sid_id = :s',
            ExpressionAttributeValues: { ':w': win, ':l': loss, ':u': userId, ':s': sid_id },
        },
    }));
    await ddb.send(new TransactWriteCommand({ TransactItems: items }));
}

// UPDATE ... WHERE: no-op (still success) when the row doesn't exist.
export async function resetVote(userId, sidId) {
    try {
        await ddb.send(new UpdateCommand({
            TableName: TABLE, Key: { PK: userPK(userId), SK: `TUNE#${sidId}` },
            UpdateExpression: 'SET win = :z, loss = :z',
            ConditionExpression: 'attribute_exists(PK)',
            ExpressionAttributeValues: { ':z': 0 },
        }));
    } catch (e) {
        if (e.name !== 'ConditionalCheckFailedException') throw e;
    }
}

// INSERT ... ON DUPLICATE KEY UPDATE win = 0, loss = 0 (upsert).
export async function reviveVote(userId, sidId) {
    await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: { PK: userPK(userId), SK: `TUNE#${sidId}`, user_id: userId, sid_id: sidId, win: 0, loss: 0 },
    }));
}

// All vote items in the table (964 rows in prod; a filtered scan is fine and
// keeps leaderboard semantics identical to the SQL, which re-evaluates the
// "registered users" subquery at read time).
export async function getAllVotes() {
    const votes = [];
    let key;
    do {
        const r = await ddb.send(new ScanCommand({
            TableName: TABLE,
            FilterExpression: 'begins_with(SK, :tune)',
            ExpressionAttributeValues: { ':tune': 'TUNE#' },
            ExclusiveStartKey: key,
        }));
        votes.push(...(r.Items ?? []));
        key = r.LastEvaluatedKey;
    } while (key);
    return votes;
}

export async function getRegisteredUserIds() {
    return new Set((await getRegisteredUsers()).map(u => u.user_id));
}

// The gsi_email index is sparse: only registered users carry email_lc, so a
// scan of it enumerates exactly the registered users (566 in prod).
export async function getRegisteredUsers() {
    const users = [];
    let key;
    do {
        const r = await ddb.send(new ScanCommand({
            TableName: TABLE, IndexName: 'gsi_email', ExclusiveStartKey: key,
        }));
        users.push(...(r.Items ?? []));
        key = r.LastEvaluatedKey;
    } while (key);
    return users;
}

// ---- password reset tokens ----

export async function putResetToken(token, userId, expiresEpoch) {
    await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: { PK: `RESET#${token}`, SK: 'META', user_id: userId,
                expires: expiresEpoch, ttl: expiresEpoch + 24 * 3600 },
    }));
}

export async function getResetToken(token) {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `RESET#${token}`, SK: 'META' } }));
    return r.Item ?? null;
}

export async function deleteResetToken(token) {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: `RESET#${token}`, SK: 'META' } }));
}
