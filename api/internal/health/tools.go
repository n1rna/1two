package health

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tmc/langchaingo/llms"
)

func toolDefs() []llms.Tool {
	return []llms.Tool{
		// ── Diet tools ──
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "update_profile",
				Description: "Update user's health profile — body stats, diet, fitness level, equipment, limitations, preferences.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"weight_kg":              map[string]any{"type": "number"},
						"height_cm":              map[string]any{"type": "number"},
						"age":                    map[string]any{"type": "integer"},
						"gender":                 map[string]any{"type": "string", "enum": []string{"male", "female"}},
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
					},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "log_weight",
				Description: "Record a weight measurement. Also updates the profile's current weight.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"weight_kg": map[string]any{"type": "number"},
						"note":      map[string]any{"type": "string"},
						"date":      map[string]any{"type": "string", "description": "YYYY-MM-DD, defaults to today"},
					},
					"required": []string{"weight_kg"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "generate_meal_plan",
				Description: "Generate a structured meal plan based on the user's profile and preferences.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"plan_type": map[string]any{"type": "string", "enum": []string{"daily", "weekly"}},
						"title":     map[string]any{"type": "string"},
						"meals": map[string]any{
							"type": "array",
							"items": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"day":       map[string]any{"type": "string"},
									"meal_type": map[string]any{"type": "string", "enum": []string{"breakfast", "lunch", "dinner", "snack"}},
									"name":      map[string]any{"type": "string"},
									"calories":  map[string]any{"type": "integer"},
									"protein_g": map[string]any{"type": "integer"},
									"carbs_g":   map[string]any{"type": "integer"},
									"fat_g":     map[string]any{"type": "integer"},
								},
								"required": []string{"meal_type", "name", "calories"},
							},
						},
					},
					"required": []string{"plan_type", "title", "meals"},
				},
			},
		},
		// ── Workout tools ──
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "create_session",
				Description: "Create a new workout session with exercises.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"title":                map[string]any{"type": "string"},
						"description":          map[string]any{"type": "string"},
						"status":               map[string]any{"type": "string", "enum": []string{"draft", "active"}},
						"target_muscle_groups": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
						"estimated_duration":   map[string]any{"type": "integer"},
						"difficulty_level":     map[string]any{"type": "string", "enum": []string{"beginner", "intermediate", "advanced"}},
						"exercises": map[string]any{
							"type": "array",
							"items": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"exercise_name":  map[string]any{"type": "string"},
									"sets":           map[string]any{"type": "integer"},
									"reps":           map[string]any{"type": "string"},
									"weight":         map[string]any{"type": "string"},
									"rest_seconds":   map[string]any{"type": "integer"},
									"notes":          map[string]any{"type": "string"},
									"superset_group": map[string]any{"type": "string"},
								},
								"required": []string{"exercise_name"},
							},
						},
					},
					"required": []string{"title", "exercises"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "update_session",
				Description: "Update a workout session's metadata or status.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"session_id":           map[string]any{"type": "string"},
						"title":                map[string]any{"type": "string"},
						"description":          map[string]any{"type": "string"},
						"status":               map[string]any{"type": "string", "enum": []string{"draft", "active", "archived"}},
						"target_muscle_groups": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
						"estimated_duration":   map[string]any{"type": "integer"},
						"difficulty_level":     map[string]any{"type": "string", "enum": []string{"beginner", "intermediate", "advanced"}},
					},
					"required": []string{"session_id"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "add_exercise_to_session",
				Description: "Add exercises to an existing workout session.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"session_id": map[string]any{"type": "string"},
						"exercises": map[string]any{
							"type": "array",
							"items": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"exercise_name": map[string]any{"type": "string"}, "sets": map[string]any{"type": "integer"},
									"reps": map[string]any{"type": "string"}, "weight": map[string]any{"type": "string"},
									"rest_seconds": map[string]any{"type": "integer"}, "notes": map[string]any{"type": "string"},
									"superset_group": map[string]any{"type": "string"},
								},
								"required": []string{"exercise_name"},
							},
						},
					},
					"required": []string{"session_id", "exercises"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "remove_exercise_from_session",
				Description: "Remove an exercise from a session by ID.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"session_id":  map[string]any{"type": "string"},
						"exercise_id": map[string]any{"type": "string"},
					},
					"required": []string{"session_id", "exercise_id"},
				},
			},
		},
		// ── General tools ──
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "remember",
				Description: "Store a dietary preference, allergy, injury, fitness constraint, or other fact.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"content":  map[string]any{"type": "string"},
						"category": map[string]any{"type": "string", "enum": []string{"preference", "allergy", "injury", "fact", "instruction"}},
					},
					"required": []string{"content"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "forget",
				Description: "Remove an outdated memory by ID.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{"memory_id": map[string]any{"type": "string"}},
					"required":   []string{"memory_id"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "complete_onboarding",
				Description: "Mark the user's onboarding as complete. Call this ONLY after you have collected the user's basic profile info AND the user has confirmed they are ready to proceed.",
				Parameters: map[string]any{
					"type":       "object",
					"properties": map[string]any{},
				},
			},
		},
	}
}

