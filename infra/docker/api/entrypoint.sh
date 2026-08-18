#!/bin/sh
set -e

# ── Remote Docker TLS (Railway / Option B deployment) ─────────────────────
# When DOCKER_CA_CERT, DOCKER_CLIENT_CERT, and DOCKER_CLIENT_KEY are set as
# base64-encoded env vars, decode them to /tmp/docker-certs and configure
# DOCKER_CERT_PATH so the Docker CLI uses TLS for remote daemon connections.
if [ -n "${DOCKER_CA_CERT:-}" ] && [ -n "${DOCKER_CLIENT_CERT:-}" ] && [ -n "${DOCKER_CLIENT_KEY:-}" ]; then
  echo "Configuring remote Docker TLS from environment..."
  DOCKER_CERTS_DIR=/tmp/docker-certs
  mkdir -p "$DOCKER_CERTS_DIR"
  printf '%s' "$DOCKER_CA_CERT"     | base64 -d > "$DOCKER_CERTS_DIR/ca.pem"
  printf '%s' "$DOCKER_CLIENT_CERT" | base64 -d > "$DOCKER_CERTS_DIR/cert.pem"
  printf '%s' "$DOCKER_CLIENT_KEY"  | base64 -d > "$DOCKER_CERTS_DIR/key.pem"
  chmod 600 "$DOCKER_CERTS_DIR"/*.pem
  export DOCKER_CERT_PATH="$DOCKER_CERTS_DIR"
  export DOCKER_TLS_VERIFY=1
  echo "Remote Docker TLS ready (host: ${DOCKER_HOST:-unset})"
fi
# ──────────────────────────────────────────────────────────────────────────

# Wait for database to be ready (simple retry loop)
echo "Waiting for database..."
until node -e "
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.connect().then(() => { client.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  echo "Database not ready, retrying in 2s..."
  sleep 2
done
echo "Database is ready!"

# Run migrations
echo "Running database migrations..."
cd /app
npx prisma migrate deploy --schema=prisma/schema.prisma
echo "Migrations complete!"

# Bootstrap initial admin + baseline config (idempotent; silent no-op when
# INITIAL_ADMIN_EMAIL is unset).
if [ -f /app/dist/bootstrap.js ]; then
  echo "Running bootstrap..."
  node /app/dist/bootstrap.js
fi

# Start the application
echo "Starting Clawix API..."
exec node dist/main.js
