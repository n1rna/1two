// seed-routines deletes every routine in the database and regenerates a
// fresh set of marketplace routine templates covering common use cases.
//
// Run:  DATABASE_URL=... go run ./cmd/seed-routines
//
// This is a development utility — it truncates user data.

package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

const seedAuthorID = "seed-bot"

type field struct {
	Key         string   `json:"key"`
	Label       string   `json:"label"`
	Description string   `json:"description,omitempty"`
	Type        string   `json:"type"`
	Required    bool     `json:"required,omitempty"`
	Placeholder string   `json:"placeholder,omitempty"`
	Options     []option `json:"options,omitempty"`
	ItemFields  []field  `json:"itemFields,omitempty"`
	ItemLabel   string   `json:"itemLabel,omitempty"`
	Min         *float64 `json:"min,omitempty"`
	Max         *float64 `json:"max,omitempty"`
	Step        *float64 `json:"step,omitempty"`
}

type option struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

type schema struct {
	Fields []field `json:"fields"`
}

type seedRoutine struct {
	Title        string
	Description  string
	Tags         []string
	Schedule     map[string]any
	Config       map[string]any
	ConfigSchema schema
}

func enumField(key, label string, opts []option) field {
	return field{Key: key, Label: label, Type: "enum", Options: opts}
}

func f(key, label, typ string) field { return field{Key: key, Label: label, Type: typ} }

var importanceOpts = []option{
	{Value: "high", Label: "High"},
	{Value: "medium", Label: "Medium"},
	{Value: "low", Label: "Low"},
}

var frequencyOpts = []option{
	{Value: "daily", Label: "Daily"},
	{Value: "every_other_day", Label: "Every other day"},
	{Value: "weekly", Label: "Weekly"},
	{Value: "biweekly", Label: "Every two weeks"},
	{Value: "monthly", Label: "Monthly"},
}

