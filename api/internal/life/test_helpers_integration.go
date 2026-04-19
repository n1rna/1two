//go:build integration

package life

import (
	"os"
	"testing"

	"github.com/n1rna/1tt/api/internal/ai"
)

// loadTestLLMConfig returns an LLMConfig for integration tests. Mirrors the
// kim-package helper so this package's integration tests can compile
// independently. Skips the test if RUN_LIFE_INTEGRATION != "1" or if
// LLM_API_KEY is unset.
func loadTestLLMConfig(t *testing.T) *ai.LLMConfig {
	t.Helper()
	if os.Getenv("RUN_LIFE_INTEGRATION") != "1" {
		t.Skip("set RUN_LIFE_INTEGRATION=1 to run life integration tests")
	}
	apiKey := os.Getenv("LLM_API_KEY")
	if apiKey == "" {
		t.Skip("LLM_API_KEY not set")
	}
	return &ai.LLMConfig{
		Provider:     getenvDefault("LLM_PROVIDER", "openai"),
		APIKey:       apiKey,
		BaseURL:      getenvDefault("LLM_BASE_URL", "https://api.moonshot.ai/v1"),
		Model:        getenvDefault("LLM_MODEL", "kimi-k2.5"),
		SummaryModel: getenvDefault("LLM_SUMMARY_MODEL", "kimi-k2-0905-preview"),
	}
}

func getenvDefault(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
