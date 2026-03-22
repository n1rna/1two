package life

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// TelegramUpdate is the top-level object sent by the Telegram Bot API webhook.
type TelegramUpdate struct {
	UpdateID int              `json:"update_id"`
	Message  *TelegramMessage `json:"message"`
}

// TelegramMessage represents an incoming Telegram message.
type TelegramMessage struct {
	MessageID   int           `json:"message_id"`
	From        *TelegramUser `json:"from"`
	Chat        TelegramChat  `json:"chat"`
	Text        string        `json:"text"`
	Date        int           `json:"date"`
	ForwardFrom *TelegramUser `json:"forward_from"`
	ForwardDate int           `json:"forward_date"`
}

// TelegramUser represents a Telegram user or bot.
type TelegramUser struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
}

// TelegramChat represents a Telegram chat.
type TelegramChat struct {
	ID   int64  `json:"id"`
	Type string `json:"type"`
}

// SendTelegramMessage sends a text message to a Telegram chat via the Bot API.
// It uses Markdown parse mode. A non-2xx response is treated as an error.
func SendTelegramMessage(ctx context.Context, botToken string, chatID int64, text string) error {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)

	body, err := json.Marshal(map[string]any{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
	})
	if err != nil {
		return fmt.Errorf("telegram: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("telegram: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("telegram: send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("telegram: unexpected status %d", resp.StatusCode)
	}
	return nil
}

// ValidateTelegramWebhook returns true when the X-Telegram-Bot-Api-Secret-Token
// header matches the configured secret. An empty secret disables the check.
func ValidateTelegramWebhook(r *http.Request, secret string) bool {
	if secret == "" {
		return true
	}
	return r.Header.Get("X-Telegram-Bot-Api-Secret-Token") == secret
}