func seedRoutines() []seedRoutine {
	return []seedRoutine{
		// ── 1. Call loved ones ──────────────────────────────────────────────
		{
			Title:       "Stay in touch with family & friends",
			Description: "Never lose touch with the people who matter. Remind yourself to call each person at the cadence you pick, and keep a short note on what you last talked about.",
			Tags:        []string{"family", "relationships", "habit"},
			Schedule: map[string]any{
				"frequency": "daily",
				"time":      "18:30",
			},
			ConfigSchema: schema{Fields: []field{
				{
					Key:         "contacts",
					Label:       "People to call",
					Description: "Each person gets their own cadence and importance level.",
					Type:        "array",
					ItemLabel:   "contact",
					ItemFields: []field{
						{Key: "name", Label: "Name", Type: "string", Required: true},
						enumField("frequency", "Frequency", frequencyOpts),
						enumField("importance", "Importance", importanceOpts),
						{Key: "last_topic", Label: "Last topic", Type: "text", Placeholder: "What did you last talk about?"},
					},
				},
			}},
			Config: map[string]any{
				"contacts": []map[string]any{
					{"name": "Mom", "frequency": "every_other_day", "importance": "high", "last_topic": ""},
					{"name": "Dad", "frequency": "weekly", "importance": "high", "last_topic": ""},
					{"name": "Best friend", "frequency": "weekly", "importance": "medium", "last_topic": ""},
				},
			},
		},

		// ── 2. Weekly review (GTD) ──────────────────────────────────────────
		{
			Title:       "Weekly review — GTD style",
			Description: "Every Sunday: reflect on wins, review goals, plan the week ahead. Based on Getting Things Done.",
			Tags:        []string{"gtd", "productivity", "reflection"},
			Schedule: map[string]any{
				"frequency": "weekly",
				"days":      []int{0},
				"time":      "18:00",
			},
			ConfigSchema: schema{Fields: []field{
				{
					Key:         "questions",
					Label:       "Review questions",
					Description: "Kim walks you through these prompts each Sunday.",
					Type:        "array",
					ItemLabel:   "question",
				},
				{
					Key:   "duration_minutes",
					Label: "Duration (min)",
					Type:  "number",
					Min:   ptrF64(10),
					Max:   ptrF64(120),
					Step:  ptrF64(5),
				},
			}},
			Config: map[string]any{
				"questions": []string{
					"What went well this week?",
					"What would I change?",
					"Top 3 priorities for next week?",
					"Any projects stalled or blocked?",
					"What am I grateful for?",
				},
				"duration_minutes": 45,
			},
		},

		// ── 3. Morning routine ──────────────────────────────────────────────
		{
			Title:       "Grounded morning routine",
			Description: "Start the day with intention. Hydrate, stretch, journal, and get moving — a gentle ladder that sets the tone before screens take over.",
			Tags:        []string{"morning", "habit", "mindfulness"},
			Schedule: map[string]any{
				"frequency": "daily",
				"time":      "06:30",
			},
			ConfigSchema: schema{Fields: []field{
				{
					Key:         "steps",
					Label:       "Steps",
					Description: "Ordered list of actions. Do them one after the other.",
					Type:        "array",
					ItemLabel:   "step",
					ItemFields: []field{
						{Key: "action", Label: "Action", Type: "string", Required: true},
						{Key: "duration_minutes", Label: "Minutes", Type: "number", Min: ptrF64(1)},
						{Key: "notes", Label: "Notes", Type: "text"},
					},
				},
			}},
			Config: map[string]any{
				"steps": []map[string]any{
					{"action": "Drink a full glass of water", "duration_minutes": 2, "notes": "Room temp, add lemon if you like"},
					{"action": "5-minute stretching", "duration_minutes": 5, "notes": "Focus on neck, shoulders, hamstrings"},
					{"action": "Journal one page", "duration_minutes": 10, "notes": "Gratitude + intention for today"},
					{"action": "10-minute walk outside", "duration_minutes": 10, "notes": "Morning sunlight helps regulate sleep"},
					{"action": "Prep breakfast before checking your phone", "duration_minutes": 15, "notes": ""},
				},
			},
		},

		// ── 4. Reading habit ────────────────────────────────────────────────
		{
			Title:       "Daily reading — 30 minutes",
			Description: "Build a reading habit. Track your reading list, mark what you're actively on, and keep your queue in sight.",
			Tags:        []string{"reading", "learning", "habit"},
			Schedule: map[string]any{
				"frequency": "daily",
				"time":      "21:00",
			},
			ConfigSchema: schema{Fields: []field{
				{
					Key:       "books",
					Label:     "Reading list",
					Type:      "array",
					ItemLabel: "book",
					ItemFields: []field{
						{Key: "title", Label: "Title", Type: "string", Required: true},
						{Key: "author", Label: "Author", Type: "string"},
						enumField("status", "Status", []option{
							{Value: "queued", Label: "Queued"},
							{Value: "reading", Label: "Reading"},
							{Value: "completed", Label: "Completed"},
						}),
						{Key: "notes", Label: "Notes", Type: "text"},
					},
				},
				{
					Key:   "duration_minutes",
					Label: "Session length (min)",
					Type:  "number",
					Min:   ptrF64(5),
					Max:   ptrF64(240),
					Step:  ptrF64(5),
				},
			}},
			Config: map[string]any{
				"books": []map[string]any{
					{"title": "Deep Work", "author": "Cal Newport", "status": "reading", "notes": "Chapter 3"},
					{"title": "The Pragmatic Programmer", "author": "Hunt & Thomas", "status": "queued", "notes": ""},
					{"title": "Four Thousand Weeks", "author": "Oliver Burkeman", "status": "queued", "notes": ""},
				},
				"duration_minutes": 30,
			},
		},

		// ── 5. Habit tracker (single habit) ─────────────────────────────────
		{
			Title:       "Daily habit tracker",
			Description: "Stack a single habit onto an existing cue, and give yourself a tiny reward. Atomic Habits style.",
			Tags:        []string{"habit", "atomic-habits", "discipline"},
			Schedule: map[string]any{
				"frequency": "daily",
				"time":      "08:00",
			},
			ConfigSchema: schema{Fields: []field{
				{Key: "habit", Label: "Habit", Type: "string", Required: true, Placeholder: "The behaviour to track"},
				{Key: "cue", Label: "Cue", Type: "string", Placeholder: "What triggers the habit?"},
				{Key: "reward", Label: "Reward", Type: "string", Placeholder: "How will you celebrate?"},
				enumField("difficulty", "Difficulty", []option{
					{Value: "tiny", Label: "Tiny (2 minutes)"},
					{Value: "small", Label: "Small (5–10 minutes)"},
					{Value: "medium", Label: "Medium (15–30 minutes)"},
					{Value: "large", Label: "Large (30+ minutes)"},
				}),
				{Key: "streak_goal_days", Label: "Streak goal (days)", Type: "number", Min: ptrF64(1)},
			}},
			Config: map[string]any{
				"habit":            "Write 3 sentences in my journal",
				"cue":              "After pouring morning coffee",
				"reward":           "Play one round of Wordle",
				"difficulty":       "tiny",
				"streak_goal_days": 30,
			},
		},

		// ── 6. Workout variations ──────────────────────────────────────────
		{
			Title:       "Weekly workout split (push / pull / legs)",
			Description: "Rotate training focus across the week so every major muscle group gets its turn. Pair with your gym sessions for the actual exercises.",
			Tags:        []string{"gym", "strength", "split"},
			Schedule: map[string]any{
				"frequency": "weekly",
				"days":      []int{1, 2, 4, 5},
				"time":      "07:00",
			},
			ConfigSchema: schema{Fields: []field{
				{
					Key:         "variations",
					Label:       "Workout variations",
					Description: "Map each training day to a focus.",
					Type:        "array",
					ItemLabel:   "variation",
					ItemFields: []field{
						enumField("day", "Day", []option{
							{Value: "monday", Label: "Mon"},
							{Value: "tuesday", Label: "Tue"},
							{Value: "wednesday", Label: "Wed"},
							{Value: "thursday", Label: "Thu"},
							{Value: "friday", Label: "Fri"},
							{Value: "saturday", Label: "Sat"},
							{Value: "sunday", Label: "Sun"},
						}),
						{Key: "workout", Label: "Focus", Type: "string", Placeholder: "e.g. Push — chest / shoulders / triceps"},
						enumField("intensity", "Intensity", []option{
							{Value: "light", Label: "Light"},
							{Value: "moderate", Label: "Moderate"},
							{Value: "heavy", Label: "Heavy"},
						}),
					},
				},
			}},
			Config: map[string]any{
				"variations": []map[string]any{
					{"day": "monday", "workout": "Push — chest / shoulders / triceps", "intensity": "heavy"},
					{"day": "tuesday", "workout": "Pull — back / biceps / rear delts", "intensity": "heavy"},
					{"day": "thursday", "workout": "Legs — quads / hamstrings / glutes", "intensity": "heavy"},
					{"day": "friday", "workout": "Full body conditioning", "intensity": "moderate"},
				},
			},
		},

		// ── 7. Evening wind-down ────────────────────────────────────────────
		{
			Title:       "Evening wind-down",
			Description: "Transition from work to rest: tidy up, set tomorrow's priorities, dim the lights, and actually put the phone away. Designed for better sleep.",
			Tags:        []string{"evening", "sleep", "wind-down"},
			Schedule: map[string]any{
				"frequency": "daily",
				"time":      "21:30",
			},
			ConfigSchema: schema{Fields: []field{
				{
					Key:         "steps",
					Label:       "Wind-down steps",
					Description: "A calming progression, no more than 45 minutes total.",
					Type:        "array",
					ItemLabel:   "step",
					ItemFields: []field{
						{Key: "action", Label: "Action", Type: "string", Required: true},
						{Key: "duration_minutes", Label: "Minutes", Type: "number", Min: ptrF64(1)},
					},
				},
			}},
			Config: map[string]any{
				"steps": []map[string]any{
					{"action": "Clear the kitchen counter", "duration_minutes": 5},
					{"action": "Write down top 3 priorities for tomorrow", "duration_minutes": 5},
					{"action": "Dim lights, put phone on airplane mode", "duration_minutes": 2},
					{"action": "Read a physical book", "duration_minutes": 20},
					{"action": "10 slow breaths in bed", "duration_minutes": 3},
				},
			},
		},
	}
}

