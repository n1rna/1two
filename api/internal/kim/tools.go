package kim

import "github.com/tmc/langchaingo/llms"

// Tool definitions grouped by skill. Each function returns the tool definitions
// for a single skill, enabling per-category tool selection.

func memoryTools() []llms.Tool {
	return []llms.Tool{
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "remember",
				Description: "Store a new fact, preference, instruction, habit, allergy, or injury about the user for future context.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"content": map[string]any{
							"type":        "string",
							"description": "The fact or preference to remember",
						},
						"category": map[string]any{
							"type":        "string",
							"enum":        []string{"preference", "instruction", "fact", "habit", "allergy", "injury"},
							"description": "Category for organising the memory",
						},
					},
					"required": []string{"content"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "forget",
				Description: "Remove a memory that is no longer accurate or relevant.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"memory_id": map[string]any{
							"type":        "string",
							"description": "The ID of the memory to delete (soft-delete)",
						},
					},
					"required": []string{"memory_id"},
				},
			},
		},
	}
}

func actionableTools() []llms.Tool {
	return []llms.Tool{
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "create_actionable",
				Description: "Create an actionable item that surfaces to the user for a decision or acknowledgement.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"type": map[string]any{
							"type":        "string",
							"enum":        []string{"confirm", "choose", "input", "info"},
							"description": "confirm = yes/no; choose = pick from options; input = free-text response; info = read-only notice",
						},
						"title": map[string]any{
							"type":        "string",
							"description": "Short headline (max ~80 chars)",
						},
						"description": map[string]any{
							"type":        "string",
							"description": "Explanation shown to the user",
						},
						"template": map[string]any{
							"type":        "string",
							"enum":        []string{"daily_plan", "daily_review", "routine_check", "meal_choice", "schedule_pick", "reminder", "preference", "task_roundup", "streak", "suggestion"},
							"description": "Optional visual template for rich display",
						},
						"data": map[string]any{
							"type":        "object",
							"description": "Optional structured data for the template",
						},
						"options": map[string]any{
							"type":        "array",
							"description": "Required for type=choose. List of choices.",
							"items": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"id":     map[string]any{"type": "string"},
									"label":  map[string]any{"type": "string"},
									"detail": map[string]any{"type": "string"},
								},
								"required": []string{"id", "label"},
							},
						},
						"due_at": map[string]any{
							"type":        "string",
							"description": "Optional ISO-8601 deadline",
						},
						"action_type": map[string]any{
							"type":        "string",
							"enum":        []string{"create_routine", "create_memory", "create_calendar_event", "delete_calendar_event", "create_task", "none"},
							"description": "Deferred action to execute when the user confirms.",
						},
						"action_payload": map[string]any{
							"type":        "object",
							"description": "Data for the deferred action.",
						},
						"source": map[string]any{
							"type":        "object",
							"description": "Optional tag describing what triggered this actionable. For journey events, set kind='journey' and trigger to one of 'gym_session_updated','meal_plan_updated','routine_updated', plus entity_id and entity_title.",
							"properties": map[string]any{
								"kind":         map[string]any{"type": "string", "description": "'journey' for cascade actionables."},
								"trigger":      map[string]any{"type": "string", "description": "Which event triggered this."},
								"entity_id":    map[string]any{"type": "string", "description": "ID of the entity that changed."},
								"entity_title": map[string]any{"type": "string", "description": "Human-readable title of the entity."},
							},
						},
					},
					"required": []string{"type", "title"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "list_actionables",
				Description: "Retrieve the user's actionables, optionally filtered by status.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"status": map[string]any{
							"type":        "string",
							"enum":        []string{"pending", "confirmed", "dismissed", "snoozed"},
							"description": "Filter by status. Defaults to pending.",
						},
					},
				},
			},
		},
	}
}

