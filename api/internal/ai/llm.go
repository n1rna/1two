package ai

import (
	"fmt"

	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/anthropic"
	"github.com/tmc/langchaingo/llms/openai"
)

// LLMConfig holds the configuration for the LLM provider.
type LLMConfig struct {
	Provider string // "openai" or "anthropic"
	APIKey   string
	BaseURL  string // base URL for OpenAI-compatible providers (e.g. Kimi K2)
	Model    string // primary model ID (used by chat agents)

	// SummaryModel is an optional non-thinking model used for one-shot
	// structured generation tasks like day summaries. Thinking models like
	// kimi-k2.5 over-think these and can take 3–6 minutes per call. If empty,
	// falls back to Model.
	SummaryModel string
}

// NewLLM constructs a langchaingo llms.Model from the given config.
// For "anthropic" provider it uses the Anthropic client; everything else is
// treated as an OpenAI-compatible endpoint (including Kimi K2 via BaseURL).
func NewLLM(cfg *LLMConfig) (llms.Model, error) {
	if cfg == nil {
		return nil, fmt.Errorf("ai: LLMConfig must not be nil")
	}

	switch cfg.Provider {
	case "anthropic":
		opts := []anthropic.Option{
			anthropic.WithToken(cfg.APIKey),
		}
		if cfg.Model != "" {
			opts = append(opts, anthropic.WithModel(cfg.Model))
		}
		if cfg.BaseURL != "" {
			opts = append(opts, anthropic.WithBaseURL(cfg.BaseURL))
		}
		return anthropic.New(opts...)

	default: // "openai" or any OpenAI-compatible provider
		opts := []openai.Option{
			openai.WithToken(cfg.APIKey),
		}
		if cfg.Model != "" {
			opts = append(opts, openai.WithModel(cfg.Model))
		}
		if cfg.BaseURL != "" {
			opts = append(opts, openai.WithBaseURL(cfg.BaseURL))
		}
		return openai.New(opts...)
	}
}
