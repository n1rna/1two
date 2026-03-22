package life

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// EmailSender sends emails. It first tries Resend (for transactional emails to
// arbitrary recipients), and can fall back to the Cloudflare Email Worker.
type EmailSender struct {
	resendKey  string // Resend API key
	fromEmail  string // From address for Resend
	workerURL  string // Cloudflare Email Worker URL (fallback)
	secret     string // EMAIL_WEBHOOK_SECRET for worker auth
	httpClient *http.Client
}

// NewEmailSender creates an email sender.
func NewEmailSender(resendKey, fromEmail, workerURL, secret string) *EmailSender {
	return &EmailSender{
		resendKey:  resendKey,
		fromEmail:  fromEmail,
		workerURL:  workerURL,
		secret:     secret,
		httpClient: &http.Client{},
	}
}

// Send sends an email via Resend.
func (s *EmailSender) Send(ctx context.Context, to, subject, text string) error {
	if s.resendKey == "" {
		return fmt.Errorf("email: Resend not configured")
	}

	payload, err := json.Marshal(map[string]any{
		"from":    s.fromEmail,
		"to":      []string{to},
		"subject": subject,
		"text":    text,
	})
	if err != nil {
		return fmt.Errorf("email: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("email: create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.resendKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("email: send: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("email: Resend HTTP %d: %s", resp.StatusCode, string(body))
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