func routineTools() []llms.Tool {
	return []llms.Tool{
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "create_routine",
				Description: "Create a new recurring routine. Only use when you have HIGH confidence the user wants this tracked. For medium confidence, create a confirm actionable instead.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"name": map[string]any{
							"type":        "string",
							"description": "Human-readable name (e.g. 'Morning Gym', 'Call Family', 'Evening Reading')",
						},
						"type": map[string]any{
							"type":        "string",
							"enum":        []string{"call_loved_ones", "gym", "reading", "morning_routine", "evening_routine", "weekly_review", "habit_tracker", "custom"},
							"description": "Routine category",
						},
						"description": map[string]any{
							"type":        "string",
							"description": "What this routine involves",
						},
						"schedule": map[string]any{
							"type":        "object",
							"description": `When the routine occurs. Format: {"frequency": "daily"|"weekly"|"every_n_days", "interval": 2, "days": [1,3,5], "time": "09:00"}. days: 0=Sun..6=Sat.`,
							"properties": map[string]any{
								"frequency": map[string]any{"type": "string", "enum": []string{"daily", "weekly", "every_n_days"}},
								"interval":  map[string]any{"type": "integer", "description": "For every_n_days: repeat every N days"},
								"days":      map[string]any{"type": "array", "items": map[string]any{"type": "integer"}, "description": "For weekly: which days (0=Sun..6=Sat)"},
								"time":      map[string]any{"type": "string", "description": "Preferred time in HH:MM format"},
							},
						},
						"config": map[string]any{
							"type":        "object",
							"description": `User-specific values conforming to config_schema. Examples: call_loved_ones: {"contacts":[{"name":"Mom","frequency":"every_other_day"}]}; gym: {"variations":[{"day":"monday","workout":"legs"}]}; reading: {"books":[{"title":"...","status":"reading"}]}`,
						},
						"config_schema": map[string]any{
							"type":        "object",
							"description": `Optional schema describing the structure of config. Format: {"fields":[{"key":"name","label":"Name","type":"string|text|number|boolean|enum|array","options":[...],"itemFields":[...]}]}`,
						},
					},
					"required": []string{"name", "type"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "update_routine",
				Description: "Update an existing routine. Use this instead of creating a new one when the user wants to modify a routine.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"routine_id": map[string]any{
							"type":        "string",
							"description": "ID of the routine to update",
						},
						"name":        map[string]any{"type": "string", "description": "New name (optional)"},
						"description": map[string]any{"type": "string", "description": "New description (optional)"},
						"schedule":    map[string]any{"type": "object", "description": "New schedule (optional, replaces existing)"},
						"config":      map[string]any{"type": "object", "description": "New config values (optional, replaces existing)"},
						"config_schema": map[string]any{
							"type":        "object",
							"description": "New config schema (optional, rarely needed)",
						},
						"active": map[string]any{"type": "boolean", "description": "Set to false to deactivate the routine"},
					},
					"required": []string{"routine_id"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "delete_routine",
				Description: "Deactivate (soft-delete) a routine.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"routine_id": map[string]any{"type": "string", "description": "ID of the routine to delete"},
					},
					"required": []string{"routine_id"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "list_routines",
				Description: "Retrieve the user's active routines with their IDs.",
				Parameters: map[string]any{
					"type":       "object",
					"properties": map[string]any{},
				},
			},
		},
	}
}

func calendarTools() []llms.Tool {
	return []llms.Tool{
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "get_calendar_events",
				Description: "Fetch upcoming events from the user's connected Google Calendar.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"days_ahead": map[string]any{"type": "integer", "description": "How many days ahead to fetch events. Defaults to 7."},
					},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "create_calendar_event",
				Description: "Create a new event on the user's Google Calendar.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"summary":     map[string]any{"type": "string", "description": "Event title"},
						"start":       map[string]any{"type": "string", "description": "Start time in RFC3339 format"},
						"end":         map[string]any{"type": "string", "description": "End time in RFC3339 format"},
						"description": map[string]any{"type": "string", "description": "Optional event description"},
						"location":    map[string]any{"type": "string", "description": "Optional event location"},
						"routine_id":  map[string]any{"type": "string", "description": "Optional: link this event to a routine"},
						"recurrence":  map[string]any{"type": "array", "description": `Optional RRULE strings, e.g. ["RRULE:FREQ=WEEKLY;BYDAY=MO"]`, "items": map[string]any{"type": "string"}},
					},
					"required": []string{"summary", "start", "end"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "link_event_to_routine",
				Description: "Link an existing Google Calendar event to a routine.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"event_id":   map[string]any{"type": "string", "description": "Google Calendar event ID"},
						"routine_id": map[string]any{"type": "string", "description": "Routine ID to link to"},
					},
					"required": []string{"event_id", "routine_id"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "update_calendar_event",
				Description: "Update an existing event on the user's Google Calendar.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"event_id":    map[string]any{"type": "string", "description": "The event ID to update"},
						"summary":     map[string]any{"type": "string", "description": "New title (optional)"},
						"start":       map[string]any{"type": "string", "description": "New start time RFC3339 (optional)"},
						"end":         map[string]any{"type": "string", "description": "New end time RFC3339 (optional)"},
						"description": map[string]any{"type": "string", "description": "New description (optional)"},
						"location":    map[string]any{"type": "string", "description": "New location (optional)"},
					},
					"required": []string{"event_id"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "delete_calendar_event",
				Description: "Delete an event from the user's Google Calendar.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"event_id": map[string]any{"type": "string", "description": "The event ID to delete"},
					},
					"required": []string{"event_id"},
				},
			},
		},
	}
}

