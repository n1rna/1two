package life

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	gcalAuthURL  = "https://accounts.google.com/o/oauth2/v2/auth"
	gcalTokenURL = "https://oauth2.googleapis.com/token"
	gcalScopes   = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/tasks"
)

// GCalClient makes HTTP calls to Google's OAuth2 and Calendar v3 APIs.
type GCalClient struct {
	clientID     string
	clientSecret string
	redirectURI  string
	httpClient   *http.Client
}

// NewGCalClient constructs a GCalClient from OAuth2 credentials.
func NewGCalClient(clientID, clientSecret, redirectURI string) *GCalClient {
	return &GCalClient{
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURI:  redirectURI,
		httpClient:   &http.Client{Timeout: 15 * time.Second},
	}
}

// GetAuthURL returns the Google OAuth2 authorization URL to redirect the user to.
func (c *GCalClient) GetAuthURL(state string) string {
	params := url.Values{}
	params.Set("client_id", c.clientID)
	params.Set("redirect_uri", c.redirectURI)
	params.Set("response_type", "code")
	params.Set("scope", gcalScopes)
	params.Set("access_type", "offline")
	params.Set("prompt", "consent") // always get refresh_token
	if state != "" {
		params.Set("state", state)
	}
	return gcalAuthURL + "?" + params.Encode()
}

// GCalTokens holds the tokens returned after exchanging an authorization code.
type GCalTokens struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
	Email        string // from userinfo endpoint
}

// ExchangeCode exchanges a Google OAuth2 authorization code for tokens.
func (c *GCalClient) ExchangeCode(ctx context.Context, code string) (*GCalTokens, error) {
	body := url.Values{}
	body.Set("code", code)
	body.Set("client_id", c.clientID)
	body.Set("client_secret", c.clientSecret)
	body.Set("redirect_uri", c.redirectURI)
	body.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, gcalTokenURL,
		strings.NewReader(body.Encode()))
	if err != nil {
		return nil, fmt.Errorf("gcal: build token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gcal: token exchange request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gcal: token exchange failed (%d): %s", resp.StatusCode, raw)
	}

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		TokenType    string `json:"token_type"`
	}
	if err := json.Unmarshal(raw, &tokenResp); err != nil {
		return nil, fmt.Errorf("gcal: parse token response: %w", err)
	}
	if tokenResp.AccessToken == "" {
		return nil, fmt.Errorf("gcal: empty access_token in response")
	}

	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)

	// Fetch the user's email from the userinfo endpoint.
	email, err := c.fetchUserEmail(ctx, tokenResp.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("gcal: fetch user email: %w", err)
	}

	return &GCalTokens{
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		ExpiresAt:    expiresAt,
		Email:        email,
	}, nil
}

// fetchUserEmail calls the Google userinfo endpoint and returns the email address.
func (c *GCalClient) fetchUserEmail(ctx context.Context, accessToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("userinfo failed (%d): %s", resp.StatusCode, raw)
	}

	var info struct {
		Email string `json:"email"`
	}
	if err := json.Unmarshal(raw, &info); err != nil {
		return "", err
	}
	return info.Email, nil
}

