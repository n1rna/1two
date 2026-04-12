package life

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// Author is the nested author object returned in responses.
type Author struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Item is a marketplace listing row.
type Item struct {
	ID             string   `json:"id"`
	Slug           string   `json:"slug"`
	Kind           string   `json:"kind"`
	SourceID       string   `json:"source_id"`
	AuthorID       string   `json:"author_id"`
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Tags           []string `json:"tags"`
	CurrentVersion int      `json:"current_version"`
	ForkCount      int      `json:"fork_count"`
	ViewCount      int      `json:"view_count"`
	PublishedAt    string   `json:"published_at"`
	UpdatedAt      string   `json:"updated_at"`
	UnpublishedAt  *string  `json:"unpublished_at,omitempty"`
}

// ItemSummary is a lightweight row used in list responses (includes nested author).
type ItemSummary struct {
	ID             string   `json:"id"`
	Slug           string   `json:"slug"`
	Kind           string   `json:"kind"`
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Tags           []string `json:"tags"`
	Author         Author   `json:"author"`
	CurrentVersion int      `json:"current_version"`
	ForkCount      int      `json:"fork_count"`
	ViewCount      int      `json:"view_count"`
	PublishedAt    string   `json:"published_at"`
	UpdatedAt      string   `json:"updated_at"`
	UnpublishedAt  *string  `json:"unpublished_at,omitempty"`
}

