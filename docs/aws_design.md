# sID JAm on AWS — design (story 65, task 480)

**Status: DRAFT 2026-06-12 — for Jim's approval; Judith to review the CloudFront/DNS/cert pieces.**

## Goal

Replace GoDaddy shared hosting (PHP/MySQL, expiring cert ~mid-2027) with a serverless AWS
stack at ~$0–1/month, **without touching the frontend UI** and **without changing the
`/dbcontrol/*` URL contract** the frontend depends on. Local Docker remains the behavioral
reference: every ported endpoint is diffed against the PHP responses before cutover.

The agreed principle: **port the data, not the PHP.** Story 64 (done 2026-06-12) already
shrank the backend's job — the 59,886-tune catalog is now a static JSON file, so the dynamic
surface is just small reads/writes against two tiny tables.

## Architecture

```
                      sidjam.com (DNS: Judith / cutover story 66)
                                     │
                              CloudFront (+ ACM cert, free)
                                     │
              ┌──────────────────────┴───────────────────────┐
              │ default behavior                              │ /dbcontrol/*
              ▼                                               ▼
        S3 bucket (private, OAC)                     Lambda Function URL (OAC)
        ├── index.html + src/ (frontend, ~16MB)      one Node.js function, router
        ├── catalog/sidtunes.json[.gz] (663KB gz)    inside (the whole PHP backend
        ├── sid/HVSC_83-all-of-them/ (452MB,         is 1,745 lines — one Lambda
        │     immutable per HVSC release)            is plenty)
        └── image/, favicon, help.html                        │
                                                              ▼
                                                     DynamoDB (single table,
                                                     on-demand) + SES (email)
```

- **CloudFront** terminates TLS with a free auto-renewing ACM certificate — this retires the
  GoDaddy cert problem permanently. Static assets cache at the edge; `/dbcontrol/*` passes
  through uncached (`CachingDisabled` policy). Compression (gzip/brotli) is automatic for the
  catalog and JSON responses.
- **S3** is private; CloudFront reaches it via Origin Access Control. Versioned "release"
  prefixes are unnecessary at this scale — HVSC upgrades (story 67) sync a new `sid/HVSC_84…/`
  tree + regenerate the catalog.
- **One Lambda** (Node.js 22, ~256MB) routes on path. Function URL + CloudFront OAC avoids
  API Gateway entirely (cheaper, fewer moving parts). Cold starts are irrelevant for 5 users.
- **IaC: AWS SAM** — matches the lab's existing Adventure Castle deployment pattern.

## Endpoint inventory (`/dbcontrol/*` contract)

