package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/n1rna/1tt/api/internal/health"
	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/middleware"
)

// buildSessionChangeSummary produces a compact natural-language diff string
// for a gym session update, consumed by the journey agent. Only the fields
// actually present on the request are mentioned, so the summary reflects the
// user's intent rather than the full row. Returns empty when nothing notable
// changed (caller may still fire with "" and let the prompt fall back).
func buildSessionChangeSummary(
	title, description *string,
	active *bool,
	muscleGroups, equipment *[]string,
	estimatedDuration *int,
	difficultyLevel *string,
) string {
	var parts []string
	if title != nil {
		parts = append(parts, fmt.Sprintf("title → %q", *title))
	}
	if description != nil {
		parts = append(parts, "description updated")
	}
	if active != nil {
		if *active {
			parts = append(parts, "activated")
		} else {
			parts = append(parts, "deactivated")
		}
	}
	if muscleGroups != nil {
		parts = append(parts, fmt.Sprintf("muscle_groups → [%s]", strings.Join(*muscleGroups, ", ")))
	}
	if equipment != nil {
		parts = append(parts, fmt.Sprintf("equipment → [%s]", strings.Join(*equipment, ", ")))
	}
	if estimatedDuration != nil {
		parts = append(parts, fmt.Sprintf("estimated_duration → %d min", *estimatedDuration))
	}
	if difficultyLevel != nil {
		parts = append(parts, fmt.Sprintf("difficulty → %s", *difficultyLevel))
	}
	return strings.Join(parts, "; ")
}

// buildMealPlanChangeSummary summarises a meal plan update for the journey
// agent. We can't diff the `content` JSON safely from here (structure is
// domain-specific) so we report that it changed; the agent can load the plan
// to inspect specifics.
func buildMealPlanChangeSummary(
	title *string,
	planType, dietType *string,
	targetCalories *int,
	contentChanged bool,
	active *bool,
) string {
	var parts []string
	if title != nil {
		parts = append(parts, fmt.Sprintf("title → %q", *title))
	}
	if planType != nil {
		parts = append(parts, fmt.Sprintf("plan_type → %s", *planType))
	}
	if dietType != nil {
		parts = append(parts, fmt.Sprintf("diet_type → %s", *dietType))
	}
	if targetCalories != nil {
		parts = append(parts, fmt.Sprintf("target_calories → %d kcal", *targetCalories))
	}
	if contentChanged {
		parts = append(parts, "meals/content updated (grocery list may need refresh)")
	}
	if active != nil {
		if *active {
			parts = append(parts, "activated")
		} else {
			parts = append(parts, "deactivated")
		}
	}
	return strings.Join(parts, "; ")
}

// fireJourneyEventAsync kicks off a journey agent run in a detached goroutine
// so the caller's HTTP response is unaffected. A 2-minute timeout matches the
// outer SLA for cascading actionable creation; errors are logged.
func fireJourneyEventAsync(db *sql.DB, agent life.ChatAgent, ev life.JourneyEvent) {
	if agent == nil || ev.UserID == "" || ev.Trigger == "" {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		if err := life.ProcessJourneyEvent(ctx, db, agent, ev); err != nil {
			log.Printf("journey: %s for user %s: %v", ev.Trigger, ev.UserID, err)
		}
	}()
}

// Health is the API liveness check endpoint.
func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"service": "1tt-api",
	})
}

// ----- record types -----

type healthProfileRecord struct {
	UserID              string   `json:"userId"`
	WeightKg            *float64 `json:"weightKg"`
	HeightCm            *float64 `json:"heightCm"`
	Age                 *int     `json:"age"`
	Gender              *string  `json:"gender"`
	ActivityLevel       string   `json:"activityLevel"`
	DietType            string   `json:"dietType"`
	DietaryRestrictions []string `json:"dietaryRestrictions"`
	DietGoal            string   `json:"dietGoal"`
	GoalWeightKg        *float64 `json:"goalWeightKg"`
	BMI                 *float64 `json:"bmi"`
	BMR                 *float64 `json:"bmr"`
	TDEE                *float64 `json:"tdee"`
	TargetCalories      *int     `json:"targetCalories"`
	ProteinG            *int     `json:"proteinG"`
	CarbsG              *int     `json:"carbsG"`
	FatG                *int     `json:"fatG"`
	FitnessLevel        string   `json:"fitnessLevel"`
	FitnessGoal         string   `json:"fitnessGoal"`
	AvailableEquipment  []string `json:"availableEquipment"`
	PhysicalLimitations []string `json:"physicalLimitations"`
	WorkoutLikes        []string `json:"workoutLikes"`
	WorkoutDislikes     []string `json:"workoutDislikes"`
	PreferredDuration   int      `json:"preferredDurationMin"`
	DaysPerWeek         int      `json:"daysPerWeek"`
	Onboarded           bool     `json:"onboarded"`
	CreatedAt           string   `json:"createdAt"`
	UpdatedAt           string   `json:"updatedAt"`
}