func executeTool(ctx context.Context, db *sql.DB, userID string, call llms.ToolCall) string {
	switch call.FunctionCall.Name {
	case "update_profile":
		return toolUpdateProfile(ctx, db, userID, call.FunctionCall.Arguments)
	case "log_weight":
		return toolLogWeight(ctx, db, userID, call.FunctionCall.Arguments)
	case "generate_meal_plan":
		return toolGenerateMealPlan(ctx, db, userID, call.FunctionCall.Arguments)
	case "create_session":
		return toolCreateSession(ctx, db, userID, call.FunctionCall.Arguments)
	case "update_session":
		return toolUpdateSession(ctx, db, userID, call.FunctionCall.Arguments)
	case "add_exercise_to_session":
		return toolAddExercise(ctx, db, userID, call.FunctionCall.Arguments)
	case "remove_exercise_from_session":
		return toolRemoveExercise(ctx, db, userID, call.FunctionCall.Arguments)
	case "remember":
		return toolRemember(ctx, db, userID, call.FunctionCall.Arguments)
	case "forget":
		return toolForget(ctx, db, userID, call.FunctionCall.Arguments)
	case "complete_onboarding":
		return toolCompleteOnboarding(ctx, db, userID)
	default:
		return fmt.Sprintf(`{"error":"unknown tool: %s"}`, call.FunctionCall.Name)
	}
}

// ── Profile ──

func toolUpdateProfile(ctx context.Context, db *sql.DB, userID, args string) string {
	var params struct {
		WeightKg     *float64  `json:"weight_kg"`
		HeightCm     *float64  `json:"height_cm"`
		Age          *int      `json:"age"`
		Gender       *string   `json:"gender"`
		ActivityLevel *string  `json:"activity_level"`
		DietType     *string   `json:"diet_type"`
		DietGoal     *string   `json:"diet_goal"`
		GoalWeightKg *float64  `json:"goal_weight_kg"`
		Restrictions *[]string `json:"dietary_restrictions"`
		FitnessLevel *string   `json:"fitness_level"`
		FitnessGoal  *string   `json:"fitness_goal"`
		Equipment    *[]string `json:"available_equipment"`
		Limitations  *[]string `json:"physical_limitations"`
		Likes        *[]string `json:"workout_likes"`
		Dislikes     *[]string `json:"workout_dislikes"`
		Duration     *int      `json:"preferred_duration_min"`
		DaysPerWeek  *int      `json:"days_per_week"`
	}
	if err := json.Unmarshal([]byte(args), &params); err != nil {
		return `{"error":"invalid parameters"}`
	}

	sets := []string{"updated_at = NOW()"}
	vals := []any{}
	idx := 1
	add := func(col string, val any) {
		sets = append(sets, fmt.Sprintf("%s = $%d", col, idx))
		vals = append(vals, val)
		idx++
	}

	if params.WeightKg != nil { add("weight_kg", *params.WeightKg) }
	if params.HeightCm != nil { add("height_cm", *params.HeightCm) }
	if params.Age != nil { add("age", *params.Age) }
	if params.Gender != nil { add("gender", *params.Gender) }
	if params.ActivityLevel != nil { add("activity_level", *params.ActivityLevel) }
	if params.DietType != nil { add("diet_type", *params.DietType) }
	if params.DietGoal != nil { add("diet_goal", *params.DietGoal) }
	if params.GoalWeightKg != nil { add("goal_weight_kg", *params.GoalWeightKg) }
	if params.Restrictions != nil { add("dietary_restrictions", StringSliceToPgArray(*params.Restrictions)) }
	if params.FitnessLevel != nil { add("fitness_level", *params.FitnessLevel) }
	if params.FitnessGoal != nil { add("fitness_goal", *params.FitnessGoal) }
	if params.Equipment != nil { add("available_equipment", StringSliceToPgArray(*params.Equipment)) }
	if params.Limitations != nil { add("physical_limitations", StringSliceToPgArray(*params.Limitations)) }
	if params.Likes != nil { add("workout_likes", StringSliceToPgArray(*params.Likes)) }
	if params.Dislikes != nil { add("workout_dislikes", StringSliceToPgArray(*params.Dislikes)) }
	if params.Duration != nil { add("preferred_duration_min", *params.Duration) }
	if params.DaysPerWeek != nil { add("days_per_week", *params.DaysPerWeek) }

	vals = append(vals, userID)
	q := fmt.Sprintf(`UPDATE health_profiles SET %s WHERE user_id = $%d`, strings.Join(sets, ", "), idx)
	if _, err := db.ExecContext(ctx, q, vals...); err != nil {
		log.Printf("health: update profile for %s: %v", userID, err)
		return `{"error":"failed to update profile"}`
	}

	// Recalculate diet stats if enough data
	var weightKg, heightCm sql.NullFloat64
	var age sql.NullInt64
	var gender, activityLevel, dietType, dietGoal string
	err := db.QueryRowContext(ctx,
		`SELECT weight_kg, height_cm, age, gender, activity_level, diet_type, diet_goal FROM health_profiles WHERE user_id = $1`, userID,
	).Scan(&weightKg, &heightCm, &age, &gender, &activityLevel, &dietType, &dietGoal)
	if err == nil && weightKg.Valid && heightCm.Valid && age.Valid {
		calc := RecalculateProfile(weightKg.Float64, heightCm.Float64, int(age.Int64), gender, activityLevel, dietType, dietGoal)
		db.ExecContext(ctx,
			`UPDATE health_profiles SET bmi=$1, bmr=$2, tdee=$3, target_calories=$4, protein_g=$5, carbs_g=$6, fat_g=$7, updated_at=NOW() WHERE user_id=$8`,
			calc["bmi"], calc["bmr"], calc["tdee"], calc["target_calories"], calc["protein_g"], calc["carbs_g"], calc["fat_g"], userID)
		return fmt.Sprintf(`{"success":true,"bmi":%.1f,"bmr":%.0f,"tdee":%.0f,"target_calories":%d,"protein_g":%d,"carbs_g":%d,"fat_g":%d}`,
			calc["bmi"], calc["bmr"], calc["tdee"], calc["target_calories"], calc["protein_g"], calc["carbs_g"], calc["fat_g"])
	}

	return `{"success":true}`
}

