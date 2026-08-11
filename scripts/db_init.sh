#!/usr/bin/env bash
# ===========================================================================
# db_init.sh — reproduce the PostgreSQL analytical database from scratch.
#
# 1. Starts a dedicated Postgres container (postgres:17) on host port 5433.
# 2. Waits until it is ready.
# 3. Applies sql/00_schema.sql and sql/01_indexes.sql.
#
# Usage:  bash scripts/db_init.sh
# Then:   .venv/bin/python scripts/load_to_postgres.py
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

CONTAINER="${DB_CONTAINER:-fashion-bi-postgres}"
PORT="${DB_PORT:-5433}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-fashion_bi}"
IMAGE="postgres:17"

# --- start container if not running ----------------------------------------
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "[db_init] starting container '$CONTAINER' on port $PORT ..."
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker run -d \
        --name "$CONTAINER" \
        -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        -e POSTGRES_DB="$DB_NAME" \
        -p "${PORT}:5432" \
        -v "${CONTAINER}_pgdata:/var/lib/postgresql/data" \
        "$IMAGE" >/dev/null
else
    echo "[db_init] container '$CONTAINER' already running"
fi

# --- wait for readiness -----------------------------------------------------
echo -n "[db_init] waiting for PostgreSQL"
for _ in $(seq 1 60); do
    if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
        echo " ready"
        break
    fi
    echo -n "."
    sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 \
    || { echo "[db_init] PostgreSQL did not become ready"; exit 1; }

# --- apply schema + indexes + views ----------------------------------------
echo "[db_init] applying sql/00_schema.sql ..."
docker exec -i "$CONTAINER" psql -U postgres -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    < "$ROOT/sql/00_schema.sql"
echo "[db_init] applying sql/01_indexes.sql ..."
docker exec -i "$CONTAINER" psql -U postgres -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    < "$ROOT/sql/01_indexes.sql"
echo "[db_init] applying sql/03_views.sql ..."
docker exec -i "$CONTAINER" psql -U postgres -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    < "$ROOT/sql/03_views.sql"

echo "[db_init] done. Connection: host=localhost port=${PORT} db=${DB_NAME} user=postgres"
