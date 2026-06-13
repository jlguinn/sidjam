// MySQL -> DynamoDB migration (story 65, task 482).
//
// Creates the table (if needed) and loads siduser + sidjam from the local
// MySQL container into DynamoDB. sidtunes is NOT migrated (it is the static
// catalog); password_resets is NOT migrated (all tokens long expired).
//
//   node lambda/tools/migrate_to_dynamo.mjs [--prune] [--table sidjam] [--endpoint http://localhost:8001]
//
// --prune drops zero-vote registered accounts (bots) and guest rows with no
// votes and no return visit. Default keeps everything so diff runs against
// data identical to the PHP reference.
import { execFileSync } from 'node:child_process';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const PRUNE = args.includes('--prune');
const TABLE = opt('--table', 'sidjam');
const ENDPOINT = opt('--endpoint', 'http://localhost:8001');
const DB = opt('--db', 'sidjam');
const WIPE = args.includes('--wipe');

const client = ENDPOINT === 'aws'
    ? new DynamoDBClient({ region: 'us-east-1' })   // real AWS, ambient credentials
    : new DynamoDBClient({
        endpoint: ENDPOINT, region: 'us-east-1',
        credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    });
const ddb = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

// --- read MySQL via docker exec, one JSON document per row (collation-safe) ---
function mysqlRows(sql) {
    const out = execFileSync('docker', [
        'compose', 'exec', '-T', 'sidjam-db',
        'mysql', '-N', '-B', '-r', '-usiduser', '-pjam@sid2025', DB, '-e', sql,
    ], {
        cwd: new URL('../..', import.meta.url).pathname,
        env: { ...process.env, PATH: `${process.env.HOME}/bin:${process.env.PATH}`,
               DOCKER_HOST: process.env.DOCKER_HOST ?? `unix:///run/user/${process.getuid()}/docker.sock` },
        maxBuffer: 256 * 1024 * 1024,
    }).toString('utf8');
    return out.split('\n').filter(Boolean).map(l => JSON.parse(l));
}

async function ensureTable() {
    try {
        await client.send(new DescribeTableCommand({ TableName: TABLE }));
        console.log(`table ${TABLE} exists`);
        return;
    } catch { /* create below */ }
    await client.send(new CreateTableCommand({
        TableName: TABLE,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
            { AttributeName: 'PK', AttributeType: 'S' },
            { AttributeName: 'SK', AttributeType: 'S' },
            { AttributeName: 'email_lc', AttributeType: 'S' },
            { AttributeName: 'session_id', AttributeType: 'S' },
            { AttributeName: 'username_lc', AttributeType: 'S' },
        ],
        KeySchema: [
            { AttributeName: 'PK', KeyType: 'HASH' },
            { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
            { IndexName: 'gsi_email',
              KeySchema: [{ AttributeName: 'email_lc', KeyType: 'HASH' }],
              Projection: { ProjectionType: 'ALL' } },
            { IndexName: 'gsi_session',
              KeySchema: [{ AttributeName: 'session_id', KeyType: 'HASH' }],
              Projection: { ProjectionType: 'ALL' } },
            { IndexName: 'gsi_uname',
              KeySchema: [{ AttributeName: 'username_lc', KeyType: 'HASH' }],
              Projection: { ProjectionType: 'ALL' } },
        ],
    }));
    console.log(`table ${TABLE} created`);
}

async function batchPut(items) {
    for (let i = 0; i < items.length; i += 25) {
        const chunk = items.slice(i, i + 25).map(Item => ({ PutRequest: { Item } }));
        let req = { RequestItems: { [TABLE]: chunk } };
        do {
            const r = await ddb.send(new BatchWriteCommand(req));
            req = r.UnprocessedItems && Object.keys(r.UnprocessedItems).length
                ? { RequestItems: r.UnprocessedItems } : null;
        } while (req);
    }
}

const users = mysqlRows(`SELECT JSON_OBJECT(
    'user_id', user_id, 'username', UserName, 'session_id', session_id,
    'reg_date', DATE_FORMAT(RegDate, '%Y-%m-%d'),
    'last_access_date', DATE_FORMAT(LastAccessDate, '%Y-%m-%d'),
    'email', email, 'password', password, 'player_state', player_state
) FROM siduser`);
const votes = mysqlRows(`SELECT JSON_OBJECT(
    'user_id', user_id, 'sid_id', sid_id, 'win', win, 'loss', loss
) FROM sidjam`);

const votedUsers = new Set(votes.map(v => v.user_id));
let kept = users;
if (PRUNE) {
    kept = users.filter(u =>
        votedUsers.has(u.user_id) ||
        (u.email && u.last_access_date > u.reg_date));
    console.log(`prune: keeping ${kept.length} of ${users.length} users`);
}
const keptIds = new Set(kept.map(u => u.user_id));
const keptVotes = votes.filter(v => keptIds.has(v.user_id) || !PRUNE);

await ensureTable();

if (WIPE) {
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    let wiped = 0, key;
    do {
        const r = await ddb.send(new ScanCommand({ TableName: TABLE,
            ProjectionExpression: 'PK, SK', ExclusiveStartKey: key }));
        for (let i = 0; i < r.Items.length; i += 25) {
            const chunk = r.Items.slice(i, i + 25).map(Key => ({ DeleteRequest: { Key } }));
            let req = { RequestItems: { [TABLE]: chunk } };
            do {
                const w = await ddb.send(new BatchWriteCommand(req));
                req = w.UnprocessedItems && Object.keys(w.UnprocessedItems).length
                    ? { RequestItems: w.UnprocessedItems } : null;
            } while (req);
            wiped += chunk.length;
        }
        key = r.LastEvaluatedKey;
    } while (key);
    console.log(`wiped ${wiped} existing items`);
}

const userItems = kept.map(u => ({
    PK: `USER#${u.user_id}`, SK: 'META',
    user_id: u.user_id,
    username: u.username, session_id: u.session_id,
    reg_date: u.reg_date, last_access_date: u.last_access_date,
    email: u.email, password: u.password, player_state: u.player_state,
    ...(u.email ? { email_lc: u.email.toLowerCase() } : {}),
    ...(u.username ? { username_lc: u.username.toLowerCase() } : {}),
}));
const voteItems = keptVotes.map(v => ({
    PK: `USER#${v.user_id}`, SK: `TUNE#${v.sid_id}`,
    user_id: v.user_id, sid_id: v.sid_id, win: v.win, loss: v.loss,
}));

await batchPut(userItems);
await batchPut(voteItems);

const maxId = Math.max(...users.map(u => u.user_id));
await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { PK: 'COUNTER', SK: 'META', next_user_id: maxId },
}));

console.log(`migrated: ${userItems.length} users, ${voteItems.length} votes, next_user_id allocator at ${maxId} (allocates ${maxId + 1} next)`);
