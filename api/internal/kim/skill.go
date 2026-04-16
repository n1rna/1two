// Package kim implements the Kim AI agent with a skill-based architecture.
// Skills are self-contained units of prompt instructions + tool definitions
// that are dynamically composed based on the conversation context.
package kim

import (
	"fmt"
	"log"
	"sort"
	"strings"

	"github.com/n1rna/1tt/api/skills"
	"github.com/tmc/langchaingo/llms"
)

// Skill represents a single agent capability with its prompt and tools.
type Skill struct {
	ID          string      // unique identifier (e.g., "routines", "calendar")
	Name        string      // human-readable name
	Prompt      string      // loaded from markdown file
	Tools       []llms.Tool // tool definitions this skill provides
	Categories  []string    // which chat categories activate this skill
	AlwaysOn    bool        // if true, always included regardless of category
	Priority    int         // ordering in prompt assembly (lower = earlier)
	FocusPrompt string      // optional text shown when this skill's category is active
}

// SkillRegistry manages all registered skills and provides category-based selection.
type SkillRegistry struct {
	skills map[string]*Skill
}

// NewSkillRegistry creates a new empty skill registry.
func NewSkillRegistry() *SkillRegistry {
	return &SkillRegistry{skills: make(map[string]*Skill)}
}

// Register adds a skill to the registry.
func (r *SkillRegistry) Register(s *Skill) {
	r.skills[s.ID] = s
}

// Get returns a skill by ID, or nil if not found.
func (r *SkillRegistry) Get(id string) *Skill {
	return r.skills[id]
}

// ForCategory returns all skills that should be active for a given category,
// sorted by priority (lower priority number = earlier in prompt).
func (r *SkillRegistry) ForCategory(category string) []*Skill {
	var active []*Skill
	for _, s := range r.skills {
		if s.AlwaysOn || s.matchesCategory(category) {
			active = append(active, s)
		}
	}
	sort.Slice(active, func(i, j int) bool {
		return active[i].Priority < active[j].Priority
	})
	return active
}

// ToolsForCategory returns all tool definitions from skills active for the given category.
func (r *SkillRegistry) ToolsForCategory(category string) []llms.Tool {
	active := r.ForCategory(category)
	var tools []llms.Tool
	seen := make(map[string]bool)
	for _, s := range active {
		for _, t := range s.Tools {
			if t.Function != nil && !seen[t.Function.Name] {
				seen[t.Function.Name] = true
				tools = append(tools, t)
			}
		}
	}
	return tools
}

// AllTools returns every tool definition across all skills (used for backward compat).
func (r *SkillRegistry) AllTools() []llms.Tool {
	var tools []llms.Tool
	seen := make(map[string]bool)
	for _, s := range r.skills {
		for _, t := range s.Tools {
			if t.Function != nil && !seen[t.Function.Name] {
				seen[t.Function.Name] = true
				tools = append(tools, t)
			}
		}
	}
	return tools
}

// FocusPrompt returns the focus prompt for the given category, if any skill defines one.
func (r *SkillRegistry) FocusPrompt(category string) string {
	for _, s := range r.skills {
		if s.FocusPrompt != "" && s.matchesCategory(category) {
			return s.FocusPrompt
		}
	}
	return ""
}

// matchesCategory checks if a skill should be active for the given category.
func (s *Skill) matchesCategory(category string) bool {
	for _, c := range s.Categories {
		if c == category {
			return true
		}
	}
	return false
}

// loadSkillPrompt reads a markdown file from the embedded skills filesystem.
func loadSkillPrompt(filename string) string {
	data, err := skills.FS.ReadFile(filename)
	if err != nil {
		log.Printf("kim: failed to load skill %q: %v", filename, err)
		return fmt.Sprintf("<!-- skill %s not found -->", filename)
	}
	return strings.TrimSpace(string(data))
}