func ptrF64(v float64) *float64 { return &v }

func slugify(title string) string {
	out := strings.ToLower(title)
	out = strings.ReplaceAll(out, "—", "-")
	var b strings.Builder
	for _, r := range out {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ', r == '-', r == '_':
			b.WriteRune('-')
		}
	}
	s := strings.Trim(b.String(), "-")
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	return s
}

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		log.Fatalf("marshal: %v", err)
	}
	return string(b)
}

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatalf("DATABASE_URL env is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("ping: %v", err)
	}

	// Ensure migration 038 is applied (idempotent).
	if _, err := db.ExecContext(ctx,
		`ALTER TABLE life_routines ADD COLUMN IF NOT EXISTS config_schema JSONB NOT NULL DEFAULT '{}'`,
	); err != nil {
		log.Fatalf("ensure config_schema column: %v", err)
	}

	// Ensure seed author exists in the users table, if we have one.
	// We intentionally tolerate failure here — some schemas don't enforce
	// author_id as a foreign key.
	_, _ = db.ExecContext(ctx,
		`INSERT INTO users (id, email, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
		seedAuthorID, "seed@1tt.dev", "Seed Bot",
	)

	// Wipe existing routines (and their marketplace listings).
	deleteFromLifeRoutines(ctx, db)
	deleteExistingSeedMarketplaceItems(ctx, db)

	// Seed fresh marketplace items.
	for _, sr := range seedRoutines() {
		id := uuid.NewString()
		slug := slugify(sr.Title) + "-" + id[:6]
		sourceID := uuid.NewString()

		content := map[string]any{
			"name":         sr.Title,
			"description":  sr.Description,
			"schedule":     sr.Schedule,
			"config":       sr.Config,
			"configSchema": sr.ConfigSchema,
		}

		// Insert the marketplace item.
		if _, err := db.ExecContext(ctx, `
			INSERT INTO life_marketplace_items
			  (id, slug, kind, source_id, author_id, title, description, tags, current_version, fork_count, view_count)
			VALUES ($1, $2, 'routine', $3, $4, $5, $6, $7, 1, 0, 0)
		`,
			id, slug, sourceID, seedAuthorID, sr.Title, sr.Description, stringArray(sr.Tags),
		); err != nil {
			log.Fatalf("insert item %q: %v", sr.Title, err)
		}

		// Insert version 1 with the full content + schema.
		if _, err := db.ExecContext(ctx, `
			INSERT INTO life_marketplace_versions (id, item_id, version, title, description, content, changelog)
			VALUES ($1, $2, 1, $3, $4, $5::jsonb, 'Initial seed version')
		`,
			uuid.NewString(), id, sr.Title, sr.Description, mustJSON(content),
		); err != nil {
			log.Fatalf("insert version for %q: %v", sr.Title, err)
		}

		fmt.Printf("✓ seeded  %-48s  (/tools/life/marketplace/items/%s)\n", sr.Title, id)
	}

	fmt.Printf("\nSeeded %d routines in marketplace.\n", len(seedRoutines()))
}

func deleteFromLifeRoutines(ctx context.Context, db *sql.DB) {
	res, err := db.ExecContext(ctx, `DELETE FROM life_routines`)
	if err != nil {
		log.Fatalf("delete routines: %v", err)
	}
	n, _ := res.RowsAffected()
	fmt.Printf("→ deleted %d existing routine(s)\n", n)
}

func deleteExistingSeedMarketplaceItems(ctx context.Context, db *sql.DB) {
	res, err := db.ExecContext(ctx,
		`DELETE FROM life_marketplace_items WHERE kind = 'routine' AND author_id = $1`,
		seedAuthorID,
	)
	if err != nil {
		log.Fatalf("delete seeded marketplace: %v", err)
	}
	n, _ := res.RowsAffected()
	fmt.Printf("→ deleted %d previously-seeded marketplace routine(s)\n", n)
}

// stringArray wraps []string as a Postgres TEXT[] literal.
func stringArray(in []string) interface{} {
	// Use pq.Array via a lightweight adapter. We import lib/pq above.
	return pqArray(in)
}

// Small helper so we don't need to import pq twice — just alias the Array func.
func pqArray(in []string) interface{} {
	return pqArrayImpl(in)
}

// Kept as a separate layer so the import of pq.Array is localised.
var pqArrayImpl = func(in []string) interface{} {
	return stringArrayLit(in)
}

// stringArrayLit returns a Postgres-compatible array literal. Simpler than
// pulling pq.Array when we just want to avoid importing it twice.
func stringArrayLit(in []string) string {
	if len(in) == 0 {
		return "{}"
	}
	parts := make([]string, len(in))
	for i, s := range in {
		parts[i] = `"` + strings.ReplaceAll(strings.ReplaceAll(s, `\`, `\\`), `"`, `\"`) + `"`
	}
	return "{" + strings.Join(parts, ",") + "}"
}
