package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExtractToken(t *testing.T) {
	cases := []struct {
		name    string
		headers map[string]string
		want    string
	}{
		{"no headers", nil, ""},
		{"X-Session-Token header", map[string]string{"X-Session-Token": "sess_abc"}, "sess_abc"},
		{"Authorization Bearer", map[string]string{"Authorization": "Bearer tok_xyz"}, "tok_xyz"},
		{"Authorization bearer lowercase", map[string]string{"Authorization": "bearer tok_xyz"}, "tok_xyz"},
		{"Authorization with padding", map[string]string{"Authorization": "Bearer   tok_pad  "}, "tok_pad"},
		{"Authorization without scheme", map[string]string{"Authorization": "tok_only"}, ""},
		{"Authorization non-bearer scheme", map[string]string{"Authorization": "Basic dXNlcjpwYXNz"}, ""},
		{"X-Session-Token wins over Authorization", map[string]string{
			"X-Session-Token": "from_header",
			"Authorization":   "Bearer from_bearer",
		}, "from_header"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			for k, v := range c.headers {
				r.Header.Set(k, v)
			}
			if got := extractToken(r); got != c.want {
				t.Errorf("extractToken() = %q, want %q", got, c.want)
			}
		})
	}
}