| Endpoint | What it does | Port disposition |
|---|---|---|
| `get_sidtunes.php` | filtered/paged browse; `full_list` leaderboard | Port. Filter runs in-memory against the catalog (it's 3MB; Lambda holds it warm) + vote overlay. Leaderboard from aggregate items. The startup `full_list&user_id` variant is already dead (story 64) but stays supported for old cached clients. |
| `get_results.php` | user's win/loss map | Port — Query votes by user. |
| `get_player_state.php` / `save_state.php` | per-user UI state blob (≤553 bytes measured) | Port — attribute on the user item. |
| `log_result.php`, `reset_result.php`, `revive_song.php` | vote writes | Port — upsert vote item + transactional leaderboard aggregate update. |
| `signin.php`, `register.php`, `logout.php` | auth; guests keyed by browser-signature `session_id` | Port as-is (same weak-auth contract — client supplies `user_id`; hardening is explicitly out of scope, ~5 real users). |
| `update_email/password/username.php`, `delete_account.php` | account ops | Port. |
| `send_reset_email.php`, `reset_password.php` | password reset | Port — SES SDK via **Lambda execution role**, token items with DynamoDB TTL. |
| `get_registered_users.php` | admin user counts | Port — three counters maintained on write (or scan; 12K items, pennies). |
| `test_db.php`, `test_pdo.php`, `phpinfo.php` | debug pages | **Drop** (security liability, unused by frontend). |
| `admin/import_songs.php` | catalog import | **Drop** — replaced by `tools/generate_catalog.sh`. |
| `Mailer*.php`, `sidcon.php` | SMTP + DB creds plumbing | Obsolete — no SMTP creds, no DB creds, no IAM keypair. |

## DynamoDB model (single table `sidjam`, on-demand)

Scale reality: 12,250 user rows (566 registered, ~5 active, rest guests/bots), 964 vote rows,
423 leaderboard tunes, state blobs <1KB. Everything fits free tier with room to spare.

| Item | PK | SK | Attributes |
|---|---|---|---|
| User | `USER#<user_id>` | `META` | username, email, password_hash, session_id, player_state, created |
| Vote | `USER#<user_id>` | `TUNE#<sid_id>` | wins, losses |
| Leaderboard agg | `TUNE#<sid_id>` | `AGG` | wins, losses (registered users only, updated transactionally with vote writes) |
| Reset token | `RESET#<token>` | `META` | user_id, expires (**TTL**) |
| Counters | `COUNTER` | `META` | next user_id (the PHP/MySQL contract exposes numeric auto-increment user_ids — keep allocating them) |

GSIs: `email → user` (signin/register uniqueness), `session_id → user` (guest bootstrap).

Leaderboard = Query `SK=AGG, wins > 0` via sparse GSI or just a filtered scan — at 423 items
either is effectively free. Aggregates are rebuilt from vote items by a repair script if they
ever drift.

## Security improvements that fall out for free

- **Prod MySQL password** (public in repo history): obsolete — there is no MySQL. Still change
  it in cPanel at cutover while GoDaddy remains live (story 66).
- **SES IAM keypair** (live in `dbcontrol_sidjam/sidcon.php` on prod): obsolete — Lambda sends
  via its execution role. The key is *deleted*, not rotated, at cutover (per Jim: not before).
- Debug endpoints (`phpinfo` etc.) don't ship.
- S3 private + OAC; no public buckets.

## Migration (task 482)

1. `siduser` → user items. **Open question for Jim:** prune the ~560 zero-vote registrations
   (bots) and inactive guest rows during migration, or carry everything?
2. `sidjam` → vote items; rebuild leaderboard aggregates from them; verify against the local
   PHP leaderboard response.
3. `sidtunes` → not migrated (it *is* the static catalog now). `password_resets` → not
   migrated (all expired).
4. Rehearse the whole pipeline against the local 2026-06-10 dump; at cutover, re-run from a
   fresh phpMyAdmin dump (story 66, with Judith).

## Packaging (task 483)

S3 sync from the working copy, **not** the repo alone: the vendored player engines
`www/src/websid/` (5.0MB) + `www/src/webaudio-player/` (1.2MB) are gitignored third-party
clones (Wothke; provenance: websid + webaudio-player on GitHub) and must ship. Excludes:
`dbcontrol/` (becomes Lambda), `vendor/`, HVSC_82 tree (only `HVSC_83-all-of-them` is live).

## Cost estimate (us-east-1, 5 active users)

| Item | Monthly |
|---|---|
| S3 storage ~470MB | ~$0.011 |
| CloudFront | $0 (free tier: 1TB transfer, 10M requests) |
| Lambda + DynamoDB on-demand | ~$0 (free tier covers this by orders of magnitude) |
| SES | $0 (handful of reset emails) |
| ACM cert | $0 |
| **Total** | **≈ $0.01–1/month** (vs GoDaddy hosting + cert renewal) |

DNS stays wherever Judith wants it (GoDaddy registrar pointing at CloudFront is fine; Route53
hosted zone would add $0.50/mo).

## Open questions

1. **Account** (blocks deployment, not development): lab account 635049915575 (extend
   `eli-agent` IAM policy to `sidjam-*` resources) vs Jim's personal account (where the
   current SES key lives; would need new scoped credentials). Judith's call to make with Jim.
2. **SES sender identity**: which verified domain/address sends password resets after cutover
   (currently `sidjam.com` mail via SES from Jim's account)? Needs domain verification in
   whichever account wins question 1.
3. **Bot pruning** during migration (see above) — Jim's call, can be decided as late as
   task 482.

## Build order

1. ~~Design doc~~ (this document) → Jim approves, Judith reviews CloudFront/DNS section.
2. Lambda API built and tested entirely locally: `sam local start-api` + DynamoDB Local,
   response-diffed against the Docker PHP stack per endpoint (task 481).
3. Migration script, rehearsed locally (task 482).
4. S3 package dry run (task 483).
5. Deploy to the chosen account; private smoke test via CloudFront default domain — all
   before any DNS change (cutover is story 66).

---

## Implementation notes (2026-06-12, task 481 — local build VERIFIED)

- **Leaderboard is computed on read**, not maintained as write-time aggregate items
  (supersedes the "Leaderboard agg" row above). Reason: the SQL re-evaluates the
  "registered users" subquery at query time — a guest's old votes start counting the
  moment they register. Computing from vote items on read (a filtered scan, 964 rows)
  preserves those semantics exactly and removes the reconcile-on-register complexity.
- **New endpoint `bootstrap.php`**: the session/guest logic from index.php's PHP
  prologue (cookie → user, else mint guest), returning the `window.user` payload.
  Static index.html + a small script.js await replace the server-rendered bootstrap
  (wiring lands with task 483 packaging).
- **Sessions**: PHP `$_SESSION` + cookie dual-tracking collapses to the durable
  `session_id` cookie (30-day), which the PHP already used as fallback everywhere.
- **Reset-link path fixed**: emails now link `/dbcontrol/reset_password.php` (the PHP
  emailed `/help/reset_password.php`, which doesn't exist in the repo webroot).
- **Local parity proof**: `lambda/tools/diff_endpoints.mjs` replays identical request
  sequences (reads, auth flows, votes, account ops, resets, deletes) against the PHP
  stack (:8090, MySQL) and `lambda/local_server.mjs` (:9090, DynamoDB Local seeded by
  `lambda/tools/migrate_to_dynamo.mjs`): **65/65 checks pass**, plus an end-to-end
  reset-token happy path (request → token → form POST → signin → single-use) on both.
- Local PHP reference needed `aws/aws-sdk-php` composer-installed (email-sending
  success paths fatal'd without it — local-stack artifact, not a contract difference).