// Version is a marketplace_versions row.
type Version struct {
	ID          string          `json:"id"`
	ItemID      string          `json:"item_id"`
	Version     int             `json:"version"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Content     json.RawMessage `json:"content"`
	Changelog   string          `json:"changelog"`
	CreatedAt   string          `json:"created_at"`
}

// ItemDetail combines ItemSummary + latest version content + version list.
type ItemDetail struct {
	ItemSummary
	Content  json.RawMessage `json:"content"`
	Versions []VersionMeta   `json:"versions,omitempty"`
}

// VersionMeta is a version row without the content blob (for dropdown lists).
type VersionMeta struct {
	ID        string `json:"id"`
	Version   int    `json:"version"`
	Title     string `json:"title"`
	Changelog string `json:"changelog"`
	CreatedAt string `json:"created_at"`
}

// MarketplaceFilter holds query parameters for listing marketplace items.
type MarketplaceFilter struct {
	Kind   string
	Query  string
	Limit  int
	Offset int
}

var nonAlnum = regexp.MustCompile(`[^a-z0-9]+`)

// slugify lowercases s, replaces non-alphanumeric runs with hyphens, trims
// leading/trailing hyphens, and appends a dash + 6 random hex chars.
func slugify(s string) string {
	base := strings.ToLower(s)
	base = nonAlnum.ReplaceAllString(base, "-")
	base = strings.Trim(base, "-")
	if base == "" {
		base = "item"
	}
	b := make([]byte, 3)
	rand.Read(b) //nolint:errcheck
	return base + "-" + hex.EncodeToString(b)
}

// snapshotContent reads the source row's content/config JSONB for the given kind.
// For gym_session it assembles a combined object with session metadata + exercises.
func snapshotContent(ctx context.Context, db *sql.DB, kind, sourceID, userID string) (json.RawMessage, error) {
	switch kind {
	case "routine":
		var name, rtype, description, schedule, config string
		var active bool
		err := db.QueryRowContext(ctx,
			`SELECT name, type, description, schedule::text, config::text, active
			 FROM life_routines WHERE id = $1 AND user_id = $2`,
			sourceID, userID,
		).Scan(&name, &rtype, &description, &schedule, &config, &active)
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("routine not found")
		}
		if err != nil {
			return nil, err
		}
		payload := map[string]any{
			"name":        name,
			"type":        rtype,
			"description": description,
			"schedule":    json.RawMessage(schedule),
			"config":      json.RawMessage(config),
			"active":      active,
		}
		b, err := json.Marshal(payload)
		return json.RawMessage(b), err

	case "gym_session":
		var title, description, status, difficulty string
		var muscleGroups []string
		var estimatedDuration sql.NullInt64
		err := db.QueryRowContext(ctx,
			`SELECT title, description, status, target_muscle_groups, estimated_duration, difficulty_level
			 FROM health_sessions WHERE id = $1 AND user_id = $2`,
			sourceID, userID,
		).Scan(&title, &description, &status, pq.Array(&muscleGroups), &estimatedDuration, &difficulty)
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("gym session not found")
		}
		if err != nil {
			return nil, err
		}

		type exercise struct {
			ID            string  `json:"id"`
			ExerciseName  string  `json:"exercise_name"`
			Sets          int     `json:"sets"`
			Reps          string  `json:"reps"`
			Weight        string  `json:"weight"`
			RestSeconds   int     `json:"rest_seconds"`
			SortOrder     int     `json:"sort_order"`
			Notes         string  `json:"notes"`
			SupersetGroup *string `json:"superset_group,omitempty"`
		}
		rows, err := db.QueryContext(ctx,
			`SELECT id, exercise_name, sets, reps, weight, rest_seconds, sort_order, notes, superset_group
			 FROM health_session_exercises WHERE session_id = $1 ORDER BY sort_order`,
			sourceID,
		)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var exercises []exercise
		for rows.Next() {
			var ex exercise
			if err := rows.Scan(&ex.ID, &ex.ExerciseName, &ex.Sets, &ex.Reps, &ex.Weight,
				&ex.RestSeconds, &ex.SortOrder, &ex.Notes, &ex.SupersetGroup); err != nil {
				return nil, err
			}
			exercises = append(exercises, ex)
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}

		dur := (*int)(nil)
		if estimatedDuration.Valid {
			v := int(estimatedDuration.Int64)
			dur = &v
		}
		payload := map[string]any{
			"title":                title,
			"description":          description,
			"status":               status,
			"target_muscle_groups": muscleGroups,
			"estimated_duration":   dur,
			"difficulty_level":     difficulty,
			"exercises":            exercises,
		}
		b, err := json.Marshal(payload)
		return json.RawMessage(b), err

	case "meal_plan":
		var title, planType, dietType, contentRaw string
		var targetCalories sql.NullInt64
		err := db.QueryRowContext(ctx,
			`SELECT title, plan_type, diet_type, target_calories, content::text
			 FROM health_meal_plans WHERE id = $1 AND user_id = $2`,
			sourceID, userID,
		).Scan(&title, &planType, &dietType, &targetCalories, &contentRaw)
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("meal plan not found")
		}
		if err != nil {
			return nil, err
		}
		var tc *int
		if targetCalories.Valid {
			v := int(targetCalories.Int64)
			tc = &v
		}
		payload := map[string]any{
			"title":           title,
			"plan_type":       planType,
			"diet_type":       dietType,
			"target_calories": tc,
			"content":         json.RawMessage(contentRaw),
		}
		b, err := json.Marshal(payload)
		return json.RawMessage(b), err

	default:
		return nil, fmt.Errorf("unknown kind: %s", kind)
	}
}

// PublishItem creates a new marketplace listing and a version-1 snapshot.
func PublishItem(ctx context.Context, db *sql.DB, userID, kind, sourceID, title, description string, tags []string, changelog string) (*Item, error) {
	content, err := snapshotContent(ctx, db, kind, sourceID, userID)
	if err != nil {
		return nil, err
	}

	itemID := "mp_" + uuid.NewString()
	versionID := "mpv_" + uuid.NewString()
	slug := slugify(title)

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var publishedAt, updatedAt time.Time
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO life_marketplace_items
		  (id, slug, kind, source_id, author_id, title, description, tags)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING published_at, updated_at`,
		itemID, slug, kind, sourceID, userID, title, description, pq.Array(tags),
	).Scan(&publishedAt, &updatedAt); err != nil {
		return nil, err
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO life_marketplace_versions (id, item_id, version, title, description, content, changelog)
		 VALUES ($1, $2, 1, $3, $4, $5, $6)`,
		versionID, itemID, title, description, string(content), changelog,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &Item{
		ID:             itemID,
		Slug:           slug,
		Kind:           kind,
		SourceID:       sourceID,
		AuthorID:       userID,
		Title:          title,
		Description:    description,
		Tags:           tags,
		CurrentVersion: 1,
		PublishedAt:    publishedAt.UTC().Format(time.RFC3339),
		UpdatedAt:      updatedAt.UTC().Format(time.RFC3339),
	}, nil
}

// RepublishItem snapshots the current source and creates a new version.
func RepublishItem(ctx context.Context, db *sql.DB, userID, itemID, changelog string) (*Version, error) {
	var kind, sourceID, authorID string
	var currentVersion int
	err := db.QueryRowContext(ctx,
		`SELECT kind, source_id, author_id, current_version FROM life_marketplace_items WHERE id = $1`,
		itemID,
	).Scan(&kind, &sourceID, &authorID, &currentVersion)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("item not found")
	}
	if err != nil {
		return nil, err
	}
	if authorID != userID {
		return nil, fmt.Errorf("item not found")
	}

	content, err := snapshotContent(ctx, db, kind, sourceID, userID)
	if err != nil {
		return nil, err
	}

	var title, description string
	db.QueryRowContext(ctx, `SELECT title, description FROM life_marketplace_items WHERE id = $1`, itemID).
		Scan(&title, &description)

	newVersion := currentVersion + 1
	versionID := "mpv_" + uuid.NewString()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var createdAt time.Time
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO life_marketplace_versions (id, item_id, version, title, description, content, changelog)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING created_at`,
		versionID, itemID, newVersion, title, description, string(content), changelog,
	).Scan(&createdAt); err != nil {
		return nil, err
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE life_marketplace_items SET current_version = $1, updated_at = NOW() WHERE id = $2`,
		newVersion, itemID,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &Version{
		ID:          versionID,
		ItemID:      itemID,
		Version:     newVersion,
		Title:       title,
		Description: description,
		Content:     content,
		Changelog:   changelog,
		CreatedAt:   createdAt.UTC().Format(time.RFC3339),
	}, nil
}

// UnpublishItem sets unpublished_at on the item, verifying authorship.
func UnpublishItem(ctx context.Context, db *sql.DB, userID, itemID string) error {
	res, err := db.ExecContext(ctx,
		`UPDATE life_marketplace_items SET unpublished_at = NOW(), updated_at = NOW()
		 WHERE id = $1 AND author_id = $2 AND unpublished_at IS NULL`,
		itemID, userID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("item not found")
	}
	return nil
}

// ListMarketplace returns published items, optionally filtered by kind and full-text query.
func ListMarketplace(ctx context.Context, db *sql.DB, f MarketplaceFilter) ([]ItemSummary, error) {
	if f.Limit <= 0 {
		f.Limit = 20
	}
	if f.Limit > 100 {
		f.Limit = 100
	}

	args := []any{}
	idx := 1
	where := []string{"m.unpublished_at IS NULL"}

	if f.Kind != "" && f.Kind != "any" {
		where = append(where, fmt.Sprintf("m.kind = $%d", idx))
		args = append(args, f.Kind)
		idx++
	}
	if f.Query != "" {
		where = append(where, fmt.Sprintf(
			"(m.title ILIKE '%%' || $%d || '%%' OR m.description ILIKE '%%' || $%[1]d || '%%')",
			idx,
		))
		args = append(args, f.Query)
		idx++
	}

	args = append(args, f.Limit, f.Offset)
	q := fmt.Sprintf(`
		SELECT m.id, m.slug, m.kind, m.title, m.description, m.tags,
		       m.author_id, COALESCE(u.name, ''), m.current_version,
		       m.fork_count, m.view_count, m.published_at, m.updated_at
		FROM life_marketplace_items m
		LEFT JOIN "user" u ON u.id = m.author_id
		WHERE %s
		ORDER BY m.published_at DESC
		LIMIT $%d OFFSET $%d`,
		strings.Join(where, " AND "), idx, idx+1,
	)

	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ItemSummary, 0)
	for rows.Next() {
		var it ItemSummary
		var publishedAt, updatedAt time.Time
		if err := rows.Scan(
			&it.ID, &it.Slug, &it.Kind, &it.Title, &it.Description,
			pq.Array(&it.Tags), &it.Author.ID, &it.Author.Name,
			&it.CurrentVersion, &it.ForkCount, &it.ViewCount,
			&publishedAt, &updatedAt,
		); err != nil {
			return nil, err
		}
		it.PublishedAt = publishedAt.UTC().Format(time.RFC3339)
		it.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		items = append(items, it)
	}
	return items, rows.Err()
}

// ListMine returns all marketplace items for the given user (including unpublished).
func ListMine(ctx context.Context, db *sql.DB, userID string) ([]ItemSummary, error) {
	const q = `
		SELECT m.id, m.slug, m.kind, m.title, m.description, m.tags,
		       m.author_id, COALESCE(u.name, ''), m.current_version,
		       m.fork_count, m.view_count, m.published_at, m.updated_at, m.unpublished_at
		FROM life_marketplace_items m
		LEFT JOIN "user" u ON u.id = m.author_id
		WHERE m.author_id = $1
		ORDER BY m.updated_at DESC`

	rows, err := db.QueryContext(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ItemSummary, 0)
	for rows.Next() {
		var it ItemSummary
		var publishedAt, updatedAt time.Time
		var unpublishedAt sql.NullTime
		if err := rows.Scan(
			&it.ID, &it.Slug, &it.Kind, &it.Title, &it.Description,
			pq.Array(&it.Tags), &it.Author.ID, &it.Author.Name,
			&it.CurrentVersion, &it.ForkCount, &it.ViewCount,
			&publishedAt, &updatedAt, &unpublishedAt,
		); err != nil {
			return nil, err
		}
		it.PublishedAt = publishedAt.UTC().Format(time.RFC3339)
		it.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if unpublishedAt.Valid {
			s := unpublishedAt.Time.UTC().Format(time.RFC3339)
			it.UnpublishedAt = &s
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

func scanItemDetail(ctx context.Context, db *sql.DB, q string, args ...any) (*ItemDetail, error) {
	var it ItemDetail
	var publishedAt, updatedAt time.Time
	var unpublishedAt sql.NullTime
	var rawContent string
	if err := db.QueryRowContext(ctx, q, args...).Scan(
		&it.ID, &it.Slug, &it.Kind, &it.Title, &it.Description,
		pq.Array(&it.Tags), &it.Author.ID, &it.Author.Name,
		&it.CurrentVersion, &it.ForkCount, &it.ViewCount,
		&publishedAt, &updatedAt, &unpublishedAt, &rawContent,
	); err != nil {
		return nil, err
	}
	it.PublishedAt = publishedAt.UTC().Format(time.RFC3339)
	it.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	if unpublishedAt.Valid {
		s := unpublishedAt.Time.UTC().Format(time.RFC3339)
		it.UnpublishedAt = &s
	}
	it.Content = json.RawMessage(rawContent)
	return &it, nil
}

const itemDetailSelect = `
	SELECT m.id, m.slug, m.kind, m.title, m.description, m.tags,
	       m.author_id, COALESCE(u.name, ''), m.current_version,
	       m.fork_count, m.view_count, m.published_at, m.updated_at, m.unpublished_at,
	       v.content
	FROM life_marketplace_items m
	LEFT JOIN "user" u ON u.id = m.author_id
	JOIN life_marketplace_versions v ON v.item_id = m.id AND v.version = m.current_version`

// GetItemBySlug loads a public item and increments view_count.
func GetItemBySlug(ctx context.Context, db *sql.DB, slug string) (*ItemDetail, error) {
	q := itemDetailSelect + ` WHERE m.slug = $1 AND m.unpublished_at IS NULL`
	it, err := scanItemDetail(ctx, db, q, slug)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("item not found")
	}
	if err != nil {
		return nil, err
	}
	db.ExecContext(ctx, `UPDATE life_marketplace_items SET view_count = view_count + 1 WHERE id = $1`, it.ID) //nolint:errcheck
	return it, nil
}

// GetItemByID loads an item by ID (for authed detail view) and increments view_count.
func GetItemByID(ctx context.Context, db *sql.DB, id string) (*ItemDetail, error) {
	q := itemDetailSelect + ` WHERE m.id = $1`
	it, err := scanItemDetail(ctx, db, q, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("item not found")
	}
	if err != nil {
		return nil, err
	}
	db.ExecContext(ctx, `UPDATE life_marketplace_items SET view_count = view_count + 1 WHERE id = $1`, it.ID) //nolint:errcheck
	return it, nil
}

// ListVersions returns version metadata for an item (without content blobs).
func ListVersions(ctx context.Context, db *sql.DB, itemID string) ([]VersionMeta, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, version, title, changelog, created_at
		 FROM life_marketplace_versions WHERE item_id = $1 ORDER BY version DESC`,
		itemID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	versions := make([]VersionMeta, 0)
	for rows.Next() {
		var v VersionMeta
		var createdAt time.Time
		if err := rows.Scan(&v.ID, &v.Version, &v.Title, &v.Changelog, &createdAt); err != nil {
			return nil, err
		}
		v.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		versions = append(versions, v)
	}
	return versions, rows.Err()
}

