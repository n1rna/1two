# 1tt.dev Development Commands
# Run with: just <command>

# Default recipe to display help
default:
    @just --list

# =========================================
# Helper Recipes
# =========================================

# Run command with all env vars loaded (web + api)
with-env *args:
    ee apply .env.web.development -- ee apply .env.api.development -- {{args}}

# Run command with web env vars loaded
with-env-web *args:
    ee apply .env.web.development -- {{args}}

# Run command with api env vars loaded
with-env-api *args:
    ee apply .env.api.development -- {{args}}

# Verify all ee project schemas
ee-verify:
    @echo "=== Verifying web ===" && cp .ee.web .ee && ee verify --env development; rm -f .ee
    @echo "=== Verifying api ===" && cp .ee.api .ee && ee verify --env development; rm -f .ee

# =========================================
# Setup and Installation
# =========================================

# Install all dependencies
install:
    bun install --frozen-lockfile
    cd api && go mod download

# =========================================
# Development
# =========================================

# Start Next.js dev server (1tt.dev on :3000)
dev:
    bun run --filter ./apps/web dev

# Start Kim dev server (kim1.ai on :3001)
dev-kim:
    bun run --filter ./apps/kim dev

# Start Go API server
api:
    just with-env-api bash -c '"cd api && go run ./cmd/server"'

# Start web + api in parallel
dev-all:
    just api &
    just dev

# Start web + kim + api in parallel
dev-everything:
    just api &
    just dev-kim &
    just dev

# =========================================
# Code Generation
# =========================================

# Generate API client hooks from OpenAPI spec
api-generate:
    bunx kubb generate

# =========================================
# Build
# =========================================

# Build Next.js for production (web)
build:
    bun run --filter ./apps/web build

# Build Kim for production
build-kim:
    bun run --filter ./apps/kim build

# Build Go API binary
api-build:
    cd api && CGO_ENABLED=0 go build -o server ./cmd/server

# Build Go API Docker image
api-docker-build:
    cd api && docker build -t 1tt-api .

# =========================================
# Testing
# =========================================

# Run unit tests
test:
    just with-env-web bun run test

# Run e2e tests
test-e2e:
    just with-env-web bun run test:e2e

# Run Go tests
api-test:
    just with-env-api bash -c '"cd api && go test ./..."'

# Run life agent integration tests (hits real LLM, mocks tools)
api-test-life:
    just with-env-api bash -c '"cd api && RUN_LIFE_INTEGRATION=1 go test -tags=integration -v -timeout 30m ./internal/life/..."'

# =========================================
# Linting & Formatting
# =========================================

# Lint frontend
lint:
    bun run lint

# Type-check frontend
typecheck:
    bunx --bun tsc --noEmit

# Format Go code
api-fmt:
    cd api && go fmt ./...

# Lint Go code
api-lint:
    cd api && go vet ./...

# =========================================
# Database
# =========================================

# Run better-auth migrations (creates tables)
db-migrate:
    just with-env-web bunx @better-auth/cli migrate

# Run goose migrations against the API database (applies all pending Up migrations)
db-migrate-api:
    just with-env-api bash -c '"cd api && goose -dir internal/database/migrations postgres \"$DATABASE_URL\" up"'

# Create a new goose migration file — usage: just db-create-migration <name>
db-create-migration name:
    cd api && goose -dir internal/database/migrations create {{name}} sql

# =========================================
# Deployment (Cloudflare)
# =========================================

# Build web for Cloudflare Workers
cf-build:
    bun run --filter ./apps/web cf:build

# Build kim for Cloudflare Workers
cf-build-kim:
    bun run --filter ./apps/kim cf:build

# Preview web on local Cloudflare dev
cf-preview:
    bun run --filter ./apps/web cf:preview

# Preview kim on local Cloudflare dev
cf-preview-kim:
    bun run --filter ./apps/kim cf:preview

# Deploy web to Cloudflare Workers
cf-deploy:
    bun run --filter ./apps/web cf:deploy

# Deploy kim to Cloudflare Workers
cf-deploy-kim:
    bun run --filter ./apps/kim cf:deploy

# Deploy Go API container to Cloudflare
cf-deploy-api:
    cd workers/api-container && bun install && wrangler deploy

# Deploy everything (web + kim + api)
deploy: cf-deploy cf-deploy-kim cf-deploy-api

# Set a secret for the web worker
cf-secret-web name:
    cd apps/web && wrangler secret put {{name}}

# Set a secret for the kim worker
cf-secret-kim name:
    cd apps/kim && wrangler secret put {{name}}

# Set a secret for the api container worker
cf-secret-api name:
    cd workers/api-container && wrangler secret put {{name}}

# =========================================
# Tunnels
# =========================================

# Start a cloudflared tunnel to the local API server (for webhook testing)
tunnel port="8090":
    #!/usr/bin/env bash
    set -euo pipefail
    pkill -f "cloudflared tunnel" 2>/dev/null || true
    sleep 1
    # Download cloudflared if not present
    if [ ! -f /tmp/cloudflared ]; then
        echo "Downloading cloudflared..."
        curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
        chmod +x /tmp/cloudflared
    fi
    echo "Starting tunnel to localhost:{{port}}..."
    /tmp/cloudflared tunnel --url http://localhost:{{port}} 2>&1 &
    PID=$!
    # Wait for the URL to appear in output
    for i in $(seq 1 30); do
        if URL=$(grep -o 'https://[^ |]*trycloudflare.com' /proc/$PID/fd/2 2>/dev/null); then
            echo ""
            echo "========================================="
            echo "Tunnel:  $URL"
            echo "Webhook: $URL/api/v1/webhooks/polar"
            echo "========================================="
            echo ""
            echo "Update this URL in your Polar webhook settings."
            echo "Press Ctrl+C to stop the tunnel."
            wait $PID
            exit 0
        fi
        sleep 1
    done
    echo "Tunnel started (PID: $PID) but couldn't detect URL."
    wait $PID

# Stop the cloudflared tunnel
tunnel-stop:
    pkill -f "cloudflared tunnel" 2>/dev/null || echo "No tunnel running"

# =========================================
# CLI
# =========================================

# Run the 1tt CLI (pass arguments after --)
cli *args:
    cd cli && go run . {{args}}

# Build the 1tt CLI binary
cli-build:
    cd cli && CGO_ENABLED=0 go build -o 1tt .

# =========================================
# Utilities
# =========================================

# Clean build artifacts
clean:
    rm -rf .next out node_modules
    cd api && rm -f server

# Show project status
status:
    @echo "=== Git Status ==="
    @git status --short
    @echo ""
    @echo "=== Dependencies ==="
    @if [ -d node_modules ]; then echo "✅ Node dependencies installed"; else echo "❌ Node dependencies missing"; fi
    @echo ""
    @echo "=== Go Modules ==="
    @cd api && if go build ./... > /dev/null 2>&1; then echo "✅ Go modules OK"; else echo "❌ Go build issues"; fi
    @echo ""
    @echo "=== Environment ==="
    @ee apply development -c .ee.web --dry-run 2>/dev/null | grep -c export | xargs -I{} echo "✅ {} web env vars configured"
    @ee apply development -c .ee.api --dry-run 2>/dev/null | grep -c export | xargs -I{} echo "✅ {} api env vars configured"