// DefaultRegistry creates the standard Kim skill registry with all skills loaded.
func DefaultRegistry() *SkillRegistry {
	r := NewSkillRegistry()

	// Core skills (always active)
	r.Register(&Skill{
		ID:       "core",
		Name:     "Core personality",
		Prompt:   loadSkillPrompt("core.md"),
		AlwaysOn: true,
		Priority: 0,
	})
	r.Register(&Skill{
		ID:       "memory",
		Name:     "Memory management",
		Prompt:   loadSkillPrompt("memory.md"),
		Tools:    memoryTools(),
		AlwaysOn: true,
		Priority: 100,
	})
	r.Register(&Skill{
		ID:       "actionables",
		Name:     "Actionables",
		Prompt:   loadSkillPrompt("actionables.md"),
		Tools:    actionableTools(),
		AlwaysOn: true,
		Priority: 110,
	})
	r.Register(&Skill{
		ID:       "cross-domain",
		Name:     "Cross-domain tools",
		Prompt:   loadSkillPrompt("cross-domain.md"),
		Tools:    crossDomainTools(),
		AlwaysOn: true,
		Priority: 120,
	})
	r.Register(&Skill{
		ID:       "marketplace",
		Name:     "Marketplace",
		Prompt:   loadSkillPrompt("marketplace.md"),
		Tools:    marketplaceTools(),
		AlwaysOn: true,
		Priority: 130,
	})
	r.Register(&Skill{
		ID:       "decision-framework",
		Name:     "Decision framework",
		Prompt:   loadSkillPrompt("decision-framework.md"),
		AlwaysOn: true,
		Priority: 900,
	})

	// Category-specific skills
	r.Register(&Skill{
		ID:          "routines",
		Name:        "Routine management",
		Prompt:      loadSkillPrompt("routines.md"),
		Tools:       routineTools(),
		Categories:  []string{"routines", "life", "general", "auto", ""},
		Priority:    200,
		FocusPrompt: "The user is on the routines page. Prefer create_routine / update_routine / delete_routine / list_routines. Reference routine ids directly from the list above.",
	})
	r.Register(&Skill{
		ID:          "calendar",
		Name:        "Google Calendar",
		Prompt:      loadSkillPrompt("calendar.md"),
		Tools:       calendarTools(),
		Categories:  []string{"calendar", "life", "general", "auto", ""},
		Priority:    210,
		FocusPrompt: "The user is on the calendar page. Prefer get_calendar_events / create_calendar_event / update_calendar_event / delete_calendar_event and Google Tasks tools. Reference event ids directly.",
	})
	r.Register(&Skill{
		ID:         "tasks",
		Name:       "Google Tasks",
		Prompt:     loadSkillPrompt("tasks.md"),
		Tools:      taskTools(),
		Categories: []string{"calendar", "life", "general", "auto", ""},
		Priority:   220,
	})
	r.Register(&Skill{
		ID:          "health",
		Name:        "Health profile",
		Prompt:      loadSkillPrompt("health.md"),
		Tools:       healthTools(),
		Categories:  []string{"health", "meals", "gym", "auto"},
		Priority:    300,
		FocusPrompt: "The user is on the health dashboard. Prefer update_health_profile / log_weight and related tools.",
	})
	r.Register(&Skill{
		ID:          "meals",
		Name:        "Meal planning",
		Prompt:      loadSkillPrompt("meals.md"),
		Tools:       mealTools(),
		Categories:  []string{"meals", "health", "auto"},
		Priority:    310,
		FocusPrompt: "The user is on the meal plans page. Prefer generate_meal_plan and meal-related tools. Use the user's nutrition stats below.",
	})
	r.Register(&Skill{
		ID:          "gym",
		Name:        "Workout programming",
		Prompt:      loadSkillPrompt("gym.md"),
		Tools:       gymTools(),
		Categories:  []string{"gym", "health", "auto"},
		Priority:    320,
		FocusPrompt: "The user is on the gym sessions page. Prefer create_session / update_session / add_exercise_to_session / remove_exercise_from_session. Use the user's fitness profile below.",
	})

	// Onboarding — active when the user is on the onboarding flow.
	// Health tools are also included so Kim can save the health profile
	// inline during onboarding without the user leaving the flow.
	r.Register(&Skill{
		ID:          "onboarding",
		Name:        "First-run onboarding",
		Prompt:      loadSkillPrompt("onboarding.md"),
		Tools:       append(onboardingTools(), healthTools()...),
		Categories:  []string{"onboarding"},
		Priority:    50,
		FocusPrompt: "The user is in first-run onboarding. Follow the onboarding skill exactly: one topic at a time, warm and brief, persist answers with update_life_profile / update_health_profile / remember, advance onboarding_step as you go, and only call complete_life_onboarding after the user confirms they're done.",
	})

	// Admin tools (always available, no prompt — just tools)
	r.Register(&Skill{
		ID:       "admin",
		Name:     "Admin tools",
		Tools:    adminTools(),
		AlwaysOn: true,
		Priority: 999,
	})

	// Approval mode skills (loaded conditionally by prompt builder, not via ForCategory)
	r.Register(&Skill{
		ID:       "auto-approve",
		Name:     "Auto-approve mode",
		Prompt:   loadSkillPrompt("auto-approve.md"),
		Priority: 1000,
	})
	r.Register(&Skill{
		ID:       "require-approval",
		Name:     "Require approval mode",
		Prompt:   loadSkillPrompt("require-approval.md"),
		Priority: 1000,
	})

	return r
}