// ── Weight ──

func toolLogWeight(ctx context.Context, db *sql.DB, userID, args string) string {
	var params struct {
		WeightKg float64 `json:"weight_kg"`
		Note     string  `json:"note"`
		Date     string  `json:"date"`
	}
	if err := json.Unmarshal([]byte(args), &params); err != nil { return `{"error":"invalid parameters"}` }
	if params.WeightKg <= 0 { return `{"error":"weight_kg must be positive"}` }
	if params.Date == "" { params.Date = time.Now().Format("2006-01-02") }

	id := uuid.NewString()
	db.ExecContext(ctx,
		`INSERT INTO health_weight_entries (id,user_id,weight_kg,note,recorded_at) VALUES ($1,$2,$3,$4,$5)
		 ON CONFLICT (user_id,recorded_at) DO UPDATE SET weight_kg=$3, note=$4`,
		id, userID, params.WeightKg, params.Note, params.Date)

	db.ExecContext(ctx, `UPDATE health_profiles SET weight_kg=$1, updated_at=NOW() WHERE user_id=$2`, params.WeightKg, userID)

	// Recalculate
	var heightCm sql.NullFloat64
	var age sql.NullInt64
	var gender, activityLevel, dietType, dietGoal string
	if db.QueryRowContext(ctx,
		`SELECT height_cm,age,gender,activity_level,diet_type,diet_goal FROM health_profiles WHERE user_id=$1`, userID,
	).Scan(&heightCm, &age, &gender, &activityLevel, &dietType, &dietGoal) == nil && heightCm.Valid && age.Valid {
		calc := RecalculateProfile(params.WeightKg, heightCm.Float64, int(age.Int64), gender, activityLevel, dietType, dietGoal)
		db.ExecContext(ctx,
			`UPDATE health_profiles SET bmi=$1,bmr=$2,tdee=$3,target_calories=$4,protein_g=$5,carbs_g=$6,fat_g=$7,updated_at=NOW() WHERE user_id=$8`,
			calc["bmi"], calc["bmr"], calc["tdee"], calc["target_calories"], calc["protein_g"], calc["carbs_g"], calc["fat_g"], userID)
	}

	return fmt.Sprintf(`{"success":true,"weight_kg":%.1f,"date":"%s"}`, params.WeightKg, params.Date)
}

// ── Meal plan ──

