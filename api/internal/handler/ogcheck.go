package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/html"

	"github.com/n1rna/1tt/api/internal/config"
)

// ogCacheTTL is how long a parsed result is considered fresh.
const ogCacheTTL = 5 * time.Minute

// ogFetchTimeout is the deadline for fetching the remote URL.
const ogFetchTimeout = 10 * time.Second

// ogMaxRedirects is the maximum number of redirects the HTTP client will follow.
const ogMaxRedirects = 5

// ogUserAgent is sent with every outbound request so servers don't reject us.
const ogUserAgent = "Mozilla/5.0 (compatible; 1tt-og-checker/1.0; +https://1tt.dev)"

// ogMaxBodyBytes caps how much HTML we read to avoid large downloads.
const ogMaxBodyBytes = 2 * 1024 * 1024 // 2 MiB

// ----- request / response types -----

type ogCheckRequest struct {
	URL            string `json:"url"`
	TurnstileToken string `json:"turnstileToken"`
}

// ogImage represents a single og:image entry together with its optional
// width/height/type/alt siblings.
type ogImage struct {
	URL    string `json:"url"`
	Width  string `json:"width,omitempty"`
	Height string `json:"height,omitempty"`
	Type   string `json:"type,omitempty"`
	Alt    string `json:"alt,omitempty"`
}

