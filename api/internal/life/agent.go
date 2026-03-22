// Package life implements the AI-powered life planning agent and its supporting types.
package life

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/tmc/langchaingo/llms"
)

// Agent is the life planning AI agent. Phase 2 adds tool calling (ReAct loop)
// and a database reference so the agent can act on the user's data.
type Agent struct {
	llmCfg     ai.LLMConfig
	db         *sql.DB
	gcalClient *GCalClient // may be nil if Google Calendar is not configured
}

// NewAgent constructs an Agent from the given LLM configuration, database, and
// optional Google Calendar client.
func NewAgent(llmCfg ai.LLMConfig, db *sql.DB, gcalClient *GCalClient) *Agent {
	return &Agent{llmCfg: llmCfg, db: db, gcalClient: gcalClient}
}

// ChatRequest holds all inputs required for a single chat turn.
type ChatRequest struct {
	UserID                  string
	Message                 string
	History                 []Message // previous messages in the conversation, oldest first
	Memories                []Memory
	Profile                 *Profile
	Routines                []Routine
	PendingActionablesCount int
	CalendarEvents          []GCalEvent // upcoming calendar events (may be nil)
	SystemContext            string      // optional extra context appended to system prompt
}

// Message represents a single turn in the conversation history.
type Message struct {
	Role    string // "user" or "assistant"
	Content string
}

// Memory is a user fact or preference stored in life_memories.
type Memory struct {
	ID       string
	Category string
	Content  string
}

// Profile holds the user's life profile settings.
type Profile struct {
	Timezone  string
	WakeTime  string
	SleepTime string
}

// Routine is a summary of an active life_routines row used in the system prompt.
type Routine struct {
	ID          string
	Name        string
	Type        string
	Description string
}

// ActionableRecord holds the data for a resolved actionable, used when feeding
// the resolution back to the agent.
type ActionableRecord struct {
	ID          string
	Type        string
	Title       string
	Description string
}

// maxToolRounds is the maximum number of tool-call iterations before we force
// a final text response.
const maxToolRounds = 5

// ToolEffect represents a side effect from a tool call during chat.
type ToolEffect struct {
	Tool   string `json:"tool"`   // tool name: "create_actionable", "remember", "create_routine", etc.
	ID     string `json:"id"`     // ID of the created object (if applicable)
	Result string `json:"result"` // raw JSON result from the tool
}

// ChatResult holds the result of a single chat turn.
type ChatResult struct {
	Text    string       // the assistant's response text
	Effects []ToolEffect // all tool side effects from this turn
}

