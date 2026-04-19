package jobs

// Kind names mirror tracked.Meta.Kind strings so the activity UI keeps
// working without changes.

// ─── LLMs crawl + generate ──────────────────────────────────────────────────

type LlmsProcessArgs struct {
	JobID string `json:"job_id"`
}

func (LlmsProcessArgs) Kind() string { return "llms_process" }

// ─── Kim agent flows ────────────────────────────────────────────────────────

// ActionableFollowupArgs runs the agent after a user responds to an actionable.
type ActionableFollowupArgs struct {
	UserID       string `json:"user_id"`
	ActionableID string `json:"actionable_id"`
	Action       string `json:"action"`        // "confirm" | "dismiss" | "snooze" | etc.
	Response     string `json:"response,omitempty"`
}

func (ActionableFollowupArgs) Kind() string { return "actionable_followup" }

// JourneyEventArgs runs the agent after a cascading life event
// (gym_session_updated, meal_plan_updated, routine_updated).
type JourneyEventArgs struct {
	UserID      string `json:"user_id"`
	Trigger     string `json:"trigger"`
	EntityID    string `json:"entity_id"`
	EntityTitle string `json:"entity_title,omitempty"`
	Payload     string `json:"payload,omitempty"` // JSON blob with event details
}

func (JourneyEventArgs) Kind() string { return "journey_event" }

// DailyCycleArgs runs one planning cycle for one user.
type DailyCycleArgs struct {
	UserID string `json:"user_id"`
	Cycle  string `json:"cycle"` // morning_plan | evening_plan | evening_review
}

func (DailyCycleArgs) Kind() string { return "daily_cycle" }

// SchedulerScanArgs fans out DailyCycleArgs per-user based on life_profiles +
// wake/sleep windows. Enqueued by a River PeriodicJob every 5 minutes.
type SchedulerScanArgs struct{}

func (SchedulerScanArgs) Kind() string { return "scheduler_scan" }

// SummaryScanArgs checks which user+date pairs need a day summary
// regenerated and enqueues one SummaryGenerateArgs per hit.
type SummaryScanArgs struct{}

func (SummaryScanArgs) Kind() string { return "summary_scan" }

// SummaryGenerateArgs generates a single day summary for one user.
type SummaryGenerateArgs struct {
	UserID string `json:"user_id"`
	Date   string `json:"date"` // YYYY-MM-DD
}

func (SummaryGenerateArgs) Kind() string { return "summary_generate" }

// CleanupArgs runs the nightly housekeeping sweep: expired files from R2,
// life_agent_runs retention, etc.
type CleanupArgs struct{}

func (CleanupArgs) Kind() string { return "cleanup" }