// ogTwitter groups all twitter: meta tags into one object.
type ogTwitter struct {
	Card        string `json:"card,omitempty"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	Image       string `json:"image,omitempty"`
	Site        string `json:"site,omitempty"`
	Creator     string `json:"creator,omitempty"`
}

// ogCheckResponse is returned on a successful check.
type ogCheckResponse struct {
	URL         string    `json:"url"`
	Title       string    `json:"title,omitempty"`
	Description string    `json:"description,omitempty"`
	Images      []ogImage `json:"images"`
	Twitter     ogTwitter `json:"twitter"`
	Favicon     string    `json:"favicon,omitempty"`
	ThemeColor  string    `json:"themeColor,omitempty"`
	CheckedAt   time.Time `json:"checkedAt"`
	Cached      bool      `json:"cached"`
}

// ----- in-memory cache -----

type ogCacheEntry struct {
	result    ogCheckResponse
	expiresAt time.Time
}

// ogCache stores parsed results keyed by the original URL string.
var ogCache sync.Map

// ogCacheGet returns the cached result and true if a valid (non-expired) entry
// exists for the given URL.
func ogCacheGet(url string) (ogCheckResponse, bool) {
	v, ok := ogCache.Load(url)
	if !ok {
		return ogCheckResponse{}, false
	}
	entry := v.(ogCacheEntry)
	if time.Now().After(entry.expiresAt) {
		ogCache.Delete(url)
		return ogCheckResponse{}, false
	}
	return entry.result, true
}

// ogCacheSet stores a result in the cache with the configured TTL.
func ogCacheSet(url string, result ogCheckResponse) {
	ogCache.Store(url, ogCacheEntry{
		result:    result,
		expiresAt: time.Now().Add(ogCacheTTL),
	})
}

// ----- HTTP client -----

// newOGClient builds an http.Client that follows up to ogMaxRedirects
// redirects and times out after ogFetchTimeout.
func newOGClient() *http.Client {
	return &http.Client{
		Timeout: ogFetchTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= ogMaxRedirects {
				return fmt.Errorf("stopped after %d redirects", ogMaxRedirects)
			}
			return nil
		},
	}
}

// ----- HTML parsing -----

// parseOGMeta walks the token stream of the HTML document and collects all
// relevant meta/link/title tags.
func parseOGMeta(r io.Reader, pageURL string) ogCheckResponse {
	result := ogCheckResponse{
		URL:    pageURL,
		Images: []ogImage{},
	}

	// currentImage tracks the og:image entry we are currently building.  Each
	// new og:image property opens a new entry; subsequent og:image:* siblings
	// are attached to the last open entry.
	var currentImage *ogImage

	flushImage := func() {
		if currentImage != nil {
			result.Images = append(result.Images, *currentImage)
			currentImage = nil
		}
	}

	z := html.NewTokenizer(r)
	inTitle := false
	titleDone := false

	for {
		tt := z.Next()
		switch tt {
		case html.ErrorToken:
			// End of document or unrecoverable parse error - stop walking.
			flushImage()
			return result

		case html.StartTagToken, html.SelfClosingTagToken:
			tok := z.Token()
			tag := tok.Data

			switch tag {
			case "title":
				if !titleDone {
					inTitle = true
				}

			case "meta":
				name, property, content := "", "", ""
				for _, a := range tok.Attr {
					switch strings.ToLower(a.Key) {
					case "name":
						name = strings.ToLower(strings.TrimSpace(a.Val))
					case "property":
						property = strings.ToLower(strings.TrimSpace(a.Val))
					case "content":
						content = strings.TrimSpace(a.Val)
					}
				}

				switch property {
				case "og:title":
					if result.Title == "" {
						result.Title = content
					}
				case "og:description":
					if result.Description == "" {
						result.Description = content
					}
				case "og:image":
					// A new og:image property starts a fresh image entry.
					flushImage()
					currentImage = &ogImage{URL: content}
				case "og:image:width":
					if currentImage != nil {
						currentImage.Width = content
					}
				case "og:image:height":
					if currentImage != nil {
						currentImage.Height = content
					}
				case "og:image:type":
					if currentImage != nil {
						currentImage.Type = content
					}
				case "og:image:alt":
					if currentImage != nil {
						currentImage.Alt = content
					}
				}

				switch name {
				case "description":
					if result.Description == "" {
						result.Description = content
					}
				case "theme-color":
					if result.ThemeColor == "" {
						result.ThemeColor = content
					}
				case "twitter:card":
					if result.Twitter.Card == "" {
						result.Twitter.Card = content
					}
				case "twitter:title":
					if result.Twitter.Title == "" {
						result.Twitter.Title = content
					}
				case "twitter:description":
					if result.Twitter.Description == "" {
						result.Twitter.Description = content
					}
				case "twitter:image":
					if result.Twitter.Image == "" {
						result.Twitter.Image = content
					}
				case "twitter:site":
					if result.Twitter.Site == "" {
						result.Twitter.Site = content
					}
				case "twitter:creator":
					if result.Twitter.Creator == "" {
						result.Twitter.Creator = content
					}
				}

			case "link":
				rel, href := "", ""
				for _, a := range tok.Attr {
					switch strings.ToLower(a.Key) {
					case "rel":
						rel = strings.ToLower(strings.TrimSpace(a.Val))
					case "href":
						href = strings.TrimSpace(a.Val)
					}
				}
				if result.Favicon == "" && (rel == "icon" || rel == "shortcut icon") {
					result.Favicon = href
				}

			case "body":
				// Stop as soon as we enter the body - all relevant tags are in <head>.
				flushImage()
				return result
			}

		case html.EndTagToken:
			tok := z.Token()
			if tok.Data == "title" {
				inTitle = false
				titleDone = true
			}

		case html.TextToken:
			if inTitle && !titleDone {
				text := strings.TrimSpace(z.Token().Data)
				if text != "" {
					result.Title = text
				}
			}
		}
	}
}

// resolveURL converts a potentially relative favicon URL to an absolute one
// using the page's origin.
func resolveURL(base, target string) string {
	if target == "" {
		return ""
	}
	if strings.HasPrefix(target, "http://") || strings.HasPrefix(target, "https://") {
		return target
	}
	// Strip path from base to get the origin.
	origin := base
	if idx := strings.Index(base, "://"); idx != -1 {
		rest := base[idx+3:]
		if slash := strings.Index(rest, "/"); slash != -1 {
			origin = base[:idx+3+slash]
		}
	}
	if strings.HasPrefix(target, "/") {
		return origin + target
	}
	return origin + "/" + target
}

// ----- main fetch logic -----

// fetchOGData fetches the HTML at rawURL and parses its OG meta tags.
func fetchOGData(ctx context.Context, rawURL string) (ogCheckResponse, error) {
	client := newOGClient()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return ogCheckResponse{}, fmt.Errorf("building request: %w", err)
	}
	req.Header.Set("User-Agent", ogUserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.5")

	resp, err := client.Do(req)
	if err != nil {
		return ogCheckResponse{}, fmt.Errorf("fetching URL: %w", err)
	}
	defer resp.Body.Close()

	ct := resp.Header.Get("Content-Type")
	if !strings.Contains(ct, "text/html") && !strings.Contains(ct, "application/xhtml+xml") {
		return ogCheckResponse{}, fmt.Errorf("unexpected content-type %q; only HTML responses are supported", ct)
	}

	// Cap the body to avoid reading enormous pages.
	limited := io.LimitReader(resp.Body, ogMaxBodyBytes)
	result := parseOGMeta(limited, rawURL)

	// Make the favicon URL absolute.
	result.Favicon = resolveURL(rawURL, result.Favicon)

	// Fall back to /favicon.ico if no explicit favicon link was found.
	if result.Favicon == "" {
		result.Favicon = resolveURL(rawURL, "/favicon.ico")
	}

	result.CheckedAt = time.Now().UTC()
	result.Cached = false
	return result, nil
}

// ----- handler -----

// OgCheck returns an http.HandlerFunc that validates a Cloudflare Turnstile
// token, optionally serves a cached result, and otherwise fetches and parses
// the OG meta tags for the requested URL.
func OgCheck(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req ogCheckRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		req.URL = strings.TrimSpace(req.URL)
		if req.URL == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "url is required"})
			return
		}
		if !strings.HasPrefix(req.URL, "http://") && !strings.HasPrefix(req.URL, "https://") {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "url must start with http:// or https://"})
			return
		}

		if req.TurnstileToken == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "turnstileToken is required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()

		valid, err := verifyTurnstile(ctx, cfg.TurnstileSecretKey, req.TurnstileToken)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "turnstile verification failed"})
			return
		}
		if !valid {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "invalid or expired turnstile token"})
			return
		}

		// Authenticated users always get fresh results.
		authenticated := r.Header.Get("X-User-Id") != ""

		// Return cached result if available (anonymous users only).
		if !authenticated {
			if cached, ok := ogCacheGet(req.URL); ok {
				cached.Cached = true
				writeJSON(w, http.StatusOK, cached)
				return
			}
		}

		// Fetch context shares the remaining budget from the outer context.
		result, err := fetchOGData(ctx, req.URL)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}

		ogCacheSet(req.URL, result)
		writeJSON(w, http.StatusOK, result)
	}
}
