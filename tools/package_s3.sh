#!/usr/bin/env bash
# Sync the static site to S3 (story 65, task 483).
#
# Ships: built index.html (NOT index.php), src/ INCLUDING the vendored player
# engines (websid + webaudio-player are gitignored third-party clones - they
# exist only in the working copy), image/, help.html, catalog/, and the live
# HVSC tree. Excludes the PHP backend (dbcontrol -> Lambda) and composer junk.
#
# Usage: tools/package_s3.sh <bucket> [--live]     (dry-run unless --live)
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET="${1:?usage: tools/package_s3.sh <bucket> [--live]}"
DRY=(--dryrun); [[ "${2:-}" == "--live" ]] && DRY=()

node lambda/tools/build_index.mjs
tools/generate_catalog.sh > /dev/null

# Site payload (small, changes per release): everything except exclusions
aws s3 sync www "s3://$BUCKET" "${DRY[@]}" --delete \
    --exclude "index.php" \
    --exclude "dbcontrol/*" \
    --exclude "vendor/*" --exclude "composer.*" \
    --exclude "sid/*" \
    --exclude "src/websid/.git/*" --exclude "src/webaudio-player/.git/*" \
    --exclude "*.gz"

# HVSC tree (452MB, immutable per release): size-only comparison, never delete
aws s3 sync www/sid/HVSC_83-all-of-them "s3://$BUCKET/sid/HVSC_83-all-of-them" \
    "${DRY[@]}" --size-only

echo "package_s3: done (bucket $BUCKET${DRY:+, DRY RUN})"