type healthMemoryRecord struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	Category  string `json:"category"`
	Content   string `json:"content"`
	Active    bool   `json:"active"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type healthWeightRecord struct {
	ID         string  `json:"id"`
	UserID     string  `json:"userId"`
	WeightKg   float64 `json:"weightKg"`
	Note       string  `json:"note"`
	RecordedAt string  `json:"recordedAt"`
	CreatedAt  string  `json:"createdAt"`
}

type healthMealPlanRecord struct {
	ID             string          `json:"id"`
	UserID         string          `json:"userId"`
	Title          string          `json:"title"`
	PlanType       string          `json:"planType"`
	DietType       string          `json:"dietType"`
	TargetCalories *int            `json:"targetCalories"`
	Content        json.RawMessage `json:"content"`
	Active         bool            `json:"active"`
	CreatedAt      string          `json:"createdAt"`
	UpdatedAt      string          `json:"updatedAt"`
}

type healthSessionRecord struct {
	ID                 string                        `json:"id"`
	UserID             string                        `json:"userId"`
	Title              string                        `json:"title"`
	Description        string                        `json:"description"`
	Active             bool                          `json:"active"`
	TargetMuscleGroups []string                      `json:"targetMuscleGroups"`
	Equipment          []string                      `json:"equipment"`
	EstimatedDuration  *int                          `json:"estimatedDuration"`
	DifficultyLevel    string                        `json:"difficultyLevel"`
	ExerciseCount      int                           `json:"exerciseCount,omitempty"`
	Exercises          []healthSessionExerciseRecord `json:"exercises,omitempty"`
	CreatedAt          string                        `json:"createdAt"`
	UpdatedAt          string                        `json:"updatedAt"`
}

type healthSessionExerciseRecord struct {
	ID            string  `json:"id"`
	SessionID     string  `json:"sessionId"`
	UserID        string  `json:"userId"`
	ExerciseName  string  `json:"exerciseName"`
	Sets          int     `json:"sets"`
	Reps          string  `json:"reps"`
	Weight        string  `json:"weight"`
	RestSeconds   int     `json:"restSeconds"`
	SortOrder     int     `json:"sortOrder"`
	Notes         string  `json:"notes"`
	SupersetGroup *string `json:"supersetGroup"`
	CreatedAt     string  `json:"createdAt"`
}

// ----- profile -----

func GetHealthProfile(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO health_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, userID,
		); err != nil {
			log.Printf("health: upsert profile for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to initialise profile"}`, http.StatusInternalServerError)
			return
		}

		rec := scanHealthProfile(r.Context(), db, userID, w)
		if rec == nil {
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"profile": rec})
	}
}