func taskTools() []llms.Tool {
	return []llms.Tool{
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "list_tasks", Description: "List tasks from the user's Google Tasks.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"list_id":        map[string]any{"type": "string", "description": "Task list ID. Omit to use default."},
				"show_completed": map[string]any{"type": "boolean", "description": "Include completed tasks. Defaults to false."},
			}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "create_task", Description: "Create a new task in Google Tasks.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"title":   map[string]any{"type": "string", "description": "Task title"},
				"notes":   map[string]any{"type": "string", "description": "Optional notes"},
				"due":     map[string]any{"type": "string", "description": "Due date YYYY-MM-DD"},
				"list_id": map[string]any{"type": "string", "description": "Task list ID. Omit for default."},
			}, "required": []string{"title"}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "complete_task", Description: "Mark a Google Task as completed.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"task_id": map[string]any{"type": "string", "description": "The task ID"},
				"list_id": map[string]any{"type": "string", "description": "Task list ID. Omit for default."},
			}, "required": []string{"task_id"}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "update_task", Description: "Update a Google Task's title, notes, due date, or status.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"task_id": map[string]any{"type": "string", "description": "The task ID"},
				"title":   map[string]any{"type": "string", "description": "New title"},
				"notes":   map[string]any{"type": "string", "description": "New notes"},
				"due":     map[string]any{"type": "string", "description": "Due date YYYY-MM-DD"},
				"status":  map[string]any{"type": "string", "enum": []string{"needsAction", "completed"}},
				"list_id": map[string]any{"type": "string", "description": "Task list ID. Omit for default."},
			}, "required": []string{"task_id"}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "delete_task", Description: "Permanently delete a Google Task.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"task_id": map[string]any{"type": "string", "description": "The task ID"},
				"list_id": map[string]any{"type": "string", "description": "Task list ID. Omit for default."},
			}, "required": []string{"task_id"}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "create_task_list", Description: "Create a new Google Tasks list.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"title": map[string]any{"type": "string", "description": "Name of the new task list"},
			}, "required": []string{"title"}},
		}},
	}
}