// ForkItem inserts a copy of the selected version's content into the appropriate
// source table under userID, increments fork_count, and returns the new source ID + kind.
func ForkItem(ctx context.Context, db *sql.DB, userID, itemID string, versionNum *int) (newSourceID string, kind string, err error) {
	// Load item metadata.
	var authorID string
	var currentVersion int
	err = db.QueryRowContext(ctx,
		`SELECT kind, author_id, current_version FROM life_marketplace_items WHERE id = $1 AND unpublished_at IS NULL`,
		itemID,
	).Scan(&kind, &authorID, &currentVersion)
	if err == sql.ErrNoRows {
		return "", "", fmt.Errorf("item not found")
	}
	if err != nil {
		return "", "", err
	}

	targetVersion := currentVersion
	if versionNum != nil {
		targetVersion = *versionNum
	}

	// Load version content.
	var rawContent, vTitle string
	err = db.QueryRowContext(ctx,
		`SELECT content, title FROM life_marketplace_versions WHERE item_id = $1 AND version = $2`,
		itemID, targetVersion,
	).Scan(&rawContent, &vTitle)
	if err == sql.ErrNoRows {
		return "", "", fmt.Errorf("version not found")
	}
	if err != nil {
		return "", "", err
	}

	newID := uuid.NewString()
	switch kind {
	case "routine":
		var wrapper struct {
			Name        string          `json:"name"`
			Type        string          `json:"type"`
			Description string          `json:"description"`
			Schedule    json.RawMessage `json:"schedule"`
			Config      json.RawMessage `json:"config"`
		}
		_ = json.Unmarshal([]byte(rawContent), &wrapper)
		name := wrapper.Name
		if name == "" {
			name = vTitle
		}
		rtype := wrapper.Type
		if rtype == "" {
			rtype = "custom"
		}
		schedule := string(wrapper.Schedule)
		if schedule == "" || schedule == "null" {
			schedule = "{}"
		}
		config := string(wrapper.Config)
		if config == "" || config == "null" {
			config = "{}"
		}
		_, err = db.ExecContext(ctx,
			`INSERT INTO life_routines (id, user_id, name, type, description, schedule, config, forked_from_mp_id, forked_from_version)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			newID, userID, name, rtype, wrapper.Description, schedule, config, itemID, targetVersion,
		)

	case "gym_session":
		type sessionContent struct {
			Title        string `json:"title"`
			Description  string `json:"description"`
			Status       string `json:"status"`
			Difficulty   string `json:"difficulty_level"`
			Duration     *int   `json:"estimated_duration"`
			MuscleGroups []string `json:"target_muscle_groups"`
			Exercises    []struct {
				ExerciseName  string  `json:"exercise_name"`
				Sets          int     `json:"sets"`
				Reps          string  `json:"reps"`
				Weight        string  `json:"weight"`
				RestSeconds   int     `json:"rest_seconds"`
				SortOrder     int     `json:"sort_order"`
				Notes         string  `json:"notes"`
				SupersetGroup *string `json:"superset_group"`
			} `json:"exercises"`
		}
		var sc sessionContent
		if jsonErr := json.Unmarshal([]byte(rawContent), &sc); jsonErr != nil {
			return "", "", fmt.Errorf("invalid session content: %w", jsonErr)
		}
		if sc.Status == "" {
			sc.Status = "draft"
		}
		if sc.Difficulty == "" {
			sc.Difficulty = "intermediate"
		}
		_, err = db.ExecContext(ctx,
			`INSERT INTO health_sessions
			  (id, user_id, title, description, status, target_muscle_groups, estimated_duration, difficulty_level, forked_from_mp_id, forked_from_version)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			newID, userID, sc.Title, sc.Description, sc.Status,
			pq.Array(sc.MuscleGroups), sc.Duration, sc.Difficulty,
			itemID, targetVersion,
		)
		if err != nil {
			return "", "", err
		}
		for i, ex := range sc.Exercises {
			exID := uuid.NewString()
			sets := ex.Sets
			if sets <= 0 {
				sets = 3
			}
			reps := ex.Reps
			if reps == "" {
				reps = "10"
			}
			rest := ex.RestSeconds
			if rest <= 0 {
				rest = 60
			}
			db.ExecContext(ctx, //nolint:errcheck
				`INSERT INTO health_session_exercises
				  (id, session_id, user_id, exercise_name, sets, reps, weight, rest_seconds, sort_order, notes, superset_group)
				 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
				exID, newID, userID, ex.ExerciseName, sets, reps, ex.Weight, rest, i, ex.Notes, ex.SupersetGroup,
			)
		}

	case "meal_plan":
		var wrapper struct {
			Title          string          `json:"title"`
			PlanType       string          `json:"plan_type"`
			DietType       string          `json:"diet_type"`
			TargetCalories *int            `json:"target_calories"`
			Content        json.RawMessage `json:"content"`
		}
		_ = json.Unmarshal([]byte(rawContent), &wrapper)
		title := wrapper.Title
		if title == "" {
			title = vTitle
		}
		planType := wrapper.PlanType
		if planType == "" {
			planType = "daily"
		}
		innerContent := string(wrapper.Content)
		// Fallback: if this version was stored before the richer snapshot, use the
		// whole blob as content.
		if innerContent == "" || innerContent == "null" {
			innerContent = rawContent
		}
		_, err = db.ExecContext(ctx,
			`INSERT INTO health_meal_plans (id, user_id, title, plan_type, diet_type, target_calories, content, forked_from_mp_id, forked_from_version)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			newID, userID, title, planType, wrapper.DietType, wrapper.TargetCalories, innerContent, itemID, targetVersion,
		)

	default:
		return "", "", fmt.Errorf("unknown kind: %s", kind)
	}

	if err != nil {
		return "", "", err
	}

	db.ExecContext(ctx, `UPDATE life_marketplace_items SET fork_count = fork_count + 1 WHERE id = $1`, itemID) //nolint:errcheck

	return newID, kind, nil
}