func UpdateHealthProfile(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			WeightKg            *float64  `json:"weightKg"`
			HeightCm            *float64  `json:"heightCm"`
			Age                 *int      `json:"age"`
			Gender              *string   `json:"gender"`
			ActivityLevel       *string   `json:"activityLevel"`
			DietType            *string   `json:"dietType"`
			DietaryRestrictions *[]string `json:"dietaryRestrictions"`
			DietGoal            *string   `json:"dietGoal"`
			GoalWeightKg        *float64  `json:"goalWeightKg"`
			FitnessLevel        *string   `json:"fitnessLevel"`
			FitnessGoal         *string   `json:"fitnessGoal"`
			AvailableEquipment  *[]string `json:"availableEquipment"`
			PhysicalLimitations *[]string `json:"physicalLimitations"`
			WorkoutLikes        *[]string `json:"workoutLikes"`
			WorkoutDislikes     *[]string `json:"workoutDislikes"`
			PreferredDuration   *int      `json:"preferredDurationMin"`
			DaysPerWeek         *int      `json:"daysPerWeek"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		// Ensure row exists
		db.ExecContext(r.Context(),
			`INSERT INTO health_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, userID)

		// Build dynamic update
		sets := []string{"updated_at = NOW()"}
		vals := []any{}
		idx := 1
		add := func(col string, val any) {
			sets = append(sets, fmt.Sprintf("%s = $%d", col, idx))
			vals = append(vals, val)
			idx++
		}

		if req.WeightKg != nil {
			add("weight_kg", *req.WeightKg)
		}
		if req.HeightCm != nil {
			add("height_cm", *req.HeightCm)
		}
		if req.Age != nil {
			add("age", *req.Age)
		}
		if req.Gender != nil {
			add("gender", *req.Gender)
		}
		if req.ActivityLevel != nil {
			add("activity_level", *req.ActivityLevel)
		}
		if req.DietType != nil {
			add("diet_type", *req.DietType)
		}
		if req.DietGoal != nil {
			add("diet_goal", *req.DietGoal)
		}
		if req.GoalWeightKg != nil {
			add("goal_weight_kg", *req.GoalWeightKg)
		}
		if req.DietaryRestrictions != nil {
			add("dietary_restrictions", pq.Array(*req.DietaryRestrictions))
		}
		if req.FitnessLevel != nil {
			add("fitness_level", *req.FitnessLevel)
		}
		if req.FitnessGoal != nil {
			add("fitness_goal", *req.FitnessGoal)
		}
		if req.AvailableEquipment != nil {
			add("available_equipment", pq.Array(*req.AvailableEquipment))
		}
		if req.PhysicalLimitations != nil {
			add("physical_limitations", pq.Array(*req.PhysicalLimitations))
		}
		if req.WorkoutLikes != nil {
			add("workout_likes", pq.Array(*req.WorkoutLikes))
		}
		if req.WorkoutDislikes != nil {
			add("workout_dislikes", pq.Array(*req.WorkoutDislikes))
		}
		if req.PreferredDuration != nil {
			add("preferred_duration_min", *req.PreferredDuration)
		}
		if req.DaysPerWeek != nil {
			add("days_per_week", *req.DaysPerWeek)
		}

		vals = append(vals, userID)
		q := fmt.Sprintf(`UPDATE health_profiles SET %s WHERE user_id = $%d`, strings.Join(sets, ", "), idx)
		if _, err := db.ExecContext(r.Context(), q, vals...); err != nil {
			log.Printf("health: update profile for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to update profile"}`, http.StatusInternalServerError)
			return
		}

		// Recalculate derived fields
		recalculateHealthProfile(r.Context(), db, userID)

		rec := scanHealthProfile(r.Context(), db, userID, w)
		if rec == nil {
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"profile": rec})
	}
}

func MarkHealthOnboarded(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		if _, err := db.ExecContext(r.Context(),
			`UPDATE health_profiles SET onboarded = TRUE, updated_at = NOW() WHERE user_id = $1`, userID,
		); err != nil {
			http.Error(w, `{"error":"failed to mark onboarded"}`, http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// scanHealthProfile reads the full combined profile row for the given user.
func scanHealthProfile(ctx context.Context, db *sql.DB, userID string, w http.ResponseWriter) *healthProfileRecord {
	var rec healthProfileRecord
	var weightKg, heightCm, goalWeightKg, bmi, bmr, tdee sql.NullFloat64
	var age, targetCals, proteinG, carbsG, fatG sql.NullInt64
	var gender sql.NullString
	var restrictions, equipment, limitations, likes, dislikes []string
	var createdAt, updatedAt time.Time

	err := db.QueryRowContext(ctx, `
		SELECT user_id, weight_kg, height_cm, age, gender, activity_level, diet_type,
		       dietary_restrictions, diet_goal, goal_weight_kg, bmi, bmr, tdee, target_calories,
		       protein_g, carbs_g, fat_g, fitness_level, fitness_goal,
		       available_equipment, physical_limitations, workout_likes, workout_dislikes,
		       preferred_duration_min, days_per_week, onboarded, created_at, updated_at
		FROM health_profiles WHERE user_id = $1`, userID,
	).Scan(
		&rec.UserID, &weightKg, &heightCm, &age, &gender, &rec.ActivityLevel, &rec.DietType,
		pq.Array(&restrictions), &rec.DietGoal, &goalWeightKg, &bmi, &bmr, &tdee, &targetCals,
		&proteinG, &carbsG, &fatG, &rec.FitnessLevel, &rec.FitnessGoal,
		pq.Array(&equipment), pq.Array(&limitations), pq.Array(&likes), pq.Array(&dislikes),
		&rec.PreferredDuration, &rec.DaysPerWeek, &rec.Onboarded, &createdAt, &updatedAt,
	)
	if err != nil {
		log.Printf("health: scan profile for %s: %v", userID, err)
		http.Error(w, `{"error":"failed to get profile"}`, http.StatusInternalServerError)
		return nil
	}

	if weightKg.Valid {
		v := weightKg.Float64
		rec.WeightKg = &v
	}
	if heightCm.Valid {
		v := heightCm.Float64
		rec.HeightCm = &v
	}
	if age.Valid {
		v := int(age.Int64)
		rec.Age = &v
	}
	if gender.Valid {
		rec.Gender = &gender.String
	}
	if goalWeightKg.Valid {
		v := goalWeightKg.Float64
		rec.GoalWeightKg = &v
	}
	if bmi.Valid {
		v := bmi.Float64
		rec.BMI = &v
	}
	if bmr.Valid {
		v := bmr.Float64
		rec.BMR = &v
	}
	if tdee.Valid {
		v := tdee.Float64
		rec.TDEE = &v
	}
	if targetCals.Valid {
		v := int(targetCals.Int64)
		rec.TargetCalories = &v
	}
	if proteinG.Valid {
		v := int(proteinG.Int64)
		rec.ProteinG = &v
	}
	if carbsG.Valid {
		v := int(carbsG.Int64)
		rec.CarbsG = &v
	}
	if fatG.Valid {
		v := int(fatG.Int64)
		rec.FatG = &v
	}

	rec.DietaryRestrictions = restrictions
	if rec.DietaryRestrictions == nil {
		rec.DietaryRestrictions = []string{}
	}
	rec.AvailableEquipment = equipment
	if rec.AvailableEquipment == nil {
		rec.AvailableEquipment = []string{}
	}
	rec.PhysicalLimitations = limitations
	if rec.PhysicalLimitations == nil {
		rec.PhysicalLimitations = []string{}
	}
	rec.WorkoutLikes = likes
	if rec.WorkoutLikes == nil {
		rec.WorkoutLikes = []string{}
	}
	rec.WorkoutDislikes = dislikes
	if rec.WorkoutDislikes == nil {
		rec.WorkoutDislikes = []string{}
	}

	rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

	return &rec
}

// recalculateHealthProfile reads the base profile fields and updates derived BMI/BMR/TDEE/macro calculations.
func recalculateHealthProfile(ctx context.Context, db *sql.DB, userID string) {
	var weightKg, heightCm sql.NullFloat64
	var age sql.NullInt64
	var gender, activityLevel, dietType, dietGoal string
	err := db.QueryRowContext(ctx,
		`SELECT weight_kg, height_cm, age, gender, activity_level, diet_type, diet_goal
		 FROM health_profiles WHERE user_id = $1`, userID,
	).Scan(&weightKg, &heightCm, &age, &gender, &activityLevel, &dietType, &dietGoal)
	if err != nil || !weightKg.Valid || !heightCm.Valid || !age.Valid {
		return
	}

	calc := health.RecalculateProfile(weightKg.Float64, heightCm.Float64, int(age.Int64), gender, activityLevel, dietType, dietGoal)
	db.ExecContext(ctx,
		`UPDATE health_profiles SET bmi = $1, bmr = $2, tdee = $3, target_calories = $4,
		 protein_g = $5, carbs_g = $6, fat_g = $7, updated_at = NOW()
		 WHERE user_id = $8`,
		calc["bmi"], calc["bmr"], calc["tdee"], calc["target_calories"],
		calc["protein_g"], calc["carbs_g"], calc["fat_g"], userID,
	)
}

// ----- memories -----

func ListHealthMemories(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		rows, err := db.QueryContext(r.Context(),
			`SELECT id, user_id, category, content, active, created_at, updated_at
			 FROM health_memories WHERE user_id = $1 AND active = TRUE ORDER BY created_at DESC`, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list memories"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		memories := make([]healthMemoryRecord, 0)
		for rows.Next() {
			var m healthMemoryRecord
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&m.ID, &m.UserID, &m.Category, &m.Content, &m.Active, &createdAt, &updatedAt); err != nil {
				http.Error(w, `{"error":"failed to read memories"}`, http.StatusInternalServerError)
				return
			}
			m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			memories = append(memories, m)
		}

		json.NewEncoder(w).Encode(map[string]any{"memories": memories})
	}
}

func CreateHealthMemory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Content  string `json:"content"`
			Category string `json:"category"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.Content = strings.TrimSpace(req.Content)
		if req.Content == "" {
			http.Error(w, `{"error":"content is required"}`, http.StatusBadRequest)
			return
		}
		if req.Category == "" {
			req.Category = "preference"
		}

		id := uuid.NewString()
		var m healthMemoryRecord
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(),
			`INSERT INTO health_memories (id, user_id, category, content) VALUES ($1, $2, $3, $4)
			 RETURNING id, user_id, category, content, active, created_at, updated_at`,
			id, userID, req.Category, req.Content,
		).Scan(&m.ID, &m.UserID, &m.Category, &m.Content, &m.Active, &createdAt, &updatedAt); err != nil {
			log.Printf("health: create memory: %v", err)
			http.Error(w, `{"error":"failed to create memory"}`, http.StatusInternalServerError)
			return
		}
		m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"memory": m})
	}
}

