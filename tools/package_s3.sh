#!/usr/bin/env bash
# Sync the static site to S3 (story 65, task 483).
#
# Ships: built index.html (NOT index.php), src/ INCLUDING the vendored player
# engines (websid + webaudio-player are gitignored third-party clones - they
# exist only in the working copy), image/, help.html, catalog/, and the live
# HVSC tree. Excludes the PHP backend (dbcontrol -> Lambda) and composer junk.
#
# Usage: tools/package_s3.sh <bucket> [--live] [--rebuild-catalog]
#   (dry-run unless --live)
#
# The catalog is immutable per HVSC release, so it is NOT rebuilt on a routine
# deploy -- rebuilding needs the legacy sidjam-db container, which no longer
# runs by default (story 69). Pass --rebuild-catalog when the HVSC release
# actually changes, with the compose stack up.
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET=""
DRY=(--dryrun)
REBUILD_CATALOG=0
for arg in "$@"; do
    case "$arg" in
        --live)            DRY=() ;;
        --rebuild-catalog) REBUILD_CATALOG=1 ;;
        -*)                echo "package_s3: unknown flag $arg" >&2; exit 2 ;;
        *)                 BUCKET="$arg" ;;
    esac
done
[[ -n "$BUCKET" ]] || { echo "usage: tools/package_s3.sh <bucket> [--live] [--rebuild-catalog]" >&2; exit 2; }

node lambda/tools/build_index.mjs

if (( REBUILD_CATALOG )); then
    tools/generate_catalog.sh > /dev/null
else
    echo "package_s3: skipping catalog rebuild (pass --rebuild-catalog to force)"
fi

# Never ship a missing or empty catalog: an empty one syncs cleanly over the
# good copy in S3 and silently blanks the live song list.
python3 -c '
import json, sys
try:
    c = json.load(open("www/catalog/sidtunes.json"))
except (OSError, ValueError) as e:
    sys.exit("package_s3: catalog unreadable (%s) -- refusing to sync" % e)
if not c.get("count") or not c.get("tunes"):
    sys.exit("package_s3: catalog is empty -- refusing to sync")
print("package_s3: catalog ok (hvsc=%s count=%d)" % (c["hvsc"], c["count"]))
'

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