func healthTools() []llms.Tool {
	return []llms.Tool{
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "update_health_profile", Description: "Update user's health profile — body stats, diet, fitness level, equipment, limitations, preferences.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"weight_kg": map[string]any{"type": "number"}, "height_cm": map[string]any{"type": "number"},
				"age": map[string]any{"type": "integer"}, "gender": map[string]any{"type": "string", "enum": []string{"male", "female"}},
				"activity_level":         map[string]any{"type": "string", "enum": []string{"sedentary", "light", "moderate", "active", "very_active"}},
				"diet_type":              map[string]any{"type": "string", "enum": []string{"balanced", "keto", "low_carb", "high_protein", "mediterranean", "paleo", "vegan"}},
				"diet_goal":              map[string]any{"type": "string", "enum": []string{"lose", "maintain", "gain"}},
				"goal_weight_kg":         map[string]any{"type": "number"},
				"dietary_restrictions":   map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"fitness_level":          map[string]any{"type": "string", "enum": []string{"beginner", "intermediate", "advanced"}},
				"fitness_goal":           map[string]any{"type": "string", "enum": []string{"strength", "hypertrophy", "endurance", "weight_loss", "general_fitness"}},
				"available_equipment":    map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"physical_limitations":   map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"workout_likes":          map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"workout_dislikes":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"preferred_duration_min": map[string]any{"type": "integer"},
				"days_per_week":          map[string]any{"type": "integer"},
			}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "log_weight", Description: "Record a weight measurement. Also updates the profile's current weight.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"weight_kg": map[string]any{"type": "number"},
				"note":      map[string]any{"type": "string"},
				"date":      map[string]any{"type": "string", "description": "YYYY-MM-DD, defaults to today"},
			}, "required": []string{"weight_kg"}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "complete_onboarding", Description: "Mark the user's health onboarding as complete. Call ONLY after collecting basic profile info AND the user has confirmed.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{}},
		}},
	}
}

func mealTools() []llms.Tool {
	return []llms.Tool{
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "generate_meal_plan", Description: "Generate a structured meal plan based on the user's profile and preferences.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"plan_type": map[string]any{"type": "string", "enum": []string{"daily", "weekly"}},
				"title":     map[string]any{"type": "string"},
				"meals": map[string]any{"type": "array", "items": map[string]any{
					"type": "object", "properties": map[string]any{
						"day":       map[string]any{"type": "string"},
						"meal_type": map[string]any{"type": "string", "enum": []string{"breakfast", "lunch", "dinner", "snack"}},
						"name":      map[string]any{"type": "string"},
						"description": map[string]any{"type": "string", "description": "Short one-sentence summary, shown on the meal card."},
						"calories":  map[string]any{"type": "integer"},
						"protein_g": map[string]any{"type": "integer"},
						"carbs_g":   map[string]any{"type": "integer"},
						"fat_g":     map[string]any{"type": "integer"},
						"fiber_g":   map[string]any{"type": "integer"},
						"ingredients": map[string]any{
							"type":        "array",
							"description": "Ingredient list with quantities for the detail view.",
							"items": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"name":     map[string]any{"type": "string"},
									"quantity": map[string]any{"type": "string", "description": "Free-form quantity like '200g', '2 cups', '1 tbsp'."},
								},
								"required": []string{"name"},
							},
						},
						"prep_notes": map[string]any{"type": "string", "description": "Brief preparation instructions or chef notes."},
						"tags":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Tags like 'high-protein', 'vegetarian', 'quick-prep'."},
					}, "required": []string{"meal_type", "name", "calories"},
				}},
				"supplements": supplementArraySchema(),
			}, "required": []string{"plan_type", "title", "meals"}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name:        "add_supplements_to_plan",
			Description: "Add one or more supplements (pills, vitamins, powders, etc.) to an existing meal plan without regenerating it.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"plan_id":     map[string]any{"type": "string", "description": "Target meal plan ID."},
				"supplements": supplementArraySchema(),
			}, "required": []string{"plan_id", "supplements"}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "propose_meal_edits",
			Description: "Propose modifications to one or more meals the user has currently selected in the meal plan view. Use this when the user asks to bulk-edit meals they've selected; the 'Selected context' section of the system prompt will list the selection_ids and full snapshots of the meals in play. Do NOT apply changes yourself — the frontend will render a preview and let the user confirm before persisting.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"plan_id": map[string]any{"type": "string", "description": "The meal plan id (must match the current plan the user is viewing)."},
					"summary": map[string]any{"type": "string", "description": "One-sentence summary of the batch change, e.g. 'Swapped 4 meals to vegetarian alternatives'."},
					"updates": map[string]any{
						"type":        "array",
						"description": "List of per-meal edits. Each entry must reference a selection_id from the selected set, plus a partial patch of MealItem fields to apply.",
						"items": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"selection_id": map[string]any{"type": "string", "description": "The selection id for the meal being edited, of the form 'plan:day:slot:index'."},
								"reason":       map[string]any{"type": "string", "description": "Short human-readable reason for this specific change."},
								"patch": map[string]any{
									"type":        "object",
									"description": "Partial MealItem fields to override on this meal. Only include fields that change.",
									"properties": map[string]any{
										"name":        map[string]any{"type": "string"},
										"description": map[string]any{"type": "string"},
										"calories":    map[string]any{"type": "integer"},
										"protein_g":   map[string]any{"type": "integer"},
										"carbs_g":     map[string]any{"type": "integer"},
										"fat_g":       map[string]any{"type": "integer"},
										"fiber_g":     map[string]any{"type": "integer"},
										"ingredients": map[string]any{
											"type": "array",
											"items": map[string]any{
												"type": "object",
												"properties": map[string]any{
													"name":     map[string]any{"type": "string"},
													"quantity": map[string]any{"type": "string"},
												},
												"required": []string{"name"},
											},
										},
										"prep_notes": map[string]any{"type": "string"},
										"tags":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
									},
								},
							},
							"required": []string{"selection_id", "patch"},
						},
					},
				},
				"required": []string{"plan_id", "updates"},
			},
		}},
	}
}