func DeleteHealthMemory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		memoryID := chi.URLParam(r, "id")
		res, err := db.ExecContext(r.Context(),
			`UPDATE health_memories SET active = FALSE, updated_at = NOW() WHERE id = $1 AND user_id = $2`,
			memoryID, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to delete memory"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"memory not found"}`, http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// ----- weight -----

func ListHealthWeightEntries(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		rows, err := db.QueryContext(r.Context(),
			`SELECT id, user_id, weight_kg, note, recorded_at, created_at
			 FROM health_weight_entries WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 365`, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list weight entries"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		entries := make([]healthWeightRecord, 0)
		for rows.Next() {
			var e healthWeightRecord
			var recordedAt, createdAt time.Time
			if err := rows.Scan(&e.ID, &e.UserID, &e.WeightKg, &e.Note, &recordedAt, &createdAt); err != nil {
				http.Error(w, `{"error":"failed to read weight entries"}`, http.StatusInternalServerError)
				return
			}
			e.RecordedAt = recordedAt.Format("2006-01-02")
			e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			entries = append(entries, e)
		}

		json.NewEncoder(w).Encode(map[string]any{"entries": entries})
	}
}

func CreateHealthWeightEntry(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			WeightKg float64 `json:"weightKg"`
			Note     string  `json:"note"`
			Date     string  `json:"date"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		if req.WeightKg <= 0 {
			http.Error(w, `{"error":"weightKg must be positive"}`, http.StatusBadRequest)
			return
		}
		if req.Date == "" {
			req.Date = time.Now().Format("2006-01-02")
		}

		id := uuid.NewString()
		var e healthWeightRecord
		var recordedAt, createdAt time.Time
		err := db.QueryRowContext(r.Context(),
			`INSERT INTO health_weight_entries (id, user_id, weight_kg, note, recorded_at)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (user_id, recorded_at) DO UPDATE SET weight_kg = $3, note = $4
			 RETURNING id, user_id, weight_kg, note, recorded_at, created_at`,
			id, userID, req.WeightKg, req.Note, req.Date,
		).Scan(&e.ID, &e.UserID, &e.WeightKg, &e.Note, &recordedAt, &createdAt)
		if err != nil {
			log.Printf("health: create weight entry: %v", err)
			http.Error(w, `{"error":"failed to create weight entry"}`, http.StatusInternalServerError)
			return
		}
		e.RecordedAt = recordedAt.Format("2006-01-02")
		e.CreatedAt = createdAt.UTC().Format(time.RFC3339)

		// Update profile weight and recalculate
		db.ExecContext(r.Context(),
			`UPDATE health_profiles SET weight_kg = $1, updated_at = NOW() WHERE user_id = $2`,
			req.WeightKg, userID)
		recalculateHealthProfile(r.Context(), db, userID)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"entry": e})
	}
}

func DeleteHealthWeightEntry(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		entryID := chi.URLParam(r, "id")
		res, err := db.ExecContext(r.Context(),
			`DELETE FROM health_weight_entries WHERE id = $1 AND user_id = $2`, entryID, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to delete weight entry"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"entry not found"}`, http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// ----- meal plans -----

func ListHealthMealPlans(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		rows, err := db.QueryContext(r.Context(), `
			SELECT id, user_id, title, plan_type, diet_type, target_calories, content, active, created_at, updated_at
			FROM health_meal_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list meal plans"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		plans := make([]healthMealPlanRecord, 0)
		for rows.Next() {
			var p healthMealPlanRecord
			var targetCals sql.NullInt64
			var content string
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&p.ID, &p.UserID, &p.Title, &p.PlanType, &p.DietType, &targetCals, &content, &p.Active, &createdAt, &updatedAt); err != nil {
				http.Error(w, `{"error":"failed to read meal plans"}`, http.StatusInternalServerError)
				return
			}
			if targetCals.Valid {
				v := int(targetCals.Int64)
				p.TargetCalories = &v
			}
			p.Content = json.RawMessage(content)
			p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			plans = append(plans, p)
		}

		json.NewEncoder(w).Encode(map[string]any{"plans": plans})
	}
}

func GetHealthMealPlan(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		planID := chi.URLParam(r, "id")
		var p healthMealPlanRecord
		var targetCals sql.NullInt64
		var content string
		var createdAt, updatedAt time.Time
		err := db.QueryRowContext(r.Context(), `
			SELECT id, user_id, title, plan_type, diet_type, target_calories, content, active, created_at, updated_at
			FROM health_meal_plans WHERE id = $1 AND user_id = $2`, planID, userID,
		).Scan(&p.ID, &p.UserID, &p.Title, &p.PlanType, &p.DietType, &targetCals, &content, &p.Active, &createdAt, &updatedAt)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"meal plan not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("health: get meal plan %s: %v", planID, err)
			http.Error(w, `{"error":"failed to load meal plan"}`, http.StatusInternalServerError)
			return
		}
		if targetCals.Valid {
			v := int(targetCals.Int64)
			p.TargetCalories = &v
		}
		p.Content = json.RawMessage(content)
		p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		json.NewEncoder(w).Encode(map[string]any{"plan": p})
	}
}

// CreateHealthMealPlan creates an empty meal plan skeleton that the user can
// then populate (via the detail editor or Kim). Required body: { title }.
// Optional: planType, dietType, targetCalories.
func CreateHealthMealPlan(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var body struct {
			Title          string `json:"title"`
			PlanType       string `json:"planType"`
			DietType       string `json:"dietType"`
			TargetCalories *int   `json:"targetCalories"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
			return
		}
		title := strings.TrimSpace(body.Title)
		if title == "" {
			http.Error(w, `{"error":"title is required"}`, http.StatusBadRequest)
			return
		}
		planType := body.PlanType
		if planType == "" {
			planType = "daily"
		}

		id := uuid.NewString()
		emptyContent, _ := json.Marshal(map[string]any{"meals": []any{}})
		var tc any = nil
		if body.TargetCalories != nil {
			tc = *body.TargetCalories
		}
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO health_meal_plans (id,user_id,title,plan_type,diet_type,target_calories,content)
			 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			id, userID, title, planType, body.DietType, tc, string(emptyContent)); err != nil {
			log.Printf("health: create meal plan for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to create meal plan"}`, http.StatusInternalServerError)
			return
		}

		plan := healthMealPlanRecord{
			ID:       id,
			UserID:   userID,
			Title:    title,
			PlanType: planType,
			DietType: body.DietType,
			Active:   true,
			Content:  json.RawMessage(emptyContent),
		}
		if body.TargetCalories != nil {
			v := *body.TargetCalories
			plan.TargetCalories = &v
		}
		now := time.Now().UTC().Format(time.RFC3339)
		plan.CreatedAt = now
		plan.UpdatedAt = now

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"plan": plan})
	}
}

func UpdateHealthMealPlan(db *sql.DB, agent life.ChatAgent) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		planID := chi.URLParam(r, "id")

		var req struct {
			Title          *string          `json:"title"`
			PlanType       *string          `json:"planType"`
			DietType       *string          `json:"dietType"`
			TargetCalories *int             `json:"targetCalories"`
			Content        *json.RawMessage `json:"content"`
			Active         *bool            `json:"active"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		// Verify ownership first
		var ownerID string
		if err := db.QueryRowContext(r.Context(),
			`SELECT user_id FROM health_meal_plans WHERE id = $1`, planID,
		).Scan(&ownerID); err != nil {
			http.Error(w, `{"error":"meal plan not found"}`, http.StatusNotFound)
			return
		}
		if ownerID != userID {
			http.Error(w, `{"error":"meal plan not found"}`, http.StatusNotFound)
			return
		}

		sets := []string{"updated_at = NOW()"}
		vals := []any{}
		idx := 1
		add := func(col string, val any) {
			sets = append(sets, fmt.Sprintf("%s = $%d", col, idx))
			vals = append(vals, val)
			idx++
		}
		if req.Title != nil {
			add("title", *req.Title)
		}
		if req.PlanType != nil {
			add("plan_type", *req.PlanType)
		}
		if req.DietType != nil {
			add("diet_type", *req.DietType)
		}
		if req.TargetCalories != nil {
			add("target_calories", *req.TargetCalories)
		}
		if req.Content != nil {
			add("content", string(*req.Content))
		}
		if req.Active != nil {
			add("active", *req.Active)
		}

		vals = append(vals, planID)
		query := fmt.Sprintf(`UPDATE health_meal_plans SET %s WHERE id = $%d`, strings.Join(sets, ", "), idx)
		if _, err := db.ExecContext(r.Context(), query, vals...); err != nil {
			log.Printf("health: update meal plan %s: %v", planID, err)
			http.Error(w, `{"error":"failed to update meal plan"}`, http.StatusInternalServerError)
			return
		}

		// Return the updated record
		var p healthMealPlanRecord
		var targetCals sql.NullInt64
		var content string
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), `
			SELECT id, user_id, title, plan_type, diet_type, target_calories, content, active, created_at, updated_at
			FROM health_meal_plans WHERE id = $1`, planID,
		).Scan(&p.ID, &p.UserID, &p.Title, &p.PlanType, &p.DietType, &targetCals, &content, &p.Active, &createdAt, &updatedAt); err != nil {
			http.Error(w, `{"error":"failed to reload meal plan"}`, http.StatusInternalServerError)
			return
		}
		if targetCals.Valid {
			v := int(targetCals.Int64)
			p.TargetCalories = &v
		}
		p.Content = json.RawMessage(content)
		p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		// Journey cascade — meal plan change may require grocery/task updates.
		// Bulk edits from the frontend save once per plan (QBL-50), so this
		// fires exactly once per user-initiated save regardless of edit count.
		fireJourneyEventAsync(db, agent, life.JourneyEvent{
			UserID:      userID,
			Trigger:     life.JourneyTriggerMealPlanUpdated,
			EntityID:    p.ID,
			EntityTitle: p.Title,
			ChangeSummary: buildMealPlanChangeSummary(
				req.Title, req.PlanType, req.DietType, req.TargetCalories,
				req.Content != nil, req.Active,
			),
		})

		json.NewEncoder(w).Encode(map[string]any{"plan": p})
	}
}

