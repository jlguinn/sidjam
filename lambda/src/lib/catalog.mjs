// The static HVSC catalog ({hvsc, count, tunes: [[sid_id, fullpath], ...]},
// fullpath-ASC in MySQL collation order). Loaded once per Lambda container:
// from disk locally (CATALOG_PATH), from S3 in production.
import { readFile } from 'node:fs/promises';

let cached = null;

export async function getCatalog() {
    if (cached) return cached;
    let raw;
    if (process.env.CATALOG_PATH) {
        raw = await readFile(process.env.CATALOG_PATH, 'utf8');
    } else {
        const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
        const s3 = new S3Client({});
        const r = await s3.send(new GetObjectCommand({
            Bucket: process.env.CATALOG_BUCKET,
            Key: process.env.CATALOG_KEY ?? 'catalog/sidtunes.json',
        }));
        raw = await r.Body.transformToString();
    }
    const parsed = JSON.parse(raw);
    // tunes carry their catalog index so sorts can tie-break in the exact
    // fullpath order MySQL produced (its collation, its tie resolution).
    cached = parsed.tunes.map(([id, fullpath], idx) => ({ id, fullpath, idx }));
    return cached;
}
