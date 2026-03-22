package life

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// EmailSender sends emails via the Cloudflare Email Worker's HTTP endpoint.
type EmailSender struct {
	workerURL string // e.g., "https://1tt-email-inbound.1twodev.workers.dev"
	secret    string // EMAIL_WEBHOOK_SECRET for authentication
	client    *http.Client
}

// NewEmailSender creates an email sender that calls the Cloudflare Email Worker.
func NewEmailSender(workerURL, secret string) *EmailSender {
	return &EmailSender{
		workerURL: workerURL,
		secret:    secret,
		client:    &http.Client{},
	}
}

// Send sends an email via the worker.
func (s *EmailSender) Send(ctx context.Context, to, subject, text string) error {
	payload, err := json.Marshal(map[string]string{
		"to":      to,
		"subject": subject,
		"text":    text,
	})
	if err != nil {
		return fmt.Errorf("email: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.workerURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("email: create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.secret)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("email: send: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("email: HTTP %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// SendVerificationEmail sends a verification code email.
func (s *EmailSender) SendVerificationEmail(ctx context.Context, to, code string) error {
	return s.Send(ctx, to,
		"Verify your email — 1tt.dev Life Tool",
		fmt.Sprintf("Hi,\n\nYour verification code is: %s\n\nEnter this code in the Life Tool to link your email.\nThis code expires in 15 minutes.\n\n— 1tt.dev", code),
	)
}