// Chat executes a single conversation turn with a ReAct tool-calling loop.
func (a *Agent) Chat(ctx context.Context, req ChatRequest) (*ChatResult, error) {
	model, err := ai.NewLLM(&a.llmCfg)
	if err != nil {
		return nil, fmt.Errorf("life agent: create LLM: %w", err)
	}

	systemPrompt := buildSystemPrompt(
		req.Profile,
		req.Memories,
		req.Routines,
		req.PendingActionablesCount,
		req.CalendarEvents,
		time.Now().UTC(),
	)
	if req.SystemContext != "" {
		systemPrompt += "\n\n## Additional context\n" + req.SystemContext
	}

	messages := []llms.MessageContent{
		{
			Role:  llms.ChatMessageTypeSystem,
			Parts: []llms.ContentPart{llms.TextPart(systemPrompt)},
		},
	}

	for _, h := range req.History {
		role := llms.ChatMessageTypeHuman
		if h.Role == "assistant" {
			role = llms.ChatMessageTypeAI
		}
		messages = append(messages, llms.MessageContent{
			Role:  role,
			Parts: []llms.ContentPart{llms.TextPart(h.Content)},
		})
	}

	messages = append(messages, llms.MessageContent{
		Role:  llms.ChatMessageTypeHuman,
		Parts: []llms.ContentPart{llms.TextPart(req.Message)},
	})

	tools := toolDefs()
	var effects []ToolEffect

	// ReAct loop: call LLM → execute tools → call LLM again, up to maxToolRounds.
	for round := 0; round < maxToolRounds; round++ {
		resp, err := model.GenerateContent(ctx, messages,
			llms.WithTemperature(0.7),
			llms.WithMaxTokens(4096),
			llms.WithTools(tools),
		)
		if err != nil {
			return nil, fmt.Errorf("life agent: generate content (round %d): %w", round, err)
		}

		if len(resp.Choices) == 0 {
			return nil, fmt.Errorf("life agent: no choices returned (round %d)", round)
		}

		choice := resp.Choices[0]

		// No tool calls → the model is done; return the text response.
		if len(choice.ToolCalls) == 0 {
			return &ChatResult{Text: choice.Content, Effects: effects}, nil
		}

		// Append the assistant turn that contains the tool call requests.
		assistantParts := []llms.ContentPart{}
		if choice.Content != "" {
			assistantParts = append(assistantParts, llms.TextPart(choice.Content))
		}
		for _, tc := range choice.ToolCalls {
			assistantParts = append(assistantParts, llms.ToolCall{
				ID:   tc.ID,
				Type: tc.Type,
				FunctionCall: &llms.FunctionCall{
					Name:      tc.FunctionCall.Name,
					Arguments: tc.FunctionCall.Arguments,
				},
			})
		}
		messages = append(messages, llms.MessageContent{
			Role:  llms.ChatMessageTypeAI,
			Parts: assistantParts,
		})

		// Execute each tool and collect results.
		for _, tc := range choice.ToolCalls {
			log.Printf("life agent: executing tool %q (id=%s)", tc.FunctionCall.Name, tc.ID)
			result := executeTool(ctx, a.db, a.gcalClient, req.UserID, tc)
			log.Printf("life agent: tool %q result: %s", tc.FunctionCall.Name, result)

			// Track all tool effects for the chat response.
			var parsed struct {
				ID           string `json:"id"`
				ActionableID string `json:"actionable_id"`
				MemoryID     string `json:"memory_id"`
				RoutineID    string `json:"routine_id"`
			}
			_ = json.Unmarshal([]byte(result), &parsed)
			effectID := parsed.ID
			if effectID == "" { effectID = parsed.ActionableID }
			if effectID == "" { effectID = parsed.MemoryID }
			if effectID == "" { effectID = parsed.RoutineID }
			effects = append(effects, ToolEffect{
				Tool:   tc.FunctionCall.Name,
				ID:     effectID,
				Result: result,
			})

			messages = append(messages, llms.MessageContent{
				Role: llms.ChatMessageTypeTool,
				Parts: []llms.ContentPart{
					llms.ToolCallResponse{
						ToolCallID: tc.ID,
						Name:       tc.FunctionCall.Name,
						Content:    result,
					},
				},
			})
		}
	}

	// If we exhausted tool rounds, do one final call without tools to get a
	// plain-text response.
	resp, err := model.GenerateContent(ctx, messages,
		llms.WithTemperature(0.7),
		llms.WithMaxTokens(4096),
	)
	if err != nil {
		return nil, fmt.Errorf("life agent: final generate content: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("life agent: no choices in final response")
	}
	return &ChatResult{Text: resp.Choices[0].Content, Effects: effects}, nil
}

// StreamEvent is a single event emitted during a streaming chat turn.
type StreamEvent struct {
	Type string `json:"type"` // "token", "tool_call", "tool_result", "done", "error"
	Data string `json:"data"` // token text, tool name, result JSON, or error message
}

// ChatStream executes a single conversation turn with streaming. The onEvent
// callback is called for each token, tool call, tool result, and final done
// event. The done event's Data field contains the full ChatResult as JSON.
func (a *Agent) ChatStream(ctx context.Context, req ChatRequest, onEvent func(StreamEvent)) (*ChatResult, error) {
	model, err := ai.NewLLM(&a.llmCfg)
	if err != nil {
		return nil, fmt.Errorf("life agent: create LLM: %w", err)
	}

	systemPrompt := buildSystemPrompt(
		req.Profile,
		req.Memories,
		req.Routines,
		req.PendingActionablesCount,
		req.CalendarEvents,
		time.Now().UTC(),
	)
	if req.SystemContext != "" {
		systemPrompt += "\n\n## Additional context\n" + req.SystemContext
	}

	messages := []llms.MessageContent{
		{
			Role:  llms.ChatMessageTypeSystem,
			Parts: []llms.ContentPart{llms.TextPart(systemPrompt)},
		},
	}

	for _, h := range req.History {
		role := llms.ChatMessageTypeHuman
		if h.Role == "assistant" {
			role = llms.ChatMessageTypeAI
		}
		messages = append(messages, llms.MessageContent{
			Role:  role,
			Parts: []llms.ContentPart{llms.TextPart(h.Content)},
		})
	}

	messages = append(messages, llms.MessageContent{
		Role:  llms.ChatMessageTypeHuman,
		Parts: []llms.ContentPart{llms.TextPart(req.Message)},
	})

	tools := toolDefs()
	var effects []ToolEffect

	// We only want to stream tokens to the user for the FINAL text response,
	// not for intermediate rounds that produce tool call arguments (which look
	// like garbage JSON to the user). So we buffer tokens per round and only
	// flush them if the round produces no tool calls.
	var roundBuffer []byte
	bufferedStreamFunc := func(_ context.Context, chunk []byte) error {
		roundBuffer = append(roundBuffer, chunk...)
		return nil
	}

	// ReAct loop: call LLM → execute tools → call LLM again, up to maxToolRounds.
	for round := 0; round < maxToolRounds; round++ {
		roundBuffer = nil // reset buffer for each round

		resp, err := model.GenerateContent(ctx, messages,
			llms.WithTemperature(0.7),
			llms.WithMaxTokens(4096),
			llms.WithTools(tools),
			llms.WithStreamingFunc(bufferedStreamFunc),
		)
		if err != nil {
			return nil, fmt.Errorf("life agent: generate content (round %d): %w", round, err)
		}

		if len(resp.Choices) == 0 {
			return nil, fmt.Errorf("life agent: no choices returned (round %d)", round)
		}

		choice := resp.Choices[0]

		// No tool calls → the model is done. Flush buffered tokens to the client.
		if len(choice.ToolCalls) == 0 {
			if len(roundBuffer) > 0 {
				onEvent(StreamEvent{Type: "token", Data: string(roundBuffer)})
			}
			result := &ChatResult{Text: choice.Content, Effects: effects}
			resultJSON, _ := json.Marshal(result)
			onEvent(StreamEvent{Type: "done", Data: string(resultJSON)})
			return result, nil
		}
		// Tool calls in this round — discard the buffered tokens (they're tool call JSON noise)

		// Append the assistant turn that contains the tool call requests.
		assistantParts := []llms.ContentPart{}
		if choice.Content != "" {
			assistantParts = append(assistantParts, llms.TextPart(choice.Content))
		}
		for _, tc := range choice.ToolCalls {
			assistantParts = append(assistantParts, llms.ToolCall{
				ID:   tc.ID,
				Type: tc.Type,
				FunctionCall: &llms.FunctionCall{
					Name:      tc.FunctionCall.Name,
					Arguments: tc.FunctionCall.Arguments,
				},
			})
		}
		messages = append(messages, llms.MessageContent{
			Role:  llms.ChatMessageTypeAI,
			Parts: assistantParts,
		})

		// Execute each tool and collect results.
		for _, tc := range choice.ToolCalls {
			log.Printf("life agent: executing tool %q (id=%s)", tc.FunctionCall.Name, tc.ID)
			onEvent(StreamEvent{Type: "tool_call", Data: tc.FunctionCall.Name})

			result := executeTool(ctx, a.db, a.gcalClient, req.UserID, tc)
			log.Printf("life agent: tool %q result: %s", tc.FunctionCall.Name, result)
			onEvent(StreamEvent{Type: "tool_result", Data: result})

			// Track all tool effects for the chat response.
			var parsed struct {
				ID           string `json:"id"`
				ActionableID string `json:"actionable_id"`
				MemoryID     string `json:"memory_id"`
				RoutineID    string `json:"routine_id"`
			}
			_ = json.Unmarshal([]byte(result), &parsed)
			effectID := parsed.ID
			if effectID == "" { effectID = parsed.ActionableID }
			if effectID == "" { effectID = parsed.MemoryID }
			if effectID == "" { effectID = parsed.RoutineID }
			effects = append(effects, ToolEffect{
				Tool:   tc.FunctionCall.Name,
				ID:     effectID,
				Result: result,
			})

			messages = append(messages, llms.MessageContent{
				Role: llms.ChatMessageTypeTool,
				Parts: []llms.ContentPart{
					llms.ToolCallResponse{
						ToolCallID: tc.ID,
						Name:       tc.FunctionCall.Name,
						Content:    result,
					},
				},
			})
		}
	}

	// If we exhausted tool rounds, do one final call without tools to get a
	// plain-text response. Stream these tokens directly — no buffering needed.
	directStreamFunc := func(_ context.Context, chunk []byte) error {
		onEvent(StreamEvent{Type: "token", Data: string(chunk)})
		return nil
	}
	resp, err := model.GenerateContent(ctx, messages,
		llms.WithTemperature(0.7),
		llms.WithMaxTokens(4096),
		llms.WithStreamingFunc(directStreamFunc),
	)
	if err != nil {
		return nil, fmt.Errorf("life agent: final generate content: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("life agent: no choices in final response")
	}
	result := &ChatResult{Text: resp.Choices[0].Content, Effects: effects}
	resultJSON, _ := json.Marshal(result)
	onEvent(StreamEvent{Type: "done", Data: string(resultJSON)})
	return result, nil
}

// GCalClient returns the Google Calendar client associated with this agent,
// or nil if one was not configured.
func (a *Agent) GCalClient() *GCalClient {
	return a.gcalClient
}

// ProcessActionableResponse is called after a user responds to an actionable.
// It logs the resolution and, in future phases, may trigger follow-up agent actions.
func (a *Agent) ProcessActionableResponse(ctx context.Context, userID string, actionable ActionableRecord, response string) error {
	log.Printf("life agent: actionable %q (id=%s) resolved by user %s: %s",
		actionable.Title, actionable.ID, userID, response)
	// Phase 2: simple log. Future phases can re-invoke the agent here to
	// trigger follow-up tool calls based on the resolution.
	return nil
}