// supplementArraySchema is the shared JSON-schema for arrays of supplements,
// reused by generate_meal_plan and add_supplements_to_plan.
func supplementArraySchema() map[string]any {
	return map[string]any{
		"type":        "array",
		"description": "Supplements to include in the plan. Supplements are tracked separately from meals and don't contribute to caloric macros.",
		"items": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"day":    map[string]any{"type": "string", "description": "Optional day (monday..sunday). Omit to take every day."},
				"name":   map[string]any{"type": "string"},
				"form":   map[string]any{"type": "string", "enum": []string{"pill", "capsule", "powder", "liquid", "gummy", "other"}},
				"dose":   map[string]any{"type": "number"},
				"unit":   map[string]any{"type": "string", "description": "e.g. mg, mcg, IU, g, ml, drops, scoop."},
				"timing": map[string]any{"type": "string", "description": "e.g. 'morning', 'with breakfast', 'before bed'."},
				"notes":  map[string]any{"type": "string"},
			},
			"required": []string{"name", "form", "dose", "unit", "timing"},
		},
	}
}

func gymTools() []llms.Tool {
	return []llms.Tool{
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "create_session", Description: "Create a new workout session with exercises.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"title": map[string]any{"type": "string"}, "description": map[string]any{"type": "string"},
				"active":               map[string]any{"type": "boolean", "description": "Defaults to true."},
				"target_muscle_groups": map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Muscle groups targeted (e.g. chest, back, legs, shoulders, arms, core)."},
				"equipment":            map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Equipment used (e.g. bodyweight, dumbbells, barbell, cables, machines, kettlebell, resistance bands)."},
				"estimated_duration":   map[string]any{"type": "integer"},
				"difficulty_level":     map[string]any{"type": "string", "enum": []string{"beginner", "intermediate", "advanced"}},
				"exercises": map[string]any{"type": "array", "items": map[string]any{
					"type": "object", "properties": map[string]any{
						"exercise_name": map[string]any{"type": "string"}, "sets": map[string]any{"type": "integer"},
						"reps": map[string]any{"type": "string"}, "weight": map[string]any{"type": "string"},
						"rest_seconds": map[string]any{"type": "integer"}, "notes": map[string]any{"type": "string"},
						"superset_group": map[string]any{"type": "string"},
					}, "required": []string{"exercise_name"},
				}},
			}, "required": []string{"title", "exercises"}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "update_session", Description: "Update a workout session's metadata or enable/disable it.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"session_id":           map[string]any{"type": "string"},
				"title":                map[string]any{"type": "string"},
				"description":          map[string]any{"type": "string"},
				"active":               map[string]any{"type": "boolean"},
				"target_muscle_groups": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"equipment":            map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"estimated_duration":   map[string]any{"type": "integer"},
				"difficulty_level":     map[string]any{"type": "string", "enum": []string{"beginner", "intermediate", "advanced"}},
			}, "required": []string{"session_id"}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "add_exercise_to_session", Description: "Add exercises to an existing workout session.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"session_id": map[string]any{"type": "string"},
				"exercises": map[string]any{"type": "array", "items": map[string]any{
					"type": "object", "properties": map[string]any{
						"exercise_name": map[string]any{"type": "string"}, "sets": map[string]any{"type": "integer"},
						"reps": map[string]any{"type": "string"}, "weight": map[string]any{"type": "string"},
						"rest_seconds": map[string]any{"type": "integer"}, "notes": map[string]any{"type": "string"},
						"superset_group": map[string]any{"type": "string"},
					}, "required": []string{"exercise_name"},
				}},
			}, "required": []string{"session_id", "exercises"}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "remove_exercise_from_session", Description: "Remove an exercise from a session by ID.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"session_id":  map[string]any{"type": "string"},
				"exercise_id": map[string]any{"type": "string"},
			}, "required": []string{"session_id", "exercise_id"}},
		}},
	}
}

