package handler

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/n1rna/1tt/api/internal/config"
	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/middleware"
)

// lifeChannelLinkRecord is the JSON representation of a life_channel_links row.
type lifeChannelLinkRecord struct {
	ID          string `json:"id"`
	UserID      string `json:"userId"`
	Channel     string `json:"channel"`
	ChannelUID  string `json:"channelUid"`
	Verified    bool   `json:"verified"`
	DisplayName string `json:"displayName"`
	CreatedAt   string `json:"createdAt"`
}

// ── Channel link management (authenticated) ──────────────────────────────────

// ListChannelLinks handles GET /life/channels.
// Returns all channel links for the authenticated user.
func ListChannelLinks(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		rows, err := db.QueryContext(r.Context(),
			`SELECT id, user_id, channel, channel_uid, verified, display_name, created_at
			 FROM life_channel_links
			 WHERE user_id = $1
			 ORDER BY created_at DESC`,
			userID,
		)
		if err != nil {
			log.Printf("life channels: list for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to list channel links"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		links := make([]lifeChannelLinkRecord, 0)
		for rows.Next() {
			var rec lifeChannelLinkRecord
			var createdAt time.Time
			if err := rows.Scan(
				&rec.ID, &rec.UserID, &rec.Channel, &rec.ChannelUID,
				&rec.Verified, &rec.DisplayName, &createdAt,
			); err != nil {
				http.Error(w, `{"error":"failed to read channel link"}`, http.StatusInternalServerError)
				return
			}
			rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			links = append(links, rec)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate channel links"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"links": links})
	}
}

// InitChannelLink handles POST /life/channels.
// Body: {"channel": "telegram"|"email", "channelUid": "..."}
// Generates a verify_code and inserts a new (unverified) channel link.
func InitChannelLink(db *sql.DB, resendClient *life.ResendClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Channel    string `json:"channel"`
			ChannelUID string `json:"channelUid"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.Channel = strings.TrimSpace(req.Channel)
		req.ChannelUID = strings.TrimSpace(req.ChannelUID)

		if req.Channel != "telegram" && req.Channel != "email" {
			http.Error(w, `{"error":"channel must be 'telegram' or 'email'"}`, http.StatusBadRequest)
			return
		}
		if req.Channel == "email" && req.ChannelUID == "" {
			http.Error(w, `{"error":"channelUid (email address) is required for email channel"}`, http.StatusBadRequest)
			return
		}

		// Generate verify code: 8 alphanumeric chars for telegram, 6 digits for email.
		var verifyCode string
		var err error
		if req.Channel == "telegram" {
			verifyCode, err = randomAlphanumeric(8)
		} else {
			verifyCode, err = randomDigits(6)
		}
		if err != nil {
			log.Printf("life channels: generate verify code: %v", err)
			http.Error(w, `{"error":"failed to generate verification code"}`, http.StatusInternalServerError)
			return
		}

		verifyExpires := time.Now().UTC().Add(15 * time.Minute)

		// For telegram, channelUid is unknown at init time (set during /start).
		// Use a unique placeholder to avoid duplicate key constraint on ('telegram', '').
		channelUID := req.ChannelUID
		if req.Channel == "telegram" {
			// Clean up any existing unverified telegram links for this user.
			db.ExecContext(r.Context(),
				`DELETE FROM life_channel_links WHERE user_id = $1 AND channel = 'telegram' AND verified = FALSE`,
				userID)
			channelUID = "pending:" + uuid.NewString()[:8]
		}

		displayName := "Telegram"
		if req.Channel == "email" {
			displayName = req.ChannelUID
			// Clean up any existing unverified email links for this user/email.
			db.ExecContext(r.Context(),
				`DELETE FROM life_channel_links WHERE user_id = $1 AND channel = 'email' AND channel_uid = $2 AND verified = FALSE`,
				userID, req.ChannelUID)
		}

		id := uuid.NewString()
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO life_channel_links
			 (id, user_id, channel, channel_uid, verified, display_name, verify_code, verify_expires)
			 VALUES ($1, $2, $3, $4, FALSE, $5, $6, $7)`,
			id, userID, req.Channel, channelUID, displayName, verifyCode, verifyExpires,
		); err != nil {
			log.Printf("life channels: insert channel link for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to create channel link"}`, http.StatusInternalServerError)
			return
		}

		// Send verification email for email channel.
		if req.Channel == "email" && resendClient != nil {
			if err := resendClient.SendVerificationEmail(r.Context(), req.ChannelUID, verifyCode); err != nil {
				log.Printf("life channels: send verification email to %s: %v", req.ChannelUID, err)
				// Non-fatal — the code is returned in the response anyway for dev
			}
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{
			"id":          id,
			"channel":     req.Channel,
			"verifyCode":  verifyCode,
			"displayName": displayName,
		})
	}
}

// VerifyChannelLink handles POST /life/channels/{id}/verify.
// Body: {"code": "123456"}
// Used for the email channel: checks the code and marks the link as verified.
func VerifyChannelLink(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		linkID := chi.URLParam(r, "id")

		var req struct {
			Code string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.Code = strings.TrimSpace(req.Code)
		if req.Code == "" {
			http.Error(w, `{"error":"code is required"}`, http.StatusBadRequest)
			return
		}

		res, err := db.ExecContext(r.Context(),
			`UPDATE life_channel_links
			 SET verified = TRUE, verify_code = NULL, verify_expires = NULL
			 WHERE id = $1
			   AND user_id = $2
			   AND verify_code = $3
			   AND verify_expires > NOW()
			   AND verified = FALSE`,
			linkID, userID, req.Code,
		)
		if err != nil {
			log.Printf("life channels: verify link %s: %v", linkID, err)
			http.Error(w, `{"error":"failed to verify channel link"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"invalid or expired verification code"}`, http.StatusBadRequest)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// DeleteChannelLink handles DELETE /life/channels/{id}.
func DeleteChannelLink(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		linkID := chi.URLParam(r, "id")

		res, err := db.ExecContext(r.Context(),
			`DELETE FROM life_channel_links WHERE id = $1 AND user_id = $2`,
			linkID, userID,
		)
		if err != nil {
			log.Printf("life channels: delete link %s: %v", linkID, err)
			http.Error(w, `{"error":"failed to delete channel link"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"channel link not found"}`, http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// ── Webhooks (public, self-authenticated) ─────────────────────────────────────

// TelegramWebhook handles POST /life/webhooks/telegram.
// Always returns 200 to prevent Telegram from retrying.
func TelegramWebhook(cfg *config.Config, db *sql.DB, agent *life.Agent) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// 1. Validate secret token.
		if !life.ValidateTelegramWebhook(r, cfg.TelegramWebhookSecret) {
			// Return 200 to avoid leaking information to attackers.
			w.WriteHeader(http.StatusOK)
			return
		}

		// 2. Parse the update.
		var update life.TelegramUpdate
		if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
			log.Printf("telegram webhook: decode body: %v", err)
			w.WriteHeader(http.StatusOK)
			return
		}

		// 3. Ignore empty or non-text messages.
		if update.Message == nil || update.Message.Text == "" {
			w.WriteHeader(http.StatusOK)
			return
		}

		msg := update.Message
		chatID := msg.Chat.ID
		text := msg.Text

		// 4. Handle /start <payload> — account linking flow.
		if strings.HasPrefix(text, "/start ") {
			payload := strings.TrimPrefix(text, "/start ")
			payload = strings.TrimSpace(payload)

			res, err := db.ExecContext(r.Context(),
				`UPDATE life_channel_links
				 SET channel_uid = $1, verified = TRUE, verify_code = NULL, verify_expires = NULL
				 WHERE verify_code = $2
				   AND channel = 'telegram'
				   AND verified = FALSE
				   AND verify_expires > NOW()`,
				strconv.FormatInt(chatID, 10), payload,
			)
			if err != nil {
				log.Printf("telegram webhook: link account for chat %d: %v", chatID, err)
			} else if n, _ := res.RowsAffected(); n > 0 {
				_ = life.SendTelegramMessage(r.Context(), cfg.TelegramBotToken, chatID,
					"✓ Account linked! You can now chat with your life assistant here.")
				w.WriteHeader(http.StatusOK)
				return
			}
			// No matching code — still return 200.
			w.WriteHeader(http.StatusOK)
			return
		}

		// 5. Look up the verified user for this chat ID.
		var userID string
		err := db.QueryRowContext(r.Context(),
			`SELECT user_id FROM life_channel_links
			 WHERE channel = 'telegram' AND channel_uid = $1 AND verified = TRUE`,
			strconv.FormatInt(chatID, 10),
		).Scan(&userID)
		if err == sql.ErrNoRows {
			_ = life.SendTelegramMessage(r.Context(), cfg.TelegramBotToken, chatID,
				"Please link your account first at https://1tt.dev/tools/life")
			w.WriteHeader(http.StatusOK)
			return
		}
		if err != nil {
			log.Printf("telegram webhook: look up user for chat %d: %v", chatID, err)
			w.WriteHeader(http.StatusOK)
			return
		}

		// 6. Build metadata.
		metadata := map[string]string{
			"message_id": strconv.Itoa(msg.MessageID),
		}
		if msg.From != nil {
			metadata["from_first_name"] = msg.From.FirstName
			if msg.From.Username != "" {
				metadata["from_username"] = msg.From.Username
			}
		}

		// 7. Ingest through the agent.
		result, err := life.IngestChannelEvent(r.Context(), db, agent, life.ChannelEvent{
			UserID:     userID,
			Channel:    "telegram",
			ChannelUID: strconv.FormatInt(chatID, 10),
			Content:    text,
			Metadata:   metadata,
		})
		if err != nil {
			log.Printf("telegram webhook: ingest for user %s: %v", userID, err)
			_ = life.SendTelegramMessage(r.Context(), cfg.TelegramBotToken, chatID,
				"Sorry, I encountered an error processing your message. Please try again.")
			w.WriteHeader(http.StatusOK)
			return
		}

		// 8. Reply with the agent response.
		if err := life.SendTelegramMessage(r.Context(), cfg.TelegramBotToken, chatID, result.Text); err != nil {
			log.Printf("telegram webhook: send reply to chat %d: %v", chatID, err)
		}

		w.WriteHeader(http.StatusOK)
	}
}

// EmailWebhook handles POST /life/webhooks/email.
// Body: {"from": "...", "subject": "...", "body": "..."}
// Protected by a shared secret in the Authorization header.
func EmailWebhook(cfg *config.Config, db *sql.DB, agent *life.Agent) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// 1. Validate shared secret.
		expectedAuth := "Bearer " + cfg.EmailWebhookSecret
		if cfg.EmailWebhookSecret == "" || r.Header.Get("Authorization") != expectedAuth {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}

		// 2. Parse the email payload.
		var req struct {
			From    string `json:"from"`
			Subject string `json:"subject"`
			Body    string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.From = strings.TrimSpace(req.From)
		if req.From == "" {
			http.Error(w, `{"error":"from is required"}`, http.StatusBadRequest)
			return
		}

		// 3. Look up the verified user for this email address.
		var userID string
		err := db.QueryRowContext(r.Context(),
			`SELECT user_id FROM life_channel_links
			 WHERE channel = 'email' AND channel_uid = $1 AND verified = TRUE`,
			req.From,
		).Scan(&userID)
		if err == sql.ErrNoRows {
			json.NewEncoder(w).Encode(map[string]any{"ignored": true})
			return
		}
		if err != nil {
			log.Printf("email webhook: look up user for %s: %v", req.From, err)
			http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
			return
		}

		// 4. Build content and metadata.
		content := req.Body
		if req.Subject != "" {
			content = req.Subject + "\n\n" + req.Body
		}
		metadata := map[string]string{}
		if req.Subject != "" {
			metadata["subject"] = req.Subject
		}

		// 5. Ingest through the agent.
		resp, err := life.IngestChannelEvent(r.Context(), db, agent, life.ChannelEvent{
			UserID:     userID,
			Channel:    "email",
			ChannelUID: req.From,
			Content:    content,
			Metadata:   metadata,
		})
		if err != nil {
			log.Printf("email webhook: ingest for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to process email"}`, http.StatusInternalServerError)
			return
		}

		// 6. Return the reply text so the Cloudflare Worker can send the email.
		json.NewEncoder(w).Encode(map[string]any{
			"processed": true,
			"reply":     resp.Text,
			"subject":   req.Subject,
		})
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const alphanumChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

// randomAlphanumeric generates a cryptographically random alphanumeric string
// of the given length.
func randomAlphanumeric(n int) (string, error) {
	result := make([]byte, n)
	for i := range result {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphanumChars))))
		if err != nil {
			return "", fmt.Errorf("randomAlphanumeric: %w", err)
		}
		result[i] = alphanumChars[idx.Int64()]
	}
	return string(result), nil
}

// randomDigits generates a cryptographically random numeric string of the given
// length, zero-padded if necessary.
func randomDigits(n int) (string, error) {
	max := big.NewInt(1)
	for i := 0; i < n; i++ {
		max.Mul(max, big.NewInt(10))
	}
	num, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", fmt.Errorf("randomDigits: %w", err)
	}
	return fmt.Sprintf("%0*s", n, num.String()), nil
}