func toolGenerateMealPlan(ctx context.Context, db *sql.DB, userID, args string) string {
	var params struct {
		PlanType string          `json:"plan_type"`
		Title    string          `json:"title"`
		Meals    json.RawMessage `json:"meals"`
	}
	if err := json.Unmarshal([]byte(args), &params); err != nil { return `{"error":"invalid parameters"}` }

	var dietType string
	var targetCals sql.NullInt64
	db.QueryRowContext(ctx, `SELECT diet_type, target_calories FROM health_profiles WHERE user_id=$1`, userID).Scan(&dietType, &targetCals)

	id := uuid.NewString()
	content, _ := json.Marshal(map[string]any{"meals": json.RawMessage(params.Meals)})
	var tc *int
	if targetCals.Valid { v := int(targetCals.Int64); tc = &v }

	if _, err := db.ExecContext(ctx,
		`INSERT INTO health_meal_plans (id,user_id,title,plan_type,diet_type,target_calories,content) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		id, userID, params.Title, params.PlanType, dietType, tc, content); err != nil {
		log.Printf("health: save meal plan for %s: %v", userID, err)
		return `{"error":"failed to save meal plan"}`
	}
	return fmt.Sprintf(`{"success":true,"id":"%s","title":"%s"}`, id, params.Title)
}

// ── Sessions ──

type exerciseInput struct {
	ExerciseName  string `json:"exercise_name"`
	Sets          int    `json:"sets"`
	Reps          string `json:"reps"`
	Weight        string `json:"weight"`
	RestSeconds   int    `json:"rest_seconds"`
	Notes         string `json:"notes"`
	SupersetGroup string `json:"superset_group"`
}

func insertExercises(ctx context.Context, db *sql.DB, sessionID, userID string, exercises []exerciseInput, startOrder int) int {
	count := 0
	for i, ex := range exercises {
		id := uuid.NewString()
		sets := ex.Sets; if sets <= 0 { sets = 3 }
		reps := ex.Reps; if reps == "" { reps = "10" }
		rest := ex.RestSeconds; if rest <= 0 { rest = 60 }
		var sg *string
		if ex.SupersetGroup != "" { sg = &ex.SupersetGroup }
		if _, err := db.ExecContext(ctx,
			`INSERT INTO health_session_exercises (id,session_id,user_id,exercise_name,sets,reps,weight,rest_seconds,sort_order,notes,superset_group)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			id, sessionID, userID, ex.ExerciseName, sets, reps, ex.Weight, rest, startOrder+i, ex.Notes, sg); err == nil {
			count++
		}
	}
	return count
}

