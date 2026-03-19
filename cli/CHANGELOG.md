# 1tt CLI Changelog

## v0.1.x (initial release)

- `tunnel` command — connect local PostgreSQL or Redis to 1tt.dev studio
- Auto-detect dialect from connection string
- WebSocket tunnel with ping/pong keepalive
- Schema introspection for PostgreSQL (information_schema) and Redis (key sampling)
- Graceful shutdown on SIGINT/SIGTERM
- Retry with exponential backoff on connection failure
- TTY-aware colored output
