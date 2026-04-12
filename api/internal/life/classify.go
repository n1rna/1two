package life

import (
	"context"
	"log"
	"strings"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/tmc/langchaingo/llms"
)

// ClassifyMessage performs a fast LLM call to classify a user message as either
// "life" (scheduling, routines, tasks, calendar, habits, daily planning) or
// "health" (diet, nutrition, weight, exercise, workouts, meal plans, fitness).
//
// Returns "life" or "health". Defaults to "life" on any error or ambiguous result.
func ClassifyMessage(ctx context.Context, llmCfg *ai.LLMConfig, message string) string {
	model, err := ai.NewLLM(llmCfg)
	if err != nil {
		log.Printf("life classify: create LLM: %v", err)
		return "life"
	}

	prompt := []llms.MessageContent{
		{
			Role: llms.ChatMessageTypeSystem,
			Parts: []llms.ContentPart{llms.TextPart(
				"Classify this message as 'life' (scheduling, routines, tasks, calendar, habits, daily planning) or 'health' (diet, nutrition, weight, exercise, workouts, meal plans, fitness, gym). Respond with exactly one word.",
			)},
		},
		{
			Role:  llms.ChatMessageTypeHuman,
			Parts: []llms.ContentPart{llms.TextPart(message)},
		},
	}

	resp, err := model.GenerateContent(ctx, prompt,
		llms.WithMaxTokens(5),
		llms.WithTemperature(0),
	)
	if err != nil {
		log.Printf("life classify: LLM call failed: %v", err)
		return "life"
	}
	if len(resp.Choices) == 0 {
		return "life"
	}

	result := strings.TrimSpace(strings.ToLower(resp.Choices[0].Content))
	if result == "health" {
		return "health"
	}
	return "life"
}