func DeleteHealthMealPlan(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		planID := chi.URLParam(r, "id")
		res, err := db.ExecContext(r.Context(),
			`DELETE FROM health_meal_plans WHERE id = $1 AND user_id = $2`, planID, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to delete meal plan"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"meal plan not found"}`, http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// ----- sessions -----

// CreateHealthSession creates an empty workout session skeleton. Required: title.
// Optional: description, active (default true), targetMuscleGroups, estimatedDuration,
// difficultyLevel.
func CreateHealthSession(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var body struct {
			Title              string   `json:"title"`
			Description        string   `json:"description"`
			Active             *bool    `json:"active"`
			TargetMuscleGroups []string `json:"targetMuscleGroups"`
			Equipment          []string `json:"equipment"`
			EstimatedDuration  *int     `json:"estimatedDuration"`
			DifficultyLevel    string   `json:"difficultyLevel"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
			return
		}
		title := strings.TrimSpace(body.Title)
		if title == "" {
			http.Error(w, `{"error":"title is required"}`, http.StatusBadRequest)
			return
		}
		active := true
		if body.Active != nil {
			active = *body.Active
		}
		difficulty := body.DifficultyLevel
		if difficulty == "" {
			difficulty = "intermediate"
		}

		id := uuid.NewString()
		var duration any = nil
		if body.EstimatedDuration != nil {
			duration = *body.EstimatedDuration
		}
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO health_sessions (id,user_id,title,description,active,target_muscle_groups,equipment,estimated_duration,difficulty_level)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			id, userID, title, body.Description, active,
			health.StringSliceToPgArray(body.TargetMuscleGroups),
			health.StringSliceToPgArray(body.Equipment),
			duration, difficulty); err != nil {
			log.Printf("health: create session for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to create session"}`, http.StatusInternalServerError)
			return
		}

		now := time.Now().UTC().Format(time.RFC3339)
		rec := healthSessionRecord{
			ID:                 id,
			UserID:             userID,
			Title:              title,
			Description:        body.Description,
			Active:             active,
			TargetMuscleGroups: body.TargetMuscleGroups,
			Equipment:          body.Equipment,
			DifficultyLevel:    difficulty,
			ExerciseCount:      0,
			CreatedAt:          now,
			UpdatedAt:          now,
		}
		if body.EstimatedDuration != nil {
			v := *body.EstimatedDuration
			rec.EstimatedDuration = &v
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"session": rec})
	}
}

