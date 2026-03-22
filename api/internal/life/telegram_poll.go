package life

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// PollTelegramUpdates runs a long-polling loop that fetches updates from the
// Telegram Bot API and processes them through the provided handler function.
// This is for local development only — production uses webhooks.
func PollTelegramUpdates(ctx context.Context, botToken string, handler func(update TelegramUpdate)) error {
	offset := 0
	client := &http.Client{Timeout: 35 * time.Second}

	log.Printf("telegram: starting polling loop for bot updates...")

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		url := fmt.Sprintf("https://api.telegram.org/bot%s/getUpdates?offset=%d&timeout=30", botToken, offset)
		resp, err := client.Get(url)
		if err != nil {
			log.Printf("telegram: poll error: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			log.Printf("telegram: read error: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		var result struct {
			OK     bool             `json:"ok"`
			Result []TelegramUpdate `json:"result"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			log.Printf("telegram: parse error: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		for _, update := range result.Result {
			if update.UpdateID >= offset {
				offset = update.UpdateID + 1
			}
			handler(update)
		}
	}
}