// RefreshAccessToken uses the stored refresh token to obtain a new access token.
func (c *GCalClient) RefreshAccessToken(ctx context.Context, refreshToken string) (accessToken string, expiresAt time.Time, err error) {
	body := url.Values{}
	body.Set("refresh_token", refreshToken)
	body.Set("client_id", c.clientID)
	body.Set("client_secret", c.clientSecret)
	body.Set("grant_type", "refresh_token")

	req, reqErr := http.NewRequestWithContext(ctx, http.MethodPost, gcalTokenURL,
		strings.NewReader(body.Encode()))
	if reqErr != nil {
		return "", time.Time{}, fmt.Errorf("gcal: build refresh request: %w", reqErr)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, doErr := c.httpClient.Do(req)
	if doErr != nil {
		return "", time.Time{}, fmt.Errorf("gcal: refresh request: %w", doErr)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", time.Time{}, fmt.Errorf("gcal: token refresh failed (%d): %s", resp.StatusCode, raw)
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if parseErr := json.Unmarshal(raw, &tokenResp); parseErr != nil {
		return "", time.Time{}, fmt.Errorf("gcal: parse refresh response: %w", parseErr)
	}
	if tokenResp.AccessToken == "" {
		return "", time.Time{}, fmt.Errorf("gcal: empty access_token in refresh response")
	}

	expiresAt = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	return tokenResp.AccessToken, expiresAt, nil
}

// GCalEvent represents a single Google Calendar event.
type GCalEvent struct {
	ID          string    `json:"id"`
	Summary     string    `json:"summary"`
	Description string    `json:"description"`
	Location    string    `json:"location"`
	Start       time.Time `json:"start"`
	End         time.Time `json:"end"`
	AllDay      bool      `json:"allDay"`
	Status      string    `json:"status"`  // confirmed, tentative, cancelled
	ColorID     string    `json:"colorId"` // Google Calendar color ID (1-11)
	HtmlLink    string    `json:"htmlLink"`
}

// ListEvents fetches upcoming events from the user's primary calendar.
// daysAhead controls how far ahead to look (e.g. 7 = next 7 days).
// It delegates to fetchEvents (defined in gcal_sync.go) for the actual HTTP call.
func (c *GCalClient) ListEvents(ctx context.Context, accessToken string, daysAhead int) ([]GCalEvent, error) {
	now := time.Now().UTC()

	params := url.Values{}
	params.Set("timeMin", now.Format(time.RFC3339))
	params.Set("timeMax", now.AddDate(0, 0, daysAhead).Format(time.RFC3339))
	params.Set("singleEvents", "true")
	params.Set("orderBy", "startTime")
	params.Set("maxResults", "50")

	apiResp, err := c.fetchEvents(ctx, accessToken, params)
	if err != nil {
		return nil, fmt.Errorf("gcal: list-events: %w", err)
	}

	events := make([]GCalEvent, 0, len(apiResp.Items))
	for _, item := range apiResp.Items {
		start, end, allDay, err := parseItemTimes(item)
		if err != nil {
			continue
		}
		events = append(events, GCalEvent{
			ID:          item.ID,
			Summary:     item.Summary,
			Description: item.Description,
			Location:    item.Location,
			Status:      item.Status,
			ColorID:     item.ColorID,
			HtmlLink:    item.HtmlLink,
			Start:       start,
			End:         end,
			AllDay:      allDay,
		})
	}
	return events, nil
}

// CreateEventRequest holds the parameters for creating a new calendar event.
type CreateEventRequest struct {
	Summary     string
	Description string
	Location    string
	StartTime   time.Time
	EndTime     time.Time
	AllDay      bool
}

// CreateEvent creates a new event on the user's primary Google Calendar.
func (c *GCalClient) CreateEvent(ctx context.Context, accessToken string, req CreateEventRequest) (*GCalEvent, error) {
	type dateTimeObj struct {
		DateTime string `json:"dateTime,omitempty"`
		Date     string `json:"date,omitempty"`
		TimeZone string `json:"timeZone,omitempty"`
	}

	var startObj, endObj dateTimeObj
	if req.AllDay {
		startObj.Date = req.StartTime.Format("2006-01-02")
		endObj.Date = req.EndTime.Format("2006-01-02")
	} else {
		startObj.DateTime = req.StartTime.UTC().Format(time.RFC3339)
		startObj.TimeZone = "UTC"
		endObj.DateTime = req.EndTime.UTC().Format(time.RFC3339)
		endObj.TimeZone = "UTC"
	}

	payload := map[string]any{
		"summary":     req.Summary,
		"description": req.Description,
		"location":    req.Location,
		"start":       startObj,
		"end":         endObj,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("gcal: marshal create-event request: %w", err)
	}

	apiURL := "https://www.googleapis.com/calendar/v3/calendars/primary/events"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL,
		bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("gcal: build create-event request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+accessToken)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("gcal: create-event request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("gcal: create-event failed (%d): %s", resp.StatusCode, raw)
	}

	var created struct {
		ID          string `json:"id"`
		Summary     string `json:"summary"`
		Description string `json:"description"`
		Location    string `json:"location"`
		Status      string `json:"status"`
		HtmlLink    string `json:"htmlLink"`
		Start       struct {
			DateTime string `json:"dateTime"`
			Date     string `json:"date"`
		} `json:"start"`
		End struct {
			DateTime string `json:"dateTime"`
			Date     string `json:"date"`
		} `json:"end"`
	}
	if err := json.Unmarshal(raw, &created); err != nil {
		return nil, fmt.Errorf("gcal: parse create-event response: %w", err)
	}

	ev := &GCalEvent{
		ID:          created.ID,
		Summary:     created.Summary,
		Description: created.Description,
		Location:    created.Location,
		Status:      created.Status,
		HtmlLink:    created.HtmlLink,
	}

	if created.Start.DateTime != "" {
		if t, err := time.Parse(time.RFC3339, created.Start.DateTime); err == nil {
			ev.Start = t
		}
		if created.End.DateTime != "" {
			if t, err := time.Parse(time.RFC3339, created.End.DateTime); err == nil {
				ev.End = t
			}
		}
	} else if created.Start.Date != "" {
		if t, err := time.Parse("2006-01-02", created.Start.Date); err == nil {
			ev.Start = t
			ev.AllDay = true
		}
		if created.End.Date != "" {
			if t, err := time.Parse("2006-01-02", created.End.Date); err == nil {
				ev.End = t
			}
		}
	}

	return ev, nil
}

// DeleteEvent removes an event from the user's primary Google Calendar.
func (c *GCalClient) DeleteEvent(ctx context.Context, accessToken, eventID string) error {
	apiURL := fmt.Sprintf("https://www.googleapis.com/calendar/v3/calendars/primary/events/%s", url.PathEscape(eventID))
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodDelete, apiURL, nil)
	if err != nil {
		return fmt.Errorf("gcal: build delete-event request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("gcal: delete-event request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("gcal: delete-event failed (%d): %s", resp.StatusCode, raw)
	}
	return nil
}

// UpdateEvent modifies an existing event on the user's primary Google Calendar.
// Only non-empty fields in the request are updated (PATCH semantics).
func (c *GCalClient) UpdateEvent(ctx context.Context, accessToken, eventID string, req CreateEventRequest) (*GCalEvent, error) {
	type dateTimeObj struct {
		DateTime string `json:"dateTime,omitempty"`
		Date     string `json:"date,omitempty"`
		TimeZone string `json:"timeZone,omitempty"`
	}

	payload := map[string]any{}
	if req.Summary != "" {
		payload["summary"] = req.Summary
	}
	if req.Description != "" {
		payload["description"] = req.Description
	}
	if req.Location != "" {
		payload["location"] = req.Location
	}
	if !req.StartTime.IsZero() && !req.EndTime.IsZero() {
		if req.AllDay {
			payload["start"] = dateTimeObj{Date: req.StartTime.Format("2006-01-02")}
			payload["end"] = dateTimeObj{Date: req.EndTime.Format("2006-01-02")}
		} else {
			payload["start"] = dateTimeObj{DateTime: req.StartTime.UTC().Format(time.RFC3339), TimeZone: "UTC"}
			payload["end"] = dateTimeObj{DateTime: req.EndTime.UTC().Format(time.RFC3339), TimeZone: "UTC"}
		}
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("gcal: marshal update-event request: %w", err)
	}

	apiURL := fmt.Sprintf("https://www.googleapis.com/calendar/v3/calendars/primary/events/%s", url.PathEscape(eventID))
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPatch, apiURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("gcal: build update-event request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+accessToken)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("gcal: update-event request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gcal: update-event failed (%d): %s", resp.StatusCode, raw)
	}

	var updated struct {
		ID       string `json:"id"`
		Summary  string `json:"summary"`
		HtmlLink string `json:"htmlLink"`
		Start    struct {
			DateTime string `json:"dateTime"`
		} `json:"start"`
		End struct {
			DateTime string `json:"dateTime"`
		} `json:"end"`
	}
	if err := json.Unmarshal(raw, &updated); err != nil {
		return nil, fmt.Errorf("gcal: parse update-event response: %w", err)
	}

	ev := &GCalEvent{ID: updated.ID, Summary: updated.Summary, HtmlLink: updated.HtmlLink}
	if t, err := time.Parse(time.RFC3339, updated.Start.DateTime); err == nil {
		ev.Start = t
	}
	if t, err := time.Parse(time.RFC3339, updated.End.DateTime); err == nil {
		ev.End = t
	}
	return ev, nil
}

// EnsureValidToken loads the gcal connection for the user, refreshes the access
// token if it is expired or within 60 seconds of expiry, and returns a valid
// access token. The DB row is updated in place when a refresh occurs.
func EnsureValidToken(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string) (string, error) {
	var accessToken, refreshToken string
	var tokenExpiry time.Time

	err := db.QueryRowContext(ctx,
		`SELECT access_token, refresh_token, token_expiry
		 FROM life_gcal_connections WHERE user_id = $1`,
		userID,
	).Scan(&accessToken, &refreshToken, &tokenExpiry)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("gcal: no calendar connection for user %s", userID)
	}
	if err != nil {
		return "", fmt.Errorf("gcal: load connection: %w", err)
	}

	// Refresh if the token expires within the next 60 seconds.
	if time.Until(tokenExpiry) < 60*time.Second {
		newToken, newExpiry, err := gcalClient.RefreshAccessToken(ctx, refreshToken)
		if err != nil {
			return "", fmt.Errorf("gcal: refresh token: %w", err)
		}

		if _, err := db.ExecContext(ctx,
			`UPDATE life_gcal_connections
			 SET access_token = $1, token_expiry = $2, updated_at = NOW()
			 WHERE user_id = $3`,
			newToken, newExpiry, userID,
		); err != nil {
			return "", fmt.Errorf("gcal: save refreshed token: %w", err)
		}

		return newToken, nil
	}

	return accessToken, nil
}