func ListHealthSessions(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		// Optional ?active=true|false filter.
		activeParam := r.URL.Query().Get("active")

		var rows *sql.Rows
		var err error
		if activeParam == "true" || activeParam == "false" {
			rows, err = db.QueryContext(r.Context(), `
				SELECT s.id, s.user_id, s.title, s.description, s.active,
				       s.target_muscle_groups, s.equipment, s.estimated_duration, s.difficulty_level,
				       s.created_at, s.updated_at,
				       COUNT(e.id) AS exercise_count
				FROM health_sessions s
				LEFT JOIN health_session_exercises e ON e.session_id = s.id
				WHERE s.user_id = $1 AND s.active = $2
				GROUP BY s.id
				ORDER BY s.updated_at DESC LIMIT 100`, userID, activeParam == "true")
		} else {
			rows, err = db.QueryContext(r.Context(), `
				SELECT s.id, s.user_id, s.title, s.description, s.active,
				       s.target_muscle_groups, s.equipment, s.estimated_duration, s.difficulty_level,
				       s.created_at, s.updated_at,
				       COUNT(e.id) AS exercise_count
				FROM health_sessions s
				LEFT JOIN health_session_exercises e ON e.session_id = s.id
				WHERE s.user_id = $1
				GROUP BY s.id
				ORDER BY s.updated_at DESC LIMIT 100`, userID)
		}
		if err != nil {
			http.Error(w, `{"error":"failed to list sessions"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		sessions := make([]healthSessionRecord, 0)
		for rows.Next() {
			var s healthSessionRecord
			var muscleGroups, equipment []string
			var estimatedDuration sql.NullInt64
			var createdAt, updatedAt time.Time
			if err := rows.Scan(
				&s.ID, &s.UserID, &s.Title, &s.Description, &s.Active,
				pq.Array(&muscleGroups), pq.Array(&equipment), &estimatedDuration, &s.DifficultyLevel,
				&createdAt, &updatedAt, &s.ExerciseCount,
			); err != nil {
				http.Error(w, `{"error":"failed to read sessions"}`, http.StatusInternalServerError)
				return
			}
			s.TargetMuscleGroups = muscleGroups
			if s.TargetMuscleGroups == nil {
				s.TargetMuscleGroups = []string{}
			}
			s.Equipment = equipment
			if s.Equipment == nil {
				s.Equipment = []string{}
			}
			if estimatedDuration.Valid {
				v := int(estimatedDuration.Int64)
				s.EstimatedDuration = &v
			}
			s.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			s.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			sessions = append(sessions, s)
		}

		json.NewEncoder(w).Encode(map[string]any{"sessions": sessions})
	}
}

func GetHealthSession(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		sessionID := chi.URLParam(r, "id")

		var s healthSessionRecord
		var muscleGroups, equipment []string
		var estimatedDuration sql.NullInt64
		var createdAt, updatedAt time.Time
		err := db.QueryRowContext(r.Context(), `
			SELECT id, user_id, title, description, active, target_muscle_groups, equipment,
			       estimated_duration, difficulty_level, created_at, updated_at
			FROM health_sessions WHERE id = $1`, sessionID,
		).Scan(
			&s.ID, &s.UserID, &s.Title, &s.Description, &s.Active,
			pq.Array(&muscleGroups), pq.Array(&equipment), &estimatedDuration, &s.DifficultyLevel,
			&createdAt, &updatedAt,
		)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("health: get session %s: %v", sessionID, err)
			http.Error(w, `{"error":"failed to get session"}`, http.StatusInternalServerError)
			return
		}
		if s.UserID != userID {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}

		s.TargetMuscleGroups = muscleGroups
		if s.TargetMuscleGroups == nil {
			s.TargetMuscleGroups = []string{}
		}
		s.Equipment = equipment
		if s.Equipment == nil {
			s.Equipment = []string{}
		}
		if estimatedDuration.Valid {
			v := int(estimatedDuration.Int64)
			s.EstimatedDuration = &v
		}
		s.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		s.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		// Load exercises
		exRows, err := db.QueryContext(r.Context(), `
			SELECT id, session_id, user_id, exercise_name, sets, reps, weight,
			       rest_seconds, sort_order, notes, superset_group, created_at
			FROM health_session_exercises WHERE session_id = $1 ORDER BY sort_order ASC`, sessionID)
		if err != nil {
			http.Error(w, `{"error":"failed to load exercises"}`, http.StatusInternalServerError)
			return
		}
		defer exRows.Close()

		exercises := make([]healthSessionExerciseRecord, 0)
		for exRows.Next() {
			ex, err := scanHealthSessionExercise(exRows)
			if err != nil {
				http.Error(w, `{"error":"failed to read exercises"}`, http.StatusInternalServerError)
				return
			}
			exercises = append(exercises, ex)
		}
		s.Exercises = exercises

		json.NewEncoder(w).Encode(map[string]any{"session": s})
	}
}

func UpdateHealthSession(db *sql.DB, agent life.ChatAgent) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		sessionID := chi.URLParam(r, "id")

		var req struct {
			Title              *string   `json:"title"`
			Description        *string   `json:"description"`
			Active             *bool     `json:"active"`
			TargetMuscleGroups *[]string `json:"targetMuscleGroups"`
			Equipment          *[]string `json:"equipment"`
			EstimatedDuration  *int      `json:"estimatedDuration"`
			DifficultyLevel    *string   `json:"difficultyLevel"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		// Verify ownership
		var ownerID string
		if err := db.QueryRowContext(r.Context(),
			`SELECT user_id FROM health_sessions WHERE id = $1`, sessionID,
		).Scan(&ownerID); err != nil {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}
		if ownerID != userID {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}

		sets := []string{"updated_at = NOW()"}
		vals := []any{}
		idx := 1
		add := func(col string, val any) {
			sets = append(sets, fmt.Sprintf("%s = $%d", col, idx))
			vals = append(vals, val)
			idx++
		}

		if req.Title != nil {
			add("title", *req.Title)
		}
		if req.Description != nil {
			add("description", *req.Description)
		}
		if req.Active != nil {
			add("active", *req.Active)
		}
		if req.TargetMuscleGroups != nil {
			add("target_muscle_groups", pq.Array(*req.TargetMuscleGroups))
		}
		if req.Equipment != nil {
			add("equipment", pq.Array(*req.Equipment))
		}
		if req.EstimatedDuration != nil {
			add("estimated_duration", *req.EstimatedDuration)
		}
		if req.DifficultyLevel != nil {
			add("difficulty_level", *req.DifficultyLevel)
		}

		vals = append(vals, sessionID)
		q := fmt.Sprintf(`UPDATE health_sessions SET %s WHERE id = $%d`, strings.Join(sets, ", "), idx)
		if _, err := db.ExecContext(r.Context(), q, vals...); err != nil {
			log.Printf("health: update session %s: %v", sessionID, err)
			http.Error(w, `{"error":"failed to update session"}`, http.StatusInternalServerError)
			return
		}

		// Re-fetch updated session
		var s healthSessionRecord
		var muscleGroups, equipment []string
		var estimatedDuration sql.NullInt64
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), `
			SELECT id, user_id, title, description, active, target_muscle_groups, equipment,
			       estimated_duration, difficulty_level, created_at, updated_at
			FROM health_sessions WHERE id = $1`, sessionID,
		).Scan(
			&s.ID, &s.UserID, &s.Title, &s.Description, &s.Active,
			pq.Array(&muscleGroups), pq.Array(&equipment), &estimatedDuration, &s.DifficultyLevel,
			&createdAt, &updatedAt,
		); err != nil {
			http.Error(w, `{"error":"failed to get updated session"}`, http.StatusInternalServerError)
			return
		}
		s.TargetMuscleGroups = muscleGroups
		if s.TargetMuscleGroups == nil {
			s.TargetMuscleGroups = []string{}
		}
		s.Equipment = equipment
		if s.Equipment == nil {
			s.Equipment = []string{}
		}
		if estimatedDuration.Valid {
			v := int(estimatedDuration.Int64)
			s.EstimatedDuration = &v
		}
		s.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		s.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		// Journey cascade — gym session change may ripple into calendar events
		// or recovery reminders. Fire async so the HTTP response is unblocked.
		fireJourneyEventAsync(db, agent, life.JourneyEvent{
			UserID:      userID,
			Trigger:     life.JourneyTriggerGymSessionUpdated,
			EntityID:    s.ID,
			EntityTitle: s.Title,
			ChangeSummary: buildSessionChangeSummary(
				req.Title, req.Description, req.Active,
				req.TargetMuscleGroups, req.Equipment, req.EstimatedDuration, req.DifficultyLevel,
			),
		})

		json.NewEncoder(w).Encode(map[string]any{"session": s})
	}
}

