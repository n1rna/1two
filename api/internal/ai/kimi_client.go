package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/tmc/langchaingo/llms"
)

// KimiMessage represents a chat message for the Kimi API with reasoning_content.
type KimiMessage struct {
	Role             string         `json:"role"`
	Content          string         `json:"content"`
	ReasoningContent string         `json:"reasoning_content,omitempty"`
	ToolCalls        []kimiToolCall `json:"tool_calls,omitempty"`
	ToolCallID       string         `json:"tool_call_id,omitempty"`
}

type kimiToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type kimiTool struct {
	Type     string   `json:"type"`
	Function kimiFunc `json:"function"`
}

type kimiFunc struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Parameters  any    `json:"parameters"`
}

type kimiChoice struct {
	Message struct {
		Role             string         `json:"role"`
		Content          string         `json:"content"`
		ReasoningContent string         `json:"reasoning_content"`
		ToolCalls        []kimiToolCall `json:"tool_calls"`
	} `json:"message"`
	FinishReason string `json:"finish_reason"`
}

type kimiResponse struct {
	Choices []kimiChoice `json:"choices"`
}

// KimiChatCompletion makes a direct chat completion call handling reasoning_content.
func KimiChatCompletion(ctx context.Context, cfg *LLMConfig, messages []KimiMessage, tools []kimiTool, temperature float64, maxTokens int) (*kimiResponse, error) {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://api.moonshot.ai/v1"
	}

	body := map[string]any{
		"model":       cfg.Model,
		"messages":    messages,
		"temperature": temperature,
		"max_tokens":  maxTokens,
	}
	if len(tools) > 0 {
		body["tools"] = tools
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("kimi: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("kimi: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	// No client-level timeout: cancellation is driven by the caller's context
	// (req is built with NewRequestWithContext above). Day summary generation
	// against thinking models can legitimately take 2–3 minutes.
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("kimi: request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("kimi: API %d: %s", resp.StatusCode, raw)
	}

	var result kimiResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("kimi: parse: %w", err)
	}
	return &result, nil
}

// llmsToolsToKimi converts langchaingo llms.Tool to kimi format.
func llmsToolsToKimi(tools []llms.Tool) []kimiTool {
	result := make([]kimiTool, len(tools))
	for i, t := range tools {
		result[i] = kimiTool{
			Type: t.Type,
			Function: kimiFunc{
				Name:        t.Function.Name,
				Description: t.Function.Description,
				Parameters:  t.Function.Parameters,
			},
		}
	}
	return result
}

// llmsMessagesToKimi converts the initial langchaingo messages to kimi format.
func llmsMessagesToKimi(messages []llms.MessageContent) []KimiMessage {
	result := make([]KimiMessage, 0, len(messages))
	for _, mc := range messages {
		msg := KimiMessage{}
		switch mc.Role {
		case llms.ChatMessageTypeSystem:
			msg.Role = "system"
		case llms.ChatMessageTypeAI:
			msg.Role = "assistant"
		case llms.ChatMessageTypeHuman:
			msg.Role = "user"
		case llms.ChatMessageTypeTool:
			msg.Role = "tool"
		default:
			msg.Role = "user"
		}

		// Extract text content and tool parts
		for _, p := range mc.Parts {
			switch v := p.(type) {
			case llms.TextContent:
				msg.Content = v.Text
			case llms.ToolCallResponse:
				msg.ToolCallID = v.ToolCallID
				msg.Content = v.Content
			case llms.ToolCall:
				msg.ToolCalls = append(msg.ToolCalls, kimiToolCall{
					ID:   v.ID,
					Type: v.Type,
					Function: struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					}{
						Name:      v.FunctionCall.Name,
						Arguments: v.FunctionCall.Arguments,
					},
				})
			}
		}
		result = append(result, msg)
	}
	return result
}

// IsThinkingModel returns true if the model requires reasoning_content handling.
func IsThinkingModel(model string) bool {
	return strings.Contains(model, "k2.5") ||
		strings.Contains(model, "k2-thinking") ||
		strings.Contains(model, "deepseek-reasoner")
}
