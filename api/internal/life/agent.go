// Package life implements the AI-powered life planning agent and its supporting types.
package life

import (
	"context"
	"database/sql"

	"github.com/n1rna/1tt/api/internal/ai"
)

// ChatAgent is the interface used by the scheduler, day summary, handlers,
// and channel subsystems to interact with an AI agent. kim.Agent implements this.
type ChatAgent interface {
	Chat(ctx context.Context, req ChatRequest) (*ChatResult, error)
	ChatStream(ctx context.Context, req ChatRequest, onEvent func(StreamEvent)) (*ChatResult, error)
	ProcessActionableResponse(ctx context.Context, db *sql.DB, userID string, actionable ActionableRecord, response string) (*ChatResult, error)
	GCalClient() *GCalClient
	LLMConfig() *ai.LLMConfig
}

// Type aliases so existing callers (handlers, channels, scheduler) continue to
// compile without changes. The canonical types now live in the ai package.
type ToolEffect = ai.ToolEffect
type StreamEvent = ai.StreamEvent
type ChatResult = ai.ToolAgentResult

// ChatRequest holds all inputs required for a single chat turn.
type ChatRequest struct {
	UserID                  string
	Message                 string
	History                 []Message           // previous messages in the conversation, oldest first
	Memories                []Memory
	Profile                 *Profile
	Routines                []Routine
	PendingActionablesCount int
	CalendarEvents          []GCalEvent         // upcoming calendar events (may be nil)
	RoutineEventLinks       map[string][]string // maps routine_id → list of linked event summaries
	AutoApprove             bool                // if true, agent executes actions directly; if false, creates actionables for confirmation
	SystemContext           string              // optional extra context appended to system prompt
	ConversationCategory    string              // "life", "health", or "" (defaults to "life")
	HealthProfile           *HealthProfile      // health profile data (loaded by handler)
	ActiveSessions          []SessionSummary    // active workout sessions (loaded by handler)
}

// HealthProfile holds the user's health and fitness profile for the unified agent.
type HealthProfile struct {
	WeightKg            float64
	HeightCm            float64
	GoalWeightKg        float64
	BMI                 float64
	BMR                 float64
	TDEE                float64
	Age                 int
	TargetCalories      int
	ProteinG            int
	CarbsG              int
	FatG                int
	Gender              string
	ActivityLevel       string
	DietType            string
	DietGoal            string
	FitnessLevel        string
	FitnessGoal         string
	Restrictions        []string
	AvailableEquipment  []string
	PhysicalLimitations []string
	WorkoutLikes        []string
	WorkoutDislikes     []string
	PreferredDuration   int
	DaysPerWeek         int
}

// SessionSummary is a condensed view of an active workout session used in the system prompt.
type SessionSummary struct {
	ID            string
	Title         string
	Status        string
	Difficulty    string
	MuscleGroups  []string
	Duration      int
	ExerciseCount int
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