func DeleteHealthSession(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		sessionID := chi.URLParam(r, "id")
		res, err := db.ExecContext(r.Context(),
			`DELETE FROM health_sessions WHERE id = $1 AND user_id = $2`, sessionID, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to delete session"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// ----- session exercises -----

// scanHealthSessionExercise scans a single exercise row from a *sql.Rows cursor.
func scanHealthSessionExercise(rows *sql.Rows) (healthSessionExerciseRecord, error) {
	var ex healthSessionExerciseRecord
	var supersetGroup sql.NullString
	var createdAt time.Time
	if err := rows.Scan(
		&ex.ID, &ex.SessionID, &ex.UserID, &ex.ExerciseName,
		&ex.Sets, &ex.Reps, &ex.Weight, &ex.RestSeconds,
		&ex.SortOrder, &ex.Notes, &supersetGroup, &createdAt,
	); err != nil {
		return healthSessionExerciseRecord{}, err
	}
	if supersetGroup.Valid {
		ex.SupersetGroup = &supersetGroup.String
	}
	ex.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return ex, nil
}

func AddHealthSessionExercise(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		sessionID := chi.URLParam(r, "id")

		// Verify ownership
		var ownerID string
		if err := db.QueryRowContext(r.Context(),
			`SELECT user_id FROM health_sessions WHERE id = $1`, sessionID,
		).Scan(&ownerID); err != nil {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}
		if ownerID != userID {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}

		var req struct {
			ExerciseName  string  `json:"exerciseName"`
			Sets          int     `json:"sets"`
			Reps          string  `json:"reps"`
			Weight        string  `json:"weight"`
			RestSeconds   int     `json:"restSeconds"`
			Notes         string  `json:"notes"`
			SupersetGroup *string `json:"supersetGroup"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.ExerciseName = strings.TrimSpace(req.ExerciseName)
		if req.ExerciseName == "" {
			http.Error(w, `{"error":"exerciseName is required"}`, http.StatusBadRequest)
			return
		}

		// Determine next sort_order
		var maxOrder sql.NullInt64
		db.QueryRowContext(r.Context(),
			`SELECT MAX(sort_order) FROM health_session_exercises WHERE session_id = $1`, sessionID,
		).Scan(&maxOrder)
		sortOrder := 0
		if maxOrder.Valid {
			sortOrder = int(maxOrder.Int64) + 1
		}

		var supersetGroupArg any
		if req.SupersetGroup != nil {
			supersetGroupArg = *req.SupersetGroup
		}

		id := uuid.NewString()
		rows, err := db.QueryContext(r.Context(), `
			INSERT INTO health_session_exercises
			  (id, session_id, user_id, exercise_name, sets, reps, weight, rest_seconds, sort_order, notes, superset_group)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			RETURNING id, session_id, user_id, exercise_name, sets, reps, weight, rest_seconds, sort_order, notes, superset_group, created_at`,
			id, sessionID, userID, req.ExerciseName, req.Sets, req.Reps, req.Weight,
			req.RestSeconds, sortOrder, req.Notes, supersetGroupArg,
		)
		if err != nil {
			log.Printf("health: add session exercise: %v", err)
			http.Error(w, `{"error":"failed to add exercise"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		if !rows.Next() {
			http.Error(w, `{"error":"failed to read created exercise"}`, http.StatusInternalServerError)
			return
		}
		ex, err := scanHealthSessionExercise(rows)
		if err != nil {
			log.Printf("health: scan created exercise: %v", err)
			http.Error(w, `{"error":"failed to read created exercise"}`, http.StatusInternalServerError)
			return
		}

		// Touch session updated_at
		db.ExecContext(r.Context(), `UPDATE health_sessions SET updated_at = NOW() WHERE id = $1`, sessionID)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"exercise": ex})
	}
}

func UpdateHealthSessionExercise(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		sessionID := chi.URLParam(r, "sid")
		exerciseID := chi.URLParam(r, "eid")

		// Verify ownership via session
		var ownerID string
		if err := db.QueryRowContext(r.Context(),
			`SELECT user_id FROM health_sessions WHERE id = $1`, sessionID,
		).Scan(&ownerID); err != nil {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}
		if ownerID != userID {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}

		var req struct {
			ExerciseName  *string `json:"exerciseName"`
			Sets          *int    `json:"sets"`
			Reps          *string `json:"reps"`
			Weight        *string `json:"weight"`
			RestSeconds   *int    `json:"restSeconds"`
			Notes         *string `json:"notes"`
			SupersetGroup *string `json:"supersetGroup"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		sets := []string{}
		vals := []any{}
		idx := 1
		add := func(col string, val any) {
			sets = append(sets, fmt.Sprintf("%s = $%d", col, idx))
			vals = append(vals, val)
			idx++
		}

		if req.ExerciseName != nil {
			add("exercise_name", *req.ExerciseName)
		}
		if req.Sets != nil {
			add("sets", *req.Sets)
		}
		if req.Reps != nil {
			add("reps", *req.Reps)
		}
		if req.Weight != nil {
			add("weight", *req.Weight)
		}
		if req.RestSeconds != nil {
			add("rest_seconds", *req.RestSeconds)
		}
		if req.Notes != nil {
			add("notes", *req.Notes)
		}
		if req.SupersetGroup != nil {
			add("superset_group", *req.SupersetGroup)
		}

		if len(sets) == 0 {
			http.Error(w, `{"error":"no fields to update"}`, http.StatusBadRequest)
			return
		}

		vals = append(vals, exerciseID, sessionID)
		q := fmt.Sprintf(`UPDATE health_session_exercises SET %s WHERE id = $%d AND session_id = $%d`,
			strings.Join(sets, ", "), idx, idx+1)
		res, err := db.ExecContext(r.Context(), q, vals...)
		if err != nil {
			log.Printf("health: update exercise %s: %v", exerciseID, err)
			http.Error(w, `{"error":"failed to update exercise"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"exercise not found"}`, http.StatusNotFound)
			return
		}

		// Re-fetch the updated exercise
		exRows, err := db.QueryContext(r.Context(), `
			SELECT id, session_id, user_id, exercise_name, sets, reps, weight,
			       rest_seconds, sort_order, notes, superset_group, created_at
			FROM health_session_exercises WHERE id = $1`, exerciseID)
		if err != nil {
			http.Error(w, `{"error":"failed to get updated exercise"}`, http.StatusInternalServerError)
			return
		}
		defer exRows.Close()

		if !exRows.Next() {
			http.Error(w, `{"error":"exercise not found after update"}`, http.StatusInternalServerError)
			return
		}
		ex, err := scanHealthSessionExercise(exRows)
		if err != nil {
			http.Error(w, `{"error":"failed to read updated exercise"}`, http.StatusInternalServerError)
			return
		}

		db.ExecContext(r.Context(), `UPDATE health_sessions SET updated_at = NOW() WHERE id = $1`, sessionID)

		json.NewEncoder(w).Encode(map[string]any{"exercise": ex})
	}
}

func DeleteHealthSessionExercise(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		sessionID := chi.URLParam(r, "sid")
		exerciseID := chi.URLParam(r, "eid")

		// Verify ownership via session
		var ownerID string
		if err := db.QueryRowContext(r.Context(),
			`SELECT user_id FROM health_sessions WHERE id = $1`, sessionID,
		).Scan(&ownerID); err != nil {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}
		if ownerID != userID {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}

		res, err := db.ExecContext(r.Context(),
			`DELETE FROM health_session_exercises WHERE id = $1 AND session_id = $2`, exerciseID, sessionID)
		if err != nil {
			http.Error(w, `{"error":"failed to delete exercise"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"exercise not found"}`, http.StatusNotFound)
			return
		}

		db.ExecContext(r.Context(), `UPDATE health_sessions SET updated_at = NOW() WHERE id = $1`, sessionID)

		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

func ReorderHealthSessionExercises(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		sessionID := chi.URLParam(r, "id")

		// Verify ownership
		var ownerID string
		if err := db.QueryRowContext(r.Context(),
			`SELECT user_id FROM health_sessions WHERE id = $1`, sessionID,
		).Scan(&ownerID); err != nil {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}
		if ownerID != userID {
			http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
			return
		}

		var req struct {
			Order []string `json:"order"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		if len(req.Order) == 0 {
			http.Error(w, `{"error":"order is required"}`, http.StatusBadRequest)
			return
		}

		for i, exerciseID := range req.Order {
			if _, err := db.ExecContext(r.Context(),
				`UPDATE health_session_exercises SET sort_order = $1 WHERE id = $2 AND session_id = $3`,
				i, exerciseID, sessionID,
			); err != nil {
				log.Printf("health: reorder exercise %s: %v", exerciseID, err)
				http.Error(w, `{"error":"failed to reorder exercises"}`, http.StatusInternalServerError)
				return
			}
		}

		db.ExecContext(r.Context(), `UPDATE health_sessions SET updated_at = NOW() WHERE id = $1`, sessionID)

		json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// ----- calculations (stateless) -----

func GetHealthCalculations(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var req struct {
			WeightKg      float64 `json:"weightKg"`
			HeightCm      float64 `json:"heightCm"`
			Age           int     `json:"age"`
			Gender        string  `json:"gender"`
			ActivityLevel string  `json:"activityLevel"`
			DietType      string  `json:"dietType"`
			DietGoal      string  `json:"dietGoal"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		calc := health.RecalculateProfile(req.WeightKg, req.HeightCm, req.Age, req.Gender, req.ActivityLevel, req.DietType, req.DietGoal)
		bmi := calc["bmi"].(float64)
		calc["bmiCategory"] = health.BMICategory(bmi)

		json.NewEncoder(w).Encode(calc)
	}
}

// Chat and conversation functions removed — all chat now goes through the life agent.