func crossDomainTools() []llms.Tool {
	return []llms.Tool{
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "get_health_summary", Description: "Fetch the user's health profile, recent weight entries, nutrition stats, and active workout sessions.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "get_life_summary", Description: "Fetch the user's upcoming calendar events, active routines, and pending actionables count.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{}},
		}},
	}
}

func marketplaceTools() []llms.Tool {
	return []llms.Tool{
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "search_marketplace", Description: "Search the marketplace for published routines, gym sessions, or meal plans shared by the community.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"kind":  map[string]any{"type": "string", "enum": []string{"routine", "gym_session", "meal_plan", "any"}, "description": "Type of item to search for."},
				"query": map[string]any{"type": "string", "description": "Full-text search query"},
				"limit": map[string]any{"type": "integer", "description": "Max results (default 5, max 20)"},
			}, "required": []string{"kind", "query"}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name: "fork_marketplace_item", Description: "Fork a marketplace item, creating a personal copy under the user's account.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"item_id": map[string]any{"type": "string", "description": "The marketplace item ID to fork"},
				"version": map[string]any{"type": "integer", "description": "Optional specific version to fork."},
			}, "required": []string{"item_id"}},
		}},
	}
}

func onboardingTools() []llms.Tool {
	return []llms.Tool{
		{Type: "function", Function: &llms.FunctionDefinition{
			Name:        "update_life_profile",
			Description: "Save the user's basic life profile fields during onboarding (timezone, wake time, sleep time). Also used to advance the onboarding step.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"timezone":        map[string]any{"type": "string", "description": "IANA timezone, e.g. 'Europe/Berlin'."},
				"wake_time":       map[string]any{"type": "string", "description": "Typical wake time as HH:MM (24h)."},
				"sleep_time":      map[string]any{"type": "string", "description": "Typical bedtime as HH:MM (24h)."},
				"onboarding_step": map[string]any{"type": "string", "description": "Current onboarding step id to persist: one of 'welcome','basics','rhythm','meals','work','health','memories','done'."},
			}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name:        "complete_life_onboarding",
			Description: "Mark onboarding as complete. Call only after the user has confirmed they're done AND the key steps (basics, rhythm, health) have been covered.",
			Parameters:  map[string]any{"type": "object", "properties": map[string]any{}},
		}},
	}
}

func adminTools() []llms.Tool {
	return []llms.Tool{
		{Type: "function", Function: &llms.FunctionDefinition{
			Name:        "dismiss_actionables",
			Description: "Bulk-dismiss one or more pending actionables.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"actionable_ids": map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Specific actionable ids to dismiss."},
				"all_pending":    map[string]any{"type": "boolean", "description": "If true, dismiss all pending actionables."},
			}},
		}},
		{Type: "function", Function: &llms.FunctionDefinition{
			Name:        "draft_form",
			Description: "Fill out fields in a form the user currently has OPEN IN A CREATE/EDIT UI. STRICT RULE: only call this when the system prompt contains an '## Active form' section. If there is NO '## Active form' section, you MUST NOT call draft_form.",
			Parameters: map[string]any{"type": "object", "properties": map[string]any{
				"form":   map[string]any{"type": "string", "enum": []string{"routine", "meal_plan", "session"}, "description": "Which form is being drafted."},
				"values": map[string]any{"type": "object", "description": "Fields to set on the form."},
			}, "required": []string{"form", "values"}},
		}},
	}
}
