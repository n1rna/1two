package life

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// ResendClient sends emails via the Resend API.
type ResendClient struct {
	apiKey     string
	fromEmail  string
	httpClient *http.Client
}

// NewResendClient creates a Resend email client.
// fromEmail is the sender address (e.g., "life@1tt.dev").
func NewResendClient(apiKey, fromEmail string) *ResendClient {
	return &ResendClient{
		apiKey:     apiKey,
		fromEmail:  fromEmail,
		httpClient: &http.Client{},
	}
}

// SendEmail sends an email via Resend.
func (c *ResendClient) SendEmail(ctx context.Context, to, subject, textBody string) error {
	payload := map[string]any{
		"from":    c.fromEmail,
		"to":      []string{to},
		"subject": subject,
		"text":    textBody,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("resend: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("resend: create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("resend: send: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend: HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// SendVerificationEmail sends a verification code email.
func (c *ResendClient) SendVerificationEmail(ctx context.Context, to, code string) error {
	subject := "Verify your email — 1tt.dev Life Tool"
	body := fmt.Sprintf(`Hi,

Your verification code is: %s

Enter this code in the Life Tool to link your email.
This code expires in 15 minutes.

— 1tt.dev`, code)

	return c.SendEmail(ctx, to, subject, body)
}

// SendAgentReply sends an agent response as an email reply.
func (c *ResendClient) SendAgentReply(ctx context.Context, to, originalSubject, agentText string) error {
	subject := "Re: " + originalSubject
	if originalSubject == "" {
		subject = "Life Tool — Response"
	}
	return c.SendEmail(ctx, to, subject, agentText)
}
