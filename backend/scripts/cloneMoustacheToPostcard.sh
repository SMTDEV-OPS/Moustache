#!/usr/bin/env bash
# Clone one MongoDB database into another (same shape as Moustache → Postcard).
#
# Requires MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools
#   (mongodump / mongorestore on PATH)
#
# Usage (from backend/):
#   export SOURCE_MONGO_URI='mongodb+srv://USER:PASS@cluster.mongodb.net/moustache_crm?retryWrites=true&w=majority'
#   export TARGET_MONGO_URI='mongodb+srv://USER:PASS@cluster.mongodb.net/postcard_crm?retryWrites=true&w=majority'
#   npm run db:clone:moustache-to-postcard
#
# Optional overrides:
#   SOURCE_DB_NAME=moustache_crm TARGET_DB_NAME=postcard_crm
#
# WARNING: --drop replaces collections in the TARGET database with data from SOURCE.

set -euo pipefail

: "${SOURCE_MONGO_URI:?Set SOURCE_MONGO_URI (full URI including /moustache_crm path)}"
: "${TARGET_MONGO_URI:?Set TARGET_MONGO_URI (full URI including /postcard_crm path)}"

SOURCE_DB="${SOURCE_DB_NAME:-moustache_crm}"
TARGET_DB="${TARGET_DB_NAME:-postcard_crm}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DUMP_DIR="${DUMP_DIR:-$SCRIPT_DIR/../.mongo-dump-tmp}"

if ! command -v mongodump >/dev/null 2>&1 || ! command -v mongorestore >/dev/null 2>&1; then
  echo "mongodump/mongorestore not found. Install MongoDB Database Tools and add them to PATH."
  exit 1
fi

rm -rf "$DUMP_DIR"
mkdir -p "$DUMP_DIR"

echo "Step 1/2: mongodump from ${SOURCE_DB} ..."
mongodump --uri="$SOURCE_MONGO_URI" --out="$DUMP_DIR"

echo "Step 2/2: mongorestore into ${TARGET_DB} (--drop replaces target collections) ..."
mongorestore --uri="$TARGET_MONGO_URI" --drop \
  --nsFrom="${SOURCE_DB}.*" \
  --nsTo="${TARGET_DB}.*" \
  "$DUMP_DIR"

echo "Done. Target database ${TARGET_DB} should now match ${SOURCE_DB} (collection data)."
echo "Update backend/.env MONGO_URI to point at ${TARGET_DB} if needed, then restart the API."
