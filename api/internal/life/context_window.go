package life

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/tmc/langchaingo/llms"
)

// maxHistoryTokens is the approximate token budget for conversation history.
// We reserve space for: system prompt (~3K), user message (~500), tool defs (~4K),
// and response (~4K). With a ~32K context window, that leaves ~20K for history.
const maxHistoryTokens = 16000

// estimateTokens gives a rough token count for a string (~4 chars per token).
func estimateTokens(s string) int {
	return len(s) / 4
}

// estimateHistoryTokens returns the approximate total tokens in a message slice.
func estimateHistoryTokens(messages []Message) int {
	total := 0
	for _, m := range messages {
		total += estimateTokens(m.Content) + 4 // 4 tokens for role/separators
	}
	return total
}

// CompactHistory manages the context window by summarizing old messages when
// the history exceeds the token budget. Recent messages are kept verbatim;
// older messages are compressed into a summary.
//
// Strategy (similar to Claude Code / Copilot):
//  1. If total history fits in budget → return as-is
//  2. Otherwise, split: keep the last N messages verbatim (the "recent window")
//  3. Summarize everything before that into a single "[Conversation summary]" message
//  4. Return: [summary message] + recent messages
func CompactHistory(ctx context.Context, llmCfg *ai.LLMConfig, messages []Message) []Message {
	totalTokens := estimateHistoryTokens(messages)

	// Fits in budget — no compaction needed.
	if totalTokens <= maxHistoryTokens {
		return messages
	}

	// Find the split point: keep recent messages that fit in ~60% of budget.
	recentBudget := maxHistoryTokens * 60 / 100
	recentTokens := 0
	splitIdx := len(messages)
	for i := len(messages) - 1; i >= 0; i-- {
		msgTokens := estimateTokens(messages[i].Content) + 4
		if recentTokens+msgTokens > recentBudget {
			splitIdx = i + 1
			break
		}
		recentTokens += msgTokens
	}

	// If split would keep everything or nothing, just truncate from the start.
	if splitIdx <= 1 || splitIdx >= len(messages) {
		// Keep last messages that fit in budget
		kept := []Message{}
		tokens := 0
		for i := len(messages) - 1; i >= 0; i-- {
			t := estimateTokens(messages[i].Content) + 4
			if tokens+t > maxHistoryTokens {
				break
			}
			kept = append([]Message{{Role: messages[i].Role, Content: messages[i].Content}}, kept...)
			tokens += t
		}
		return kept
	}

	oldMessages := messages[:splitIdx]
	recentMessages := messages[splitIdx:]

	// Summarize the old messages using the LLM.
	summary := summarizeMessages(ctx, llmCfg, oldMessages)
	if summary == "" {
		// Summarization failed — just return recent messages.
		return recentMessages
	}

	result := make([]Message, 0, 1+len(recentMessages))
	result = append(result, Message{
		Role:    "assistant",
		Content: fmt.Sprintf("[Conversation summary of %d earlier messages]\n%s", len(oldMessages), summary),
	})
	result = append(result, recentMessages...)

	log.Printf("context compaction: %d messages (%d tokens) → summary + %d recent (%d tokens)",
		len(messages), totalTokens, len(recentMessages), estimateTokens(summary)+recentTokens)

	return result
}

// summarizeMessages calls the LLM to produce a concise summary of old messages.
func summarizeMessages(ctx context.Context, llmCfg *ai.LLMConfig, messages []Message) string {
	model, err := ai.NewLLM(llmCfg)
	if err != nil {
		log.Printf("context compaction: create LLM for summary: %v", err)
		return ""
	}

	var transcript strings.Builder
	for _, m := range messages {
		role := "User"
		if m.Role == "assistant" {
			role = "Assistant"
		}
		content := m.Content
		if len(content) > 500 {
			content = content[:500] + "..."
		}
		transcript.WriteString(fmt.Sprintf("%s: %s\n\n", role, content))
	}

	llmMessages := []llms.MessageContent{
		{
			Role: llms.ChatMessageTypeSystem,
			Parts: []llms.ContentPart{llms.TextPart(`Summarize this conversation between a user and their AI life planning assistant.
Focus on:
- Key decisions made and actions taken (routines created, events scheduled, tasks completed)
- User preferences and instructions expressed
- Current state of plans and pending items
- Any unresolved questions or topics

Be concise but preserve all actionable context. Use bullet points. Max 500 words.`)},
		},
		{
			Role:  llms.ChatMessageTypeHuman,
			Parts: []llms.ContentPart{llms.TextPart(transcript.String())},
		},
	}

	resp, err := model.GenerateContent(ctx, llmMessages,
		llms.WithTemperature(1.0),
		llms.WithMaxTokens(8192),
	)
	if err != nil {
		log.Printf("context compaction: summarize LLM call failed: %v", err)
		return ""
	}
	if len(resp.Choices) == 0 {
		return ""
	}

	return strings.TrimSpace(resp.Choices[0].Content)
}