func toolCreateSession(ctx context.Context, db *sql.DB, userID, args string) string {
	var params struct {
		Title        string          `json:"title"`
		Description  string          `json:"description"`
		Status       string          `json:"status"`
		MuscleGroups []string        `json:"target_muscle_groups"`
		Duration     int             `json:"estimated_duration"`
		Difficulty   string          `json:"difficulty_level"`
		Exercises    []exerciseInput `json:"exercises"`
	}
	if err := json.Unmarshal([]byte(args), &params); err != nil { return `{"error":"invalid parameters"}` }
	if params.Title == "" { return `{"error":"title is required"}` }
	if params.Status == "" { params.Status = "draft" }
	if params.Difficulty == "" { params.Difficulty = "intermediate" }

	id := uuid.NewString()
	if _, err := db.ExecContext(ctx,
		`INSERT INTO health_sessions (id,user_id,title,description,status,target_muscle_groups,estimated_duration,difficulty_level)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		id, userID, params.Title, params.Description, params.Status, StringSliceToPgArray(params.MuscleGroups), params.Duration, params.Difficulty); err != nil {
		log.Printf("health: create session: %v", err)
		return `{"error":"failed to create session"}`
	}

	count := insertExercises(ctx, db, id, userID, params.Exercises, 0)
	return fmt.Sprintf(`{"success":true,"id":"%s","title":"%s","status":"%s","exercise_count":%d}`, id, params.Title, params.Status, count)
}

func toolUpdateSession(ctx context.Context, db *sql.DB, userID, args string) string {
	var params struct {
		SessionID    string   `json:"session_id"`
		Title        *string  `json:"title"`
		Description  *string  `json:"description"`
		Status       *string  `json:"status"`
		MuscleGroups []string `json:"target_muscle_groups"`
		Duration     *int     `json:"estimated_duration"`
		Difficulty   *string  `json:"difficulty_level"`
	}
	if err := json.Unmarshal([]byte(args), &params); err != nil { return `{"error":"invalid parameters"}` }
	if params.SessionID == "" { return `{"error":"session_id is required"}` }

	sets := []string{"updated_at = NOW()"}
	vals := []any{}
	idx := 1
	add := func(col string, val any) { sets = append(sets, fmt.Sprintf("%s = $%d", col, idx)); vals = append(vals, val); idx++ }

	if params.Title != nil { add("title", *params.Title) }
	if params.Description != nil { add("description", *params.Description) }
	if params.Status != nil { add("status", *params.Status) }
	if params.MuscleGroups != nil { add("target_muscle_groups", StringSliceToPgArray(params.MuscleGroups)) }
	if params.Duration != nil { add("estimated_duration", *params.Duration) }
	if params.Difficulty != nil { add("difficulty_level", *params.Difficulty) }

	vals = append(vals, params.SessionID, userID)
	q := fmt.Sprintf(`UPDATE health_sessions SET %s WHERE id=$%d AND user_id=$%d`, strings.Join(sets, ", "), idx, idx+1)
	res, _ := db.ExecContext(ctx, q, vals...)
	if n, _ := res.RowsAffected(); n == 0 { return `{"error":"session not found"}` }
	return `{"success":true}`
}

func toolAddExercise(ctx context.Context, db *sql.DB, userID, args string) string {
	var params struct {
		SessionID string          `json:"session_id"`
		Exercises []exerciseInput `json:"exercises"`
	}
	if err := json.Unmarshal([]byte(args), &params); err != nil { return `{"error":"invalid parameters"}` }

	var owner string
	if db.QueryRowContext(ctx, `SELECT user_id FROM health_sessions WHERE id=$1`, params.SessionID).Scan(&owner) != nil || owner != userID {
		return `{"error":"session not found"}`
	}

	var maxOrder int
	db.QueryRowContext(ctx, `SELECT COALESCE(MAX(sort_order),-1) FROM health_session_exercises WHERE session_id=$1`, params.SessionID).Scan(&maxOrder)
	count := insertExercises(ctx, db, params.SessionID, userID, params.Exercises, maxOrder+1)
	return fmt.Sprintf(`{"success":true,"added":%d}`, count)
}

func toolRemoveExercise(ctx context.Context, db *sql.DB, userID, args string) string {
	var params struct {
		SessionID  string `json:"session_id"`
		ExerciseID string `json:"exercise_id"`
	}
	if err := json.Unmarshal([]byte(args), &params); err != nil { return `{"error":"invalid parameters"}` }
	res, _ := db.ExecContext(ctx, `DELETE FROM health_session_exercises WHERE id=$1 AND session_id=$2 AND user_id=$3`, params.ExerciseID, params.SessionID, userID)
	if n, _ := res.RowsAffected(); n == 0 { return `{"error":"exercise not found"}` }
	return `{"success":true}`
}

// ── Memory ──

func toolRemember(ctx context.Context, db *sql.DB, userID, args string) string {
	var params struct {
		Content  string `json:"content"`
		Category string `json:"category"`
	}
	if err := json.Unmarshal([]byte(args), &params); err != nil { return `{"error":"invalid parameters"}` }
	if params.Content == "" { return `{"error":"content is required"}` }
	if params.Category == "" { params.Category = "preference" }

	id := uuid.NewString()
	if _, err := db.ExecContext(ctx, `INSERT INTO health_memories (id,user_id,category,content) VALUES ($1,$2,$3,$4)`,
		id, userID, params.Category, params.Content); err != nil {
		return `{"error":"failed to save memory"}`
	}
	return fmt.Sprintf(`{"success":true,"id":"%s","category":"%s"}`, id, params.Category)
}

func toolForget(ctx context.Context, db *sql.DB, userID, args string) string {
	var params struct { MemoryID string `json:"memory_id"` }
	if err := json.Unmarshal([]byte(args), &params); err != nil { return `{"error":"invalid parameters"}` }
	res, _ := db.ExecContext(ctx, `UPDATE health_memories SET active=FALSE, updated_at=NOW() WHERE id=$1 AND user_id=$2`, params.MemoryID, userID)
	if n, _ := res.RowsAffected(); n == 0 { return `{"error":"memory not found"}` }
	return `{"success":true}`
}

// ── Onboarding ──

func toolCompleteOnboarding(ctx context.Context, db *sql.DB, userID string) string {
	_, err := db.ExecContext(ctx,
		`UPDATE health_profiles SET onboarded = TRUE, updated_at = NOW() WHERE user_id = $1`, userID)
	if err != nil {
		log.Printf("health: complete onboarding for %s: %v", userID, err)
		return `{"error":"failed to complete onboarding"}`
	}
	return `{"success":true,"onboarded":true}`
}
