#!/usr/bin/env bash
# Generate the static HVSC catalog JSON from the sidtunes table.
#
# Produces www/catalog/sidtunes.json (+ .gz). The catalog is immutable per
# HVSC release: it holds only sid_id + fullpath, never win/loss data, so it
# can be served as a static file (locally by Apache, on AWS by S3/CloudFront).
#
# Usage: tools/generate_catalog.sh [HVSC_VERSION]   (default: HVSC_83)
# Requires the docker compose stack to be up (reads from sidjam-db).
set -euo pipefail

cd "$(dirname "$0")/.."

HVSC_VERSION="${1:-HVSC_83}"
OUT_DIR="www/catalog"

# Rootless docker on this host unless caller already set DOCKER_HOST
export PATH="$HOME/bin:$PATH"
export DOCKER_HOST="${DOCKER_HOST:-unix:///run/user/$(id -u)/docker.sock}"

# DB creds from .env (same file compose uses); tolerate CRLF line endings
set -a; source <(sed 's/\r$//' .env); set +a

mkdir -p "$OUT_DIR"

# Build into a temp file and only move it into place once the query AND the
# JSON encoding have both succeeded. Redirecting straight onto sidtunes.json
# truncates it the instant the shell opens it -- so a failure here (e.g. the
# sidjam-db container being down) used to leave an empty count=0 catalog on
# disk, one `aws s3 sync` away from blanking the live song list.
TMP="$(mktemp "$OUT_DIR/.sidtunes.json.XXXXXX")"
trap 'rm -f "$TMP" "$TMP.gz"' EXIT

docker compose exec -T sidjam-db mysql -N -B \
    -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
    -e "SELECT sid_id, fullpath FROM sidtunes ORDER BY fullpath ASC" \
| python3 -c '
import json, sys

tunes = []
for line in sys.stdin:
    sid_id, fullpath = line.rstrip("\n").split("\t", 1)
    tunes.append([int(sid_id), fullpath])

if not tunes:
    sys.exit("generate_catalog: refusing to write an empty catalog")

catalog = {"hvsc": sys.argv[1], "count": len(tunes), "tunes": tunes}
json.dump(catalog, sys.stdout, separators=(",", ":"), ensure_ascii=False)
' "$HVSC_VERSION" > "$TMP"

gzip -9 -k -f "$TMP"
mv "$TMP"    "$OUT_DIR/sidtunes.json"
mv "$TMP.gz" "$OUT_DIR/sidtunes.json.gz"
trap - EXIT

ls -l "$OUT_DIR/sidtunes.json" "$OUT_DIR/sidtunes.json.gz"
python3 -c '
import json
c = json.load(open("'"$OUT_DIR"'/sidtunes.json"))
print("hvsc=%s count=%d first=%s last=%s" % (c["hvsc"], c["count"], c["tunes"][0], c["tunes"][-1]))
'
