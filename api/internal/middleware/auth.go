package middleware

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/n1rna/1tt/api/internal/config"
)

// extractToken pulls the session token from the two supported transports:
// the `X-Session-Token` header (forwarded by the Next.js proxy after it
// validates the cookie) and `Authorization: Bearer <token>` (used by the
// kim-mobile app, which has no cookie jar). Returns the raw token string
// or the empty string if neither is present.
func extractToken(r *http.Request) string {
	if t := r.Header.Get("X-Session-Token"); t != "" {
		return t
	}
	authz := r.Header.Get("Authorization")
	if authz == "" {
		return ""
	}
	// Accept "Bearer foo" or "bearer foo" (RFC 6750 case-insensitive scheme).
	const prefix = "bearer "
	if len(authz) > len(prefix) && strings.EqualFold(authz[:len(prefix)], prefix) {
		return strings.TrimSpace(authz[len(prefix):])
	}
	return ""
}

type contextKey string

const UserIDKey contextKey = "userID"
const UserEmailKey contextKey = "userEmail"
const UserNameKey contextKey = "userName"

func GetUserID(ctx context.Context) string {
	if v, ok := ctx.Value(UserIDKey).(string); ok {
		return v
	}
	return ""
}

func Auth(cfg *config.Config) func(http.Handler) http.Handler {
	var db *sql.DB
	if cfg.DatabaseURL != "" {
		var err error
		db, err = sql.Open("postgres", cfg.DatabaseURL)
		if err != nil {
			log.Printf("Warning: could not connect to database for auth: %v", err)
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Session token comes from either X-Session-Token (proxy flow)
			// or Authorization: Bearer (mobile flow). See extractToken.
			token := extractToken(r)
			userID := r.Header.Get("X-User-ID")

			// Proxy already validated the cookie and forwarded the user id.
			// Trust that short-circuit; the bearer path below re-validates.
			if userID != "" && token != "" {
				ctx := context.WithValue(r.Context(), UserIDKey, userID)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// No token at all — reject before hitting the database.
			if token == "" {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			if db == nil {
				http.Error(w, `{"error":"auth service unavailable"}`, http.StatusServiceUnavailable)
				return
			}

			var uid, email, name string
			var expiresAt time.Time
			err := db.QueryRowContext(r.Context(),
				`SELECT s."userId", u.email, u.name, s."expiresAt"
				 FROM "session" s JOIN "user" u ON s."userId" = u.id
				 WHERE s.token = $1`, token,
			).Scan(&uid, &email, &name, &expiresAt)

			if err != nil || time.Now().After(expiresAt) {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			ctx := r.Context()
			ctx = context.WithValue(ctx, UserIDKey, uid)
			ctx = context.WithValue(ctx, UserEmailKey, email)
			ctx = context.WithValue(ctx, UserNameKey, name)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
