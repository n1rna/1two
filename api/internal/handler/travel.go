package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/lib/pq"

	"github.com/n1rna/1tt/api/internal/config"
	"github.com/n1rna/1tt/api/internal/middleware"
	"github.com/n1rna/1tt/api/internal/storage"
)

// ============================================================================
// Record types
// ============================================================================

type travelTripRecord struct {
	ID             string  `json:"id"`
	OwnerUserID    string  `json:"ownerUserId"`
	Title          string  `json:"title"`
	Summary        string  `json:"summary"`
	StartDate      *string `json:"startDate"`
	EndDate        *string `json:"endDate"`
	CoverImageURL  string  `json:"coverImageUrl"`
	Status         string  `json:"status"`
	BudgetCurrency string  `json:"budgetCurrency"`
	Role           string  `json:"role"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
}

type travelDestinationRecord struct {
	ID            string   `json:"id"`
	TripID        string   `json:"tripId"`
	Ordinal       int      `json:"ordinal"`
	Name          string   `json:"name"`
	MapboxPlaceID string   `json:"mapboxPlaceId"`
	Country       string   `json:"country"`
	Region        string   `json:"region"`
	Lat           *float64 `json:"lat"`
	Lng           *float64 `json:"lng"`
	ArriveAt      *string  `json:"arriveAt"`
	DepartAt      *string  `json:"departAt"`
	Notes         string   `json:"notes"`
	CreatedAt     string   `json:"createdAt"`
	UpdatedAt     string   `json:"updatedAt"`
}

type travelActivityRecord struct {
	ID            string   `json:"id"`
	TripID        string   `json:"tripId"`
	DestinationID string   `json:"destinationId"`
	Title         string   `json:"title"`
	Category      string   `json:"category"`
	StartAt       *string  `json:"startAt"`
	EndAt         *string  `json:"endAt"`
	Lat           *float64 `json:"lat"`
	Lng           *float64 `json:"lng"`
	Address       string   `json:"address"`
	CostAmount    *float64 `json:"costAmount"`
	CostCurrency  string   `json:"costCurrency"`
	BookingURL    string   `json:"bookingUrl"`
	Notes         string   `json:"notes"`
	CreatedAt     string   `json:"createdAt"`
	UpdatedAt     string   `json:"updatedAt"`
}

type travelReservationRecord struct {
	ID               string          `json:"id"`
	TripID           string          `json:"tripId"`
	DestinationID    *string         `json:"destinationId"`
	Kind             string          `json:"kind"`
	Title            string          `json:"title"`
	Provider         string          `json:"provider"`
	ConfirmationCode string          `json:"confirmationCode"`
	StartAt          *string         `json:"startAt"`
	EndAt            *string         `json:"endAt"`
	OriginPlace      string          `json:"originPlace"`
	DestPlace        string          `json:"destPlace"`
	CostAmount       *float64        `json:"costAmount"`
	CostCurrency     string          `json:"costCurrency"`
	Status           string          `json:"status"`
	Payload          json.RawMessage `json:"payload"`
	CreatedAt        string          `json:"createdAt"`
	UpdatedAt        string          `json:"updatedAt"`
}

type travelTicketRecord struct {
	ID            string  `json:"id"`
	TripID        string  `json:"tripId"`
	ReservationID *string `json:"reservationId"`
	Title         string  `json:"title"`
	Kind          string  `json:"kind"`
	FileURL       string  `json:"fileUrl"`
	IssuedTo      string  `json:"issuedTo"`
	ValidFrom     *string `json:"validFrom"`
	ValidUntil    *string `json:"validUntil"`
	CreatedAt     string  `json:"createdAt"`
}

type travelPreferencesRecord struct {
	UserID        string   `json:"userId"`
	Pace          string   `json:"pace"`
	BudgetTier    string   `json:"budgetTier"`
	Dietary       []string `json:"dietary"`
	Accessibility []string `json:"accessibility"`
	Interests     []string `json:"interests"`
	Avoid         []string `json:"avoid"`
	UpdatedAt     string   `json:"updatedAt"`
}

// ============================================================================
// Helpers
// ============================================================================

func travelErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	http.Error(w, fmt.Sprintf(`{"error":%q}`, msg), code)
}

func travelRequireUser(w http.ResponseWriter, r *http.Request) string {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		travelErr(w, http.StatusUnauthorized, "unauthorized")
		return ""
	}
	return userID
}

// travelTripRole returns the caller's role on the trip, or "" if not a
// member/owner. Second return is ok=false when trip does not exist.
func travelTripRole(r *http.Request, db *sql.DB, tripID, userID string) (role string, exists bool, err error) {
	var ownerID string
	err = db.QueryRowContext(r.Context(),
		`SELECT owner_user_id FROM life_travel_trips WHERE id = $1`, tripID,
	).Scan(&ownerID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	if ownerID == userID {
		return "owner", true, nil
	}
	err = db.QueryRowContext(r.Context(),
		`SELECT role FROM life_travel_trip_members
		  WHERE trip_id = $1 AND user_id = $2 AND joined_at IS NOT NULL`,
		tripID, userID,
	).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", true, nil
	}
	if err != nil {
		return "", true, err
	}
	return role, true, nil
}

// travelRequireWriteAccess resolves trip role + enforces write access. Writes:
// owner + editor. Responds with 404/403/500 and returns ("", false) on failure.
func travelRequireWriteAccess(w http.ResponseWriter, r *http.Request, db *sql.DB, tripID, userID string) (string, bool) {
	role, exists, err := travelTripRole(r, db, tripID, userID)
	if err != nil {
		log.Printf("travel: role lookup trip=%s user=%s: %v", tripID, userID, err)
		travelErr(w, http.StatusInternalServerError, "failed to resolve access")
		return "", false
	}
	if !exists {
		travelErr(w, http.StatusNotFound, "trip not found")
		return "", false
	}
	if role != "owner" && role != "editor" {
		travelErr(w, http.StatusForbidden, "forbidden")
		return "", false
	}
	return role, true
}

// travelRequireReadAccess: owner, editor, viewer all pass.
func travelRequireReadAccess(w http.ResponseWriter, r *http.Request, db *sql.DB, tripID, userID string) (string, bool) {
	role, exists, err := travelTripRole(r, db, tripID, userID)
	if err != nil {
		log.Printf("travel: role lookup trip=%s user=%s: %v", tripID, userID, err)
		travelErr(w, http.StatusInternalServerError, "failed to resolve access")
		return "", false
	}
	if !exists {
		travelErr(w, http.StatusNotFound, "trip not found")
		return "", false
	}
	if role == "" {
		travelErr(w, http.StatusForbidden, "forbidden")
		return "", false
	}
	return role, true
}

func travelTripIDForDestination(r *http.Request, db *sql.DB, destID string) (string, error) {
	var tripID string
	err := db.QueryRowContext(r.Context(),
		`SELECT trip_id FROM life_travel_destinations WHERE id = $1`, destID,
	).Scan(&tripID)
	return tripID, err
}

func travelTripIDForActivity(r *http.Request, db *sql.DB, activityID string) (string, error) {
	var tripID string
	err := db.QueryRowContext(r.Context(),
		`SELECT trip_id FROM life_travel_activities WHERE id = $1`, activityID,
	).Scan(&tripID)
	return tripID, err
}

func travelTripIDForReservation(r *http.Request, db *sql.DB, reservationID string) (string, error) {
	var tripID string
	err := db.QueryRowContext(r.Context(),
		`SELECT trip_id FROM life_travel_reservations WHERE id = $1`, reservationID,
	).Scan(&tripID)
	return tripID, err
}

func travelParseDate(s string) (*time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func travelParseTime(s string) (*time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func travelFmtDatePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.UTC().Format("2006-01-02")
	return &s
}

func travelFmtTimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.UTC().Format(time.RFC3339)
	return &s
}

// ============================================================================
// Trip CRUD
// ============================================================================

// ListTrips handles GET /life/travel/trips. Returns trips the caller owns or
// is a member of.
func ListTrips(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}

		const q = `
			SELECT t.id, t.owner_user_id, t.title, t.summary, t.start_date, t.end_date,
			       t.cover_image_url, t.status, t.budget_currency,
			       CASE WHEN t.owner_user_id = $1 THEN 'owner' ELSE m.role END AS role,
			       t.created_at, t.updated_at
			FROM life_travel_trips t
			LEFT JOIN life_travel_trip_members m
			       ON m.trip_id = t.id AND m.user_id = $1 AND m.joined_at IS NOT NULL
			WHERE t.owner_user_id = $1 OR m.user_id = $1
			ORDER BY t.updated_at DESC`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			log.Printf("travel: list trips: %v", err)
			travelErr(w, http.StatusInternalServerError, "failed to list trips")
			return
		}
		defer rows.Close()

		trips := make([]travelTripRecord, 0)
		for rows.Next() {
			var t travelTripRecord
			var startDate, endDate sql.NullTime
			var role sql.NullString
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&t.ID, &t.OwnerUserID, &t.Title, &t.Summary,
				&startDate, &endDate, &t.CoverImageURL, &t.Status, &t.BudgetCurrency,
				&role, &createdAt, &updatedAt); err != nil {
				log.Printf("travel: scan trip: %v", err)
				travelErr(w, http.StatusInternalServerError, "failed to read trips")
				return
			}
			if startDate.Valid {
				t.StartDate = travelFmtDatePtr(&startDate.Time)
			}
			if endDate.Valid {
				t.EndDate = travelFmtDatePtr(&endDate.Time)
			}
			if role.Valid {
				t.Role = role.String
			}
			t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			t.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			trips = append(trips, t)
		}
		if err := rows.Err(); err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to iterate trips")
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"trips": trips})
	}
}

// CreateTrip handles POST /life/travel/trips.
// Body: {title, summary?, startDate?, endDate?, budgetCurrency?, coverImageUrl?}.
func CreateTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}

		var req struct {
			Title          string `json:"title"`
			Summary        string `json:"summary"`
			StartDate      string `json:"startDate"`
			EndDate        string `json:"endDate"`
			BudgetCurrency string `json:"budgetCurrency"`
			CoverImageURL  string `json:"coverImageUrl"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			travelErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		req.Title = strings.TrimSpace(req.Title)
		if req.Title == "" {
			travelErr(w, http.StatusBadRequest, "title is required")
			return
		}
		if req.BudgetCurrency == "" {
			req.BudgetCurrency = "USD"
		}

		startDate, err := travelParseDate(req.StartDate)
		if err != nil {
			travelErr(w, http.StatusBadRequest, "invalid startDate (want YYYY-MM-DD)")
			return
		}
		endDate, err := travelParseDate(req.EndDate)
		if err != nil {
			travelErr(w, http.StatusBadRequest, "invalid endDate (want YYYY-MM-DD)")
			return
		}
		if startDate != nil && endDate != nil && endDate.Before(*startDate) {
			travelErr(w, http.StatusBadRequest, "endDate must be after startDate")
			return
		}

		id := uuid.NewString()
		const q = `
			INSERT INTO life_travel_trips
				(id, owner_user_id, title, summary, start_date, end_date,
				 cover_image_url, budget_currency)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id, owner_user_id, title, summary, start_date, end_date,
			          cover_image_url, status, budget_currency, created_at, updated_at`

		var t travelTripRecord
		var startOut, endOut sql.NullTime
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			id, userID, req.Title, req.Summary, startDate, endDate,
			req.CoverImageURL, req.BudgetCurrency,
		).Scan(&t.ID, &t.OwnerUserID, &t.Title, &t.Summary, &startOut, &endOut,
			&t.CoverImageURL, &t.Status, &t.BudgetCurrency, &createdAt, &updatedAt); err != nil {
			log.Printf("travel: create trip: %v", err)
			travelErr(w, http.StatusInternalServerError, "failed to create trip")
			return
		}
		if startOut.Valid {
			t.StartDate = travelFmtDatePtr(&startOut.Time)
		}
		if endOut.Valid {
			t.EndDate = travelFmtDatePtr(&endOut.Time)
		}
		t.Role = "owner"
		t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		t.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"trip": t})
	}
}

// GetTrip handles GET /life/travel/trips/{id}.
func GetTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		tripID := chi.URLParam(r, "id")

		role, ok := travelRequireReadAccess(w, r, db, tripID, userID)
		if !ok {
			return
		}

		const q = `
			SELECT id, owner_user_id, title, summary, start_date, end_date,
			       cover_image_url, status, budget_currency, created_at, updated_at
			FROM life_travel_trips WHERE id = $1`

		var t travelTripRecord
		var startOut, endOut sql.NullTime
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q, tripID).Scan(
			&t.ID, &t.OwnerUserID, &t.Title, &t.Summary, &startOut, &endOut,
			&t.CoverImageURL, &t.Status, &t.BudgetCurrency, &createdAt, &updatedAt,
		); err != nil {
			log.Printf("travel: get trip %s: %v", tripID, err)
			travelErr(w, http.StatusInternalServerError, "failed to load trip")
			return
		}
		if startOut.Valid {
			t.StartDate = travelFmtDatePtr(&startOut.Time)
		}
		if endOut.Valid {
			t.EndDate = travelFmtDatePtr(&endOut.Time)
		}
		t.Role = role
		t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		t.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		json.NewEncoder(w).Encode(map[string]any{"trip": t})
	}
}

// UpdateTrip handles PATCH /life/travel/trips/{id}. Editors and owner may edit.
func UpdateTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		tripID := chi.URLParam(r, "id")

		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}

		var req struct {
			Title          *string `json:"title"`
			Summary        *string `json:"summary"`
			StartDate      *string `json:"startDate"`
			EndDate        *string `json:"endDate"`
			CoverImageURL  *string `json:"coverImageUrl"`
			Status         *string `json:"status"`
			BudgetCurrency *string `json:"budgetCurrency"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			travelErr(w, http.StatusBadRequest, "invalid request body")
			return
		}

		var startDate, endDate *time.Time
		if req.StartDate != nil {
			d, err := travelParseDate(*req.StartDate)
			if err != nil {
				travelErr(w, http.StatusBadRequest, "invalid startDate")
				return
			}
			startDate = d
		}
		if req.EndDate != nil {
			d, err := travelParseDate(*req.EndDate)
			if err != nil {
				travelErr(w, http.StatusBadRequest, "invalid endDate")
				return
			}
			endDate = d
		}

		const q = `
			UPDATE life_travel_trips SET
				title            = COALESCE($2, title),
				summary          = COALESCE($3, summary),
				start_date       = CASE WHEN $4::boolean THEN $5 ELSE start_date END,
				end_date         = CASE WHEN $6::boolean THEN $7 ELSE end_date END,
				cover_image_url  = COALESCE($8, cover_image_url),
				status           = COALESCE($9, status),
				budget_currency  = COALESCE($10, budget_currency),
				updated_at       = NOW()
			WHERE id = $1
			RETURNING id, owner_user_id, title, summary, start_date, end_date,
			          cover_image_url, status, budget_currency, created_at, updated_at`

		var t travelTripRecord
		var startOut, endOut sql.NullTime
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			tripID, req.Title, req.Summary,
			req.StartDate != nil, startDate,
			req.EndDate != nil, endDate,
			req.CoverImageURL, req.Status, req.BudgetCurrency,
		).Scan(&t.ID, &t.OwnerUserID, &t.Title, &t.Summary, &startOut, &endOut,
			&t.CoverImageURL, &t.Status, &t.BudgetCurrency, &createdAt, &updatedAt); err != nil {
			log.Printf("travel: update trip %s: %v", tripID, err)
			travelErr(w, http.StatusInternalServerError, "failed to update trip")
			return
		}
		if startOut.Valid {
			t.StartDate = travelFmtDatePtr(&startOut.Time)
		}
		if endOut.Valid {
			t.EndDate = travelFmtDatePtr(&endOut.Time)
		}
		t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		t.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		json.NewEncoder(w).Encode(map[string]any{"trip": t})
	}
}

// DeleteTrip handles DELETE /life/travel/trips/{id}. Owner only.
func DeleteTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		tripID := chi.URLParam(r, "id")

		res, err := db.ExecContext(r.Context(),
			`DELETE FROM life_travel_trips WHERE id = $1 AND owner_user_id = $2`,
			tripID, userID,
		)
		if err != nil {
			log.Printf("travel: delete trip %s: %v", tripID, err)
			travelErr(w, http.StatusInternalServerError, "failed to delete trip")
			return
		}
		rows, _ := res.RowsAffected()
		if rows == 0 {
			// Could be "not owner" or "not found" — check to distinguish.
			role, exists, _ := travelTripRole(r, db, tripID, userID)
			if !exists {
				travelErr(w, http.StatusNotFound, "trip not found")
				return
			}
			_ = role
			travelErr(w, http.StatusForbidden, "only owner can delete")
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// ============================================================================
// Destinations
// ============================================================================

// AddDestination handles POST /life/travel/trips/{id}/destinations.
func AddDestination(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		tripID := chi.URLParam(r, "id")
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}

		var req struct {
			Name          string   `json:"name"`
			MapboxPlaceID string   `json:"mapboxPlaceId"`
			Country       string   `json:"country"`
			Region        string   `json:"region"`
			Lat           *float64 `json:"lat"`
			Lng           *float64 `json:"lng"`
			ArriveAt      string   `json:"arriveAt"`
			DepartAt      string   `json:"departAt"`
			Notes         string   `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			travelErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			travelErr(w, http.StatusBadRequest, "name is required")
			return
		}
		arriveAt, err := travelParseTime(req.ArriveAt)
		if err != nil {
			travelErr(w, http.StatusBadRequest, "invalid arriveAt (want RFC3339)")
			return
		}
		departAt, err := travelParseTime(req.DepartAt)
		if err != nil {
			travelErr(w, http.StatusBadRequest, "invalid departAt (want RFC3339)")
			return
		}

		id := uuid.NewString()
		const q = `
			INSERT INTO life_travel_destinations
				(id, trip_id, ordinal, name, mapbox_place_id, country, region,
				 lat, lng, arrive_at, depart_at, notes)
			VALUES ($1, $2,
			        COALESCE((SELECT MAX(ordinal) + 1 FROM life_travel_destinations WHERE trip_id = $2), 0),
			        $3, $4, $5, $6, $7, $8, $9, $10, $11)
			RETURNING id, trip_id, ordinal, name, mapbox_place_id, country, region,
			          lat, lng, arrive_at, depart_at, notes, created_at, updated_at`

		var d travelDestinationRecord
		var lat, lng sql.NullFloat64
		var arriveOut, departOut sql.NullTime
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			id, tripID, req.Name, req.MapboxPlaceID, req.Country, req.Region,
			req.Lat, req.Lng, arriveAt, departAt, req.Notes,
		).Scan(&d.ID, &d.TripID, &d.Ordinal, &d.Name, &d.MapboxPlaceID,
			&d.Country, &d.Region, &lat, &lng, &arriveOut, &departOut,
			&d.Notes, &createdAt, &updatedAt); err != nil {
			log.Printf("travel: add destination trip=%s: %v", tripID, err)
			travelErr(w, http.StatusInternalServerError, "failed to add destination")
			return
		}
		if lat.Valid {
			d.Lat = &lat.Float64
		}
		if lng.Valid {
			d.Lng = &lng.Float64
		}
		if arriveOut.Valid {
			d.ArriveAt = travelFmtTimePtr(&arriveOut.Time)
		}
		if departOut.Valid {
			d.DepartAt = travelFmtTimePtr(&departOut.Time)
		}
		d.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		d.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"destination": d})
	}
}

// UpdateDestination handles PATCH /life/travel/destinations/{id}.
func UpdateDestination(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		destID := chi.URLParam(r, "id")

		tripID, err := travelTripIDForDestination(r, db, destID)
		if errors.Is(err, sql.ErrNoRows) {
			travelErr(w, http.StatusNotFound, "destination not found")
			return
		}
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to load destination")
			return
		}
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}

		var req struct {
			Name     *string  `json:"name"`
			Country  *string  `json:"country"`
			Region   *string  `json:"region"`
			Lat      *float64 `json:"lat"`
			Lng      *float64 `json:"lng"`
			ArriveAt *string  `json:"arriveAt"`
			DepartAt *string  `json:"departAt"`
			Notes    *string  `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			travelErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		var arriveAt, departAt *time.Time
		if req.ArriveAt != nil {
			t, err := travelParseTime(*req.ArriveAt)
			if err != nil {
				travelErr(w, http.StatusBadRequest, "invalid arriveAt")
				return
			}
			arriveAt = t
		}
		if req.DepartAt != nil {
			t, err := travelParseTime(*req.DepartAt)
			if err != nil {
				travelErr(w, http.StatusBadRequest, "invalid departAt")
				return
			}
			departAt = t
		}

		const q = `
			UPDATE life_travel_destinations SET
				name       = COALESCE($2, name),
				country    = COALESCE($3, country),
				region     = COALESCE($4, region),
				lat        = CASE WHEN $5::boolean THEN $6 ELSE lat END,
				lng        = CASE WHEN $7::boolean THEN $8 ELSE lng END,
				arrive_at  = CASE WHEN $9::boolean THEN $10 ELSE arrive_at END,
				depart_at  = CASE WHEN $11::boolean THEN $12 ELSE depart_at END,
				notes      = COALESCE($13, notes),
				updated_at = NOW()
			WHERE id = $1
			RETURNING id, trip_id, ordinal, name, mapbox_place_id, country, region,
			          lat, lng, arrive_at, depart_at, notes, created_at, updated_at`

		var d travelDestinationRecord
		var lat, lng sql.NullFloat64
		var arriveOut, departOut sql.NullTime
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			destID, req.Name, req.Country, req.Region,
			req.Lat != nil, req.Lat,
			req.Lng != nil, req.Lng,
			arriveAt != nil, arriveAt,
			departAt != nil, departAt,
			req.Notes,
		).Scan(&d.ID, &d.TripID, &d.Ordinal, &d.Name, &d.MapboxPlaceID,
			&d.Country, &d.Region, &lat, &lng, &arriveOut, &departOut,
			&d.Notes, &createdAt, &updatedAt); err != nil {
			log.Printf("travel: update destination %s: %v", destID, err)
			travelErr(w, http.StatusInternalServerError, "failed to update destination")
			return
		}
		if lat.Valid {
			d.Lat = &lat.Float64
		}
		if lng.Valid {
			d.Lng = &lng.Float64
		}
		if arriveOut.Valid {
			d.ArriveAt = travelFmtTimePtr(&arriveOut.Time)
		}
		if departOut.Valid {
			d.DepartAt = travelFmtTimePtr(&departOut.Time)
		}
		d.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		d.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		json.NewEncoder(w).Encode(map[string]any{"destination": d})
	}
}

// DeleteDestination handles DELETE /life/travel/destinations/{id}.
func DeleteDestination(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		destID := chi.URLParam(r, "id")

		tripID, err := travelTripIDForDestination(r, db, destID)
		if errors.Is(err, sql.ErrNoRows) {
			travelErr(w, http.StatusNotFound, "destination not found")
			return
		}
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to load destination")
			return
		}
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}

		if _, err := db.ExecContext(r.Context(),
			`DELETE FROM life_travel_destinations WHERE id = $1`, destID); err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to delete destination")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// ReorderDestinations handles POST /life/travel/trips/{id}/destinations/reorder.
// Body: {order: ["destId1","destId2",...]}.
func ReorderDestinations(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		tripID := chi.URLParam(r, "id")
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}

		var req struct {
			Order []string `json:"order"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Order) == 0 {
			travelErr(w, http.StatusBadRequest, "order is required")
			return
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to start tx")
			return
		}
		defer tx.Rollback()

		for i, id := range req.Order {
			res, err := tx.ExecContext(r.Context(),
				`UPDATE life_travel_destinations SET ordinal = $1, updated_at = NOW()
				 WHERE id = $2 AND trip_id = $3`,
				i, id, tripID,
			)
			if err != nil {
				log.Printf("travel: reorder destinations trip=%s: %v", tripID, err)
				travelErr(w, http.StatusInternalServerError, "failed to reorder")
				return
			}
			if n, _ := res.RowsAffected(); n == 0 {
				travelErr(w, http.StatusBadRequest, fmt.Sprintf("destination %s not in trip", id))
				return
			}
		}

		if err := tx.Commit(); err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to commit reorder")
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}
}

// ListDestinations handles GET /life/travel/trips/{id}/destinations.
func ListDestinations(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		tripID := chi.URLParam(r, "id")
		if _, ok := travelRequireReadAccess(w, r, db, tripID, userID); !ok {
			return
		}

		const q = `
			SELECT id, trip_id, ordinal, name, mapbox_place_id, country, region,
			       lat, lng, arrive_at, depart_at, notes, created_at, updated_at
			FROM life_travel_destinations
			WHERE trip_id = $1
			ORDER BY ordinal ASC`
		rows, err := db.QueryContext(r.Context(), q, tripID)
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to list destinations")
			return
		}
		defer rows.Close()

		out := make([]travelDestinationRecord, 0)
		for rows.Next() {
			var d travelDestinationRecord
			var lat, lng sql.NullFloat64
			var arriveOut, departOut sql.NullTime
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&d.ID, &d.TripID, &d.Ordinal, &d.Name, &d.MapboxPlaceID,
				&d.Country, &d.Region, &lat, &lng, &arriveOut, &departOut,
				&d.Notes, &createdAt, &updatedAt); err != nil {
				travelErr(w, http.StatusInternalServerError, "failed to read destinations")
				return
			}
			if lat.Valid {
				d.Lat = &lat.Float64
			}
			if lng.Valid {
				d.Lng = &lng.Float64
			}
			if arriveOut.Valid {
				d.ArriveAt = travelFmtTimePtr(&arriveOut.Time)
			}
			if departOut.Valid {
				d.DepartAt = travelFmtTimePtr(&departOut.Time)
			}
			d.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			d.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			out = append(out, d)
		}
		json.NewEncoder(w).Encode(map[string]any{"destinations": out})
	}
}

// ============================================================================
// Activities
// ============================================================================

// AddActivity handles POST /life/travel/destinations/{id}/activities.
func AddActivity(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		destID := chi.URLParam(r, "id")
		tripID, err := travelTripIDForDestination(r, db, destID)
		if errors.Is(err, sql.ErrNoRows) {
			travelErr(w, http.StatusNotFound, "destination not found")
			return
		}
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to load destination")
			return
		}
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}

		var req struct {
			Title        string   `json:"title"`
			Category     string   `json:"category"`
			StartAt      string   `json:"startAt"`
			EndAt        string   `json:"endAt"`
			Lat          *float64 `json:"lat"`
			Lng          *float64 `json:"lng"`
			Address      string   `json:"address"`
			CostAmount   *float64 `json:"costAmount"`
			CostCurrency string   `json:"costCurrency"`
			BookingURL   string   `json:"bookingUrl"`
			Notes        string   `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			travelErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		req.Title = strings.TrimSpace(req.Title)
		if req.Title == "" {
			travelErr(w, http.StatusBadRequest, "title is required")
			return
		}
		if req.Category == "" {
			req.Category = "other"
		}
		startAt, err := travelParseTime(req.StartAt)
		if err != nil {
			travelErr(w, http.StatusBadRequest, "invalid startAt")
			return
		}
		endAt, err := travelParseTime(req.EndAt)
		if err != nil {
			travelErr(w, http.StatusBadRequest, "invalid endAt")
			return
		}

		id := uuid.NewString()
		const q = `
			INSERT INTO life_travel_activities
				(id, destination_id, trip_id, title, category, start_at, end_at,
				 lat, lng, address, cost_amount, cost_currency, booking_url, notes)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
			RETURNING id, trip_id, destination_id, title, category, start_at, end_at,
			          lat, lng, address, cost_amount, cost_currency, booking_url, notes,
			          created_at, updated_at`

		var a travelActivityRecord
		var lat, lng sql.NullFloat64
		var startOut, endOut sql.NullTime
		var cost sql.NullFloat64
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			id, destID, tripID, req.Title, req.Category, startAt, endAt,
			req.Lat, req.Lng, req.Address, req.CostAmount, req.CostCurrency,
			req.BookingURL, req.Notes,
		).Scan(&a.ID, &a.TripID, &a.DestinationID, &a.Title, &a.Category,
			&startOut, &endOut, &lat, &lng, &a.Address, &cost, &a.CostCurrency,
			&a.BookingURL, &a.Notes, &createdAt, &updatedAt); err != nil {
			log.Printf("travel: add activity dest=%s: %v", destID, err)
			travelErr(w, http.StatusInternalServerError, "failed to add activity")
			return
		}
		if lat.Valid {
			a.Lat = &lat.Float64
		}
		if lng.Valid {
			a.Lng = &lng.Float64
		}
		if cost.Valid {
			a.CostAmount = &cost.Float64
		}
		if startOut.Valid {
			a.StartAt = travelFmtTimePtr(&startOut.Time)
		}
		if endOut.Valid {
			a.EndAt = travelFmtTimePtr(&endOut.Time)
		}
		a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		a.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"activity": a})
	}
}

// UpdateActivity handles PATCH /life/travel/activities/{id}.
func UpdateActivity(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		activityID := chi.URLParam(r, "id")

		tripID, err := travelTripIDForActivity(r, db, activityID)
		if errors.Is(err, sql.ErrNoRows) {
			travelErr(w, http.StatusNotFound, "activity not found")
			return
		}
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to load activity")
			return
		}
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}

		var req struct {
			Title        *string  `json:"title"`
			Category     *string  `json:"category"`
			StartAt      *string  `json:"startAt"`
			EndAt        *string  `json:"endAt"`
			Lat          *float64 `json:"lat"`
			Lng          *float64 `json:"lng"`
			Address      *string  `json:"address"`
			CostAmount   *float64 `json:"costAmount"`
			CostCurrency *string  `json:"costCurrency"`
			BookingURL   *string  `json:"bookingUrl"`
			Notes        *string  `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			travelErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		var startAt, endAt *time.Time
		if req.StartAt != nil {
			t, err := travelParseTime(*req.StartAt)
			if err != nil {
				travelErr(w, http.StatusBadRequest, "invalid startAt")
				return
			}
			startAt = t
		}
		if req.EndAt != nil {
			t, err := travelParseTime(*req.EndAt)
			if err != nil {
				travelErr(w, http.StatusBadRequest, "invalid endAt")
				return
			}
			endAt = t
		}

		const q = `
			UPDATE life_travel_activities SET
				title         = COALESCE($2, title),
				category      = COALESCE($3, category),
				start_at      = CASE WHEN $4::boolean THEN $5 ELSE start_at END,
				end_at        = CASE WHEN $6::boolean THEN $7 ELSE end_at END,
				lat           = CASE WHEN $8::boolean THEN $9 ELSE lat END,
				lng           = CASE WHEN $10::boolean THEN $11 ELSE lng END,
				address       = COALESCE($12, address),
				cost_amount   = CASE WHEN $13::boolean THEN $14 ELSE cost_amount END,
				cost_currency = COALESCE($15, cost_currency),
				booking_url   = COALESCE($16, booking_url),
				notes         = COALESCE($17, notes),
				updated_at    = NOW()
			WHERE id = $1
			RETURNING id, trip_id, destination_id, title, category, start_at, end_at,
			          lat, lng, address, cost_amount, cost_currency, booking_url, notes,
			          created_at, updated_at`

		var a travelActivityRecord
		var lat, lng sql.NullFloat64
		var startOut, endOut sql.NullTime
		var cost sql.NullFloat64
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			activityID, req.Title, req.Category,
			startAt != nil, startAt,
			endAt != nil, endAt,
			req.Lat != nil, req.Lat,
			req.Lng != nil, req.Lng,
			req.Address,
			req.CostAmount != nil, req.CostAmount,
			req.CostCurrency, req.BookingURL, req.Notes,
		).Scan(&a.ID, &a.TripID, &a.DestinationID, &a.Title, &a.Category,
			&startOut, &endOut, &lat, &lng, &a.Address, &cost, &a.CostCurrency,
			&a.BookingURL, &a.Notes, &createdAt, &updatedAt); err != nil {
			log.Printf("travel: update activity %s: %v", activityID, err)
			travelErr(w, http.StatusInternalServerError, "failed to update activity")
			return
		}
		if lat.Valid {
			a.Lat = &lat.Float64
		}
		if lng.Valid {
			a.Lng = &lng.Float64
		}
		if cost.Valid {
			a.CostAmount = &cost.Float64
		}
		if startOut.Valid {
			a.StartAt = travelFmtTimePtr(&startOut.Time)
		}
		if endOut.Valid {
			a.EndAt = travelFmtTimePtr(&endOut.Time)
		}
		a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		a.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		json.NewEncoder(w).Encode(map[string]any{"activity": a})
	}
}

// DeleteActivity handles DELETE /life/travel/activities/{id}.
func DeleteActivity(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		activityID := chi.URLParam(r, "id")

		tripID, err := travelTripIDForActivity(r, db, activityID)
		if errors.Is(err, sql.ErrNoRows) {
			travelErr(w, http.StatusNotFound, "activity not found")
			return
		}
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to load activity")
			return
		}
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}
		if _, err := db.ExecContext(r.Context(),
			`DELETE FROM life_travel_activities WHERE id = $1`, activityID); err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to delete activity")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// ListTripActivities handles GET /life/travel/trips/{id}/activities.
func ListTripActivities(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		tripID := chi.URLParam(r, "id")
		if _, ok := travelRequireReadAccess(w, r, db, tripID, userID); !ok {
			return
		}

		const q = `
			SELECT id, trip_id, destination_id, title, category, start_at, end_at,
			       lat, lng, address, cost_amount, cost_currency, booking_url, notes,
			       created_at, updated_at
			FROM life_travel_activities
			WHERE trip_id = $1
			ORDER BY COALESCE(start_at, 'epoch'::timestamptz) ASC, created_at ASC`
		rows, err := db.QueryContext(r.Context(), q, tripID)
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to list activities")
			return
		}
		defer rows.Close()

		out := make([]travelActivityRecord, 0)
		for rows.Next() {
			var a travelActivityRecord
			var lat, lng sql.NullFloat64
			var startOut, endOut sql.NullTime
			var cost sql.NullFloat64
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&a.ID, &a.TripID, &a.DestinationID, &a.Title, &a.Category,
				&startOut, &endOut, &lat, &lng, &a.Address, &cost, &a.CostCurrency,
				&a.BookingURL, &a.Notes, &createdAt, &updatedAt); err != nil {
				travelErr(w, http.StatusInternalServerError, "failed to read activities")
				return
			}
			if lat.Valid {
				a.Lat = &lat.Float64
			}
			if lng.Valid {
				a.Lng = &lng.Float64
			}
			if cost.Valid {
				a.CostAmount = &cost.Float64
			}
			if startOut.Valid {
				a.StartAt = travelFmtTimePtr(&startOut.Time)
			}
			if endOut.Valid {
				a.EndAt = travelFmtTimePtr(&endOut.Time)
			}
			a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			a.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			out = append(out, a)
		}
		json.NewEncoder(w).Encode(map[string]any{"activities": out})
	}
}

// ============================================================================
// Reservations
// ============================================================================

// AddReservation handles POST /life/travel/trips/{id}/reservations.
func AddReservation(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		tripID := chi.URLParam(r, "id")
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}

		var req struct {
			DestinationID    *string         `json:"destinationId"`
			Kind             string          `json:"kind"`
			Title            string          `json:"title"`
			Provider         string          `json:"provider"`
			ConfirmationCode string          `json:"confirmationCode"`
			StartAt          string          `json:"startAt"`
			EndAt            string          `json:"endAt"`
			OriginPlace      string          `json:"originPlace"`
			DestPlace        string          `json:"destPlace"`
			CostAmount       *float64        `json:"costAmount"`
			CostCurrency     string          `json:"costCurrency"`
			Status           string          `json:"status"`
			Payload          json.RawMessage `json:"payload"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			travelErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		req.Kind = strings.TrimSpace(req.Kind)
		req.Title = strings.TrimSpace(req.Title)
		if req.Kind == "" {
			travelErr(w, http.StatusBadRequest, "kind is required")
			return
		}
		if req.Title == "" {
			travelErr(w, http.StatusBadRequest, "title is required")
			return
		}
		if req.Status == "" {
			req.Status = "planned"
		}
		if len(req.Payload) == 0 {
			req.Payload = json.RawMessage(`{}`)
		}
		startAt, err := travelParseTime(req.StartAt)
		if err != nil {
			travelErr(w, http.StatusBadRequest, "invalid startAt")
			return
		}
		endAt, err := travelParseTime(req.EndAt)
		if err != nil {
			travelErr(w, http.StatusBadRequest, "invalid endAt")
			return
		}

		id := uuid.NewString()
		const q = `
			INSERT INTO life_travel_reservations
				(id, trip_id, destination_id, kind, title, provider, confirmation_code,
				 start_at, end_at, origin_place, dest_place, cost_amount, cost_currency,
				 status, payload)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
			RETURNING id, trip_id, destination_id, kind, title, provider, confirmation_code,
			          start_at, end_at, origin_place, dest_place, cost_amount, cost_currency,
			          status, payload, created_at, updated_at`

		var res travelReservationRecord
		var destOut sql.NullString
		var startOut, endOut sql.NullTime
		var cost sql.NullFloat64
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			id, tripID, req.DestinationID, req.Kind, req.Title, req.Provider,
			req.ConfirmationCode, startAt, endAt, req.OriginPlace, req.DestPlace,
			req.CostAmount, req.CostCurrency, req.Status, string(req.Payload),
		).Scan(&res.ID, &res.TripID, &destOut, &res.Kind, &res.Title, &res.Provider,
			&res.ConfirmationCode, &startOut, &endOut, &res.OriginPlace, &res.DestPlace,
			&cost, &res.CostCurrency, &res.Status, &res.Payload, &createdAt, &updatedAt); err != nil {
			log.Printf("travel: add reservation trip=%s: %v", tripID, err)
			travelErr(w, http.StatusInternalServerError, "failed to add reservation")
			return
		}
		if destOut.Valid {
			res.DestinationID = &destOut.String
		}
		if cost.Valid {
			res.CostAmount = &cost.Float64
		}
		if startOut.Valid {
			res.StartAt = travelFmtTimePtr(&startOut.Time)
		}
		if endOut.Valid {
			res.EndAt = travelFmtTimePtr(&endOut.Time)
		}
		res.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		res.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"reservation": res})
	}
}

// UpdateReservation handles PATCH /life/travel/reservations/{id}.
func UpdateReservation(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		resID := chi.URLParam(r, "id")
		tripID, err := travelTripIDForReservation(r, db, resID)
		if errors.Is(err, sql.ErrNoRows) {
			travelErr(w, http.StatusNotFound, "reservation not found")
			return
		}
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to load reservation")
			return
		}
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}

		var req struct {
			Title            *string          `json:"title"`
			Provider         *string          `json:"provider"`
			ConfirmationCode *string          `json:"confirmationCode"`
			StartAt          *string          `json:"startAt"`
			EndAt            *string          `json:"endAt"`
			OriginPlace      *string          `json:"originPlace"`
			DestPlace        *string          `json:"destPlace"`
			CostAmount       *float64         `json:"costAmount"`
			CostCurrency     *string          `json:"costCurrency"`
			Status           *string          `json:"status"`
			Payload          *json.RawMessage `json:"payload"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			travelErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		var startAt, endAt *time.Time
		if req.StartAt != nil {
			t, err := travelParseTime(*req.StartAt)
			if err != nil {
				travelErr(w, http.StatusBadRequest, "invalid startAt")
				return
			}
			startAt = t
		}
		if req.EndAt != nil {
			t, err := travelParseTime(*req.EndAt)
			if err != nil {
				travelErr(w, http.StatusBadRequest, "invalid endAt")
				return
			}
			endAt = t
		}

		var payloadBytes []byte
		if req.Payload != nil {
			payloadBytes = []byte(*req.Payload)
		}

		const q = `
			UPDATE life_travel_reservations SET
				title             = COALESCE($2, title),
				provider          = COALESCE($3, provider),
				confirmation_code = COALESCE($4, confirmation_code),
				start_at          = CASE WHEN $5::boolean THEN $6 ELSE start_at END,
				end_at            = CASE WHEN $7::boolean THEN $8 ELSE end_at END,
				origin_place      = COALESCE($9, origin_place),
				dest_place        = COALESCE($10, dest_place),
				cost_amount       = CASE WHEN $11::boolean THEN $12 ELSE cost_amount END,
				cost_currency     = COALESCE($13, cost_currency),
				status            = COALESCE($14, status),
				payload           = CASE WHEN $15::boolean THEN $16::jsonb ELSE payload END,
				updated_at        = NOW()
			WHERE id = $1
			RETURNING id, trip_id, destination_id, kind, title, provider, confirmation_code,
			          start_at, end_at, origin_place, dest_place, cost_amount, cost_currency,
			          status, payload, created_at, updated_at`

		var res travelReservationRecord
		var destOut sql.NullString
		var startOut, endOut sql.NullTime
		var cost sql.NullFloat64
		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			resID, req.Title, req.Provider, req.ConfirmationCode,
			startAt != nil, startAt,
			endAt != nil, endAt,
			req.OriginPlace, req.DestPlace,
			req.CostAmount != nil, req.CostAmount,
			req.CostCurrency, req.Status,
			req.Payload != nil, payloadBytes,
		).Scan(&res.ID, &res.TripID, &destOut, &res.Kind, &res.Title, &res.Provider,
			&res.ConfirmationCode, &startOut, &endOut, &res.OriginPlace, &res.DestPlace,
			&cost, &res.CostCurrency, &res.Status, &res.Payload, &createdAt, &updatedAt); err != nil {
			log.Printf("travel: update reservation %s: %v", resID, err)
			travelErr(w, http.StatusInternalServerError, "failed to update reservation")
			return
		}
		if destOut.Valid {
			res.DestinationID = &destOut.String
		}
		if cost.Valid {
			res.CostAmount = &cost.Float64
		}
		if startOut.Valid {
			res.StartAt = travelFmtTimePtr(&startOut.Time)
		}
		if endOut.Valid {
			res.EndAt = travelFmtTimePtr(&endOut.Time)
		}
		res.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		res.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		json.NewEncoder(w).Encode(map[string]any{"reservation": res})
	}
}

// DeleteReservation handles DELETE /life/travel/reservations/{id}.
func DeleteReservation(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		resID := chi.URLParam(r, "id")
		tripID, err := travelTripIDForReservation(r, db, resID)
		if errors.Is(err, sql.ErrNoRows) {
			travelErr(w, http.StatusNotFound, "reservation not found")
			return
		}
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to load reservation")
			return
		}
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}
		if _, err := db.ExecContext(r.Context(),
			`DELETE FROM life_travel_reservations WHERE id = $1`, resID); err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to delete reservation")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// ListReservations handles GET /life/travel/trips/{id}/reservations.
func ListReservations(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		tripID := chi.URLParam(r, "id")
		if _, ok := travelRequireReadAccess(w, r, db, tripID, userID); !ok {
			return
		}

		const q = `
			SELECT id, trip_id, destination_id, kind, title, provider, confirmation_code,
			       start_at, end_at, origin_place, dest_place, cost_amount, cost_currency,
			       status, payload, created_at, updated_at
			FROM life_travel_reservations
			WHERE trip_id = $1
			ORDER BY COALESCE(start_at, 'epoch'::timestamptz) ASC, created_at ASC`
		rows, err := db.QueryContext(r.Context(), q, tripID)
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to list reservations")
			return
		}
		defer rows.Close()

		out := make([]travelReservationRecord, 0)
		for rows.Next() {
			var res travelReservationRecord
			var destOut sql.NullString
			var startOut, endOut sql.NullTime
			var cost sql.NullFloat64
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&res.ID, &res.TripID, &destOut, &res.Kind, &res.Title, &res.Provider,
				&res.ConfirmationCode, &startOut, &endOut, &res.OriginPlace, &res.DestPlace,
				&cost, &res.CostCurrency, &res.Status, &res.Payload, &createdAt, &updatedAt); err != nil {
				travelErr(w, http.StatusInternalServerError, "failed to read reservations")
				return
			}
			if destOut.Valid {
				res.DestinationID = &destOut.String
			}
			if cost.Valid {
				res.CostAmount = &cost.Float64
			}
			if startOut.Valid {
				res.StartAt = travelFmtTimePtr(&startOut.Time)
			}
			if endOut.Valid {
				res.EndAt = travelFmtTimePtr(&endOut.Time)
			}
			res.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			res.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			out = append(out, res)
		}
		json.NewEncoder(w).Encode(map[string]any{"reservations": out})
	}
}

// ============================================================================
// Tickets (file upload)
// ============================================================================

const travelTicketMaxSize = 25 << 20 // 25 MB

// UploadTravelTicket handles POST /life/travel/trips/{id}/tickets.
// multipart: file + title + kind + reservationId + validFrom + validUntil + issuedTo.
func UploadTravelTicket(cfg *config.Config, db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		tripID := chi.URLParam(r, "id")
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, travelTicketMaxSize)
		if err := r.ParseMultipartForm(travelTicketMaxSize); err != nil {
			travelErr(w, http.StatusBadRequest, "file too large (max 25MB)")
			return
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			travelErr(w, http.StatusBadRequest, "file is required")
			return
		}
		defer file.Close()

		title := strings.TrimSpace(r.FormValue("title"))
		if title == "" {
			title = header.Filename
		}
		kind := r.FormValue("kind")
		if kind == "" {
			kind = "transit"
		}
		var reservationID *string
		if v := strings.TrimSpace(r.FormValue("reservationId")); v != "" {
			reservationID = &v
		}
		issuedTo := r.FormValue("issuedTo")
		validFrom, err := travelParseTime(r.FormValue("validFrom"))
		if err != nil {
			travelErr(w, http.StatusBadRequest, "invalid validFrom")
			return
		}
		validUntil, err := travelParseTime(r.FormValue("validUntil"))
		if err != nil {
			travelErr(w, http.StatusBadRequest, "invalid validUntil")
			return
		}

		ticketID := uuid.NewString()
		r2Key := fmt.Sprintf("travel/%s/%s", tripID, ticketID)
		contentType := header.Header.Get("Content-Type")
		if err := r2.Upload(r.Context(), r2Key, file, contentType, header.Size); err != nil {
			log.Printf("travel: r2 upload ticket %s: %v", ticketID, err)
			travelErr(w, http.StatusInternalServerError, "failed to upload ticket")
			return
		}

		const q = `
			INSERT INTO life_travel_tickets
				(id, trip_id, reservation_id, title, kind, file_url,
				 issued_to, valid_from, valid_until)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id, trip_id, reservation_id, title, kind, file_url,
			          issued_to, valid_from, valid_until, created_at`

		var t travelTicketRecord
		var resOut sql.NullString
		var vfOut, vuOut sql.NullTime
		var createdAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			ticketID, tripID, reservationID, title, kind, r2Key,
			issuedTo, validFrom, validUntil,
		).Scan(&t.ID, &t.TripID, &resOut, &t.Title, &t.Kind, &t.FileURL,
			&t.IssuedTo, &vfOut, &vuOut, &createdAt); err != nil {
			// cleanup uploaded file
			_ = r2.Delete(r.Context(), r2Key)
			log.Printf("travel: insert ticket trip=%s: %v", tripID, err)
			travelErr(w, http.StatusInternalServerError, "failed to record ticket")
			return
		}
		if resOut.Valid {
			t.ReservationID = &resOut.String
		}
		if vfOut.Valid {
			t.ValidFrom = travelFmtTimePtr(&vfOut.Time)
		}
		if vuOut.Valid {
			t.ValidUntil = travelFmtTimePtr(&vuOut.Time)
		}
		t.CreatedAt = createdAt.UTC().Format(time.RFC3339)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"ticket": t})
	}
}

// DeleteTravelTicket handles DELETE /life/travel/tickets/{id}.
func DeleteTravelTicket(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		ticketID := chi.URLParam(r, "id")

		var tripID, fileURL string
		if err := db.QueryRowContext(r.Context(),
			`SELECT trip_id, file_url FROM life_travel_tickets WHERE id = $1`,
			ticketID,
		).Scan(&tripID, &fileURL); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				travelErr(w, http.StatusNotFound, "ticket not found")
				return
			}
			travelErr(w, http.StatusInternalServerError, "failed to load ticket")
			return
		}
		if _, ok := travelRequireWriteAccess(w, r, db, tripID, userID); !ok {
			return
		}

		if _, err := db.ExecContext(r.Context(),
			`DELETE FROM life_travel_tickets WHERE id = $1`, ticketID); err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to delete ticket")
			return
		}
		if r2 != nil && fileURL != "" {
			_ = r2.Delete(r.Context(), fileURL)
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// ListTickets handles GET /life/travel/trips/{id}/tickets.
func ListTickets(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}
		tripID := chi.URLParam(r, "id")
		if _, ok := travelRequireReadAccess(w, r, db, tripID, userID); !ok {
			return
		}

		const q = `
			SELECT id, trip_id, reservation_id, title, kind, file_url,
			       issued_to, valid_from, valid_until, created_at
			FROM life_travel_tickets
			WHERE trip_id = $1
			ORDER BY created_at DESC`
		rows, err := db.QueryContext(r.Context(), q, tripID)
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to list tickets")
			return
		}
		defer rows.Close()
		out := make([]travelTicketRecord, 0)
		for rows.Next() {
			var t travelTicketRecord
			var resOut sql.NullString
			var vfOut, vuOut sql.NullTime
			var createdAt time.Time
			if err := rows.Scan(&t.ID, &t.TripID, &resOut, &t.Title, &t.Kind, &t.FileURL,
				&t.IssuedTo, &vfOut, &vuOut, &createdAt); err != nil {
				travelErr(w, http.StatusInternalServerError, "failed to read tickets")
				return
			}
			if resOut.Valid {
				t.ReservationID = &resOut.String
			}
			if vfOut.Valid {
				t.ValidFrom = travelFmtTimePtr(&vfOut.Time)
			}
			if vuOut.Valid {
				t.ValidUntil = travelFmtTimePtr(&vuOut.Time)
			}
			t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			out = append(out, t)
		}
		json.NewEncoder(w).Encode(map[string]any{"tickets": out})
	}
}

// ============================================================================
// Preferences
// ============================================================================

// GetTravelPreferences handles GET /life/travel/preferences.
func GetTravelPreferences(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}

		const q = `
			SELECT user_id, pace, budget_tier, dietary, accessibility, interests, avoid, updated_at
			FROM life_travel_preferences WHERE user_id = $1`

		var p travelPreferencesRecord
		var updatedAt time.Time
		err := db.QueryRowContext(r.Context(), q, userID).Scan(
			&p.UserID, &p.Pace, &p.BudgetTier,
			pq.Array(&p.Dietary), pq.Array(&p.Accessibility),
			pq.Array(&p.Interests), pq.Array(&p.Avoid), &updatedAt,
		)
		if errors.Is(err, sql.ErrNoRows) {
			p = travelPreferencesRecord{
				UserID: userID, Pace: "moderate", BudgetTier: "mid",
				Dietary: []string{}, Accessibility: []string{},
				Interests: []string{}, Avoid: []string{},
				UpdatedAt: time.Now().UTC().Format(time.RFC3339),
			}
			json.NewEncoder(w).Encode(map[string]any{"preferences": p})
			return
		}
		if err != nil {
			travelErr(w, http.StatusInternalServerError, "failed to load preferences")
			return
		}
		p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		json.NewEncoder(w).Encode(map[string]any{"preferences": p})
	}
}

// UpdateTravelPreferences handles PUT /life/travel/preferences.
func UpdateTravelPreferences(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		userID := travelRequireUser(w, r)
		if userID == "" {
			return
		}

		var req struct {
			Pace          string   `json:"pace"`
			BudgetTier    string   `json:"budgetTier"`
			Dietary       []string `json:"dietary"`
			Accessibility []string `json:"accessibility"`
			Interests     []string `json:"interests"`
			Avoid         []string `json:"avoid"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			travelErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.Pace == "" {
			req.Pace = "moderate"
		}
		if req.BudgetTier == "" {
			req.BudgetTier = "mid"
		}
		if req.Dietary == nil {
			req.Dietary = []string{}
		}
		if req.Accessibility == nil {
			req.Accessibility = []string{}
		}
		if req.Interests == nil {
			req.Interests = []string{}
		}
		if req.Avoid == nil {
			req.Avoid = []string{}
		}

		const q = `
			INSERT INTO life_travel_preferences
				(user_id, pace, budget_tier, dietary, accessibility, interests, avoid, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
			ON CONFLICT (user_id) DO UPDATE SET
				pace          = EXCLUDED.pace,
				budget_tier   = EXCLUDED.budget_tier,
				dietary       = EXCLUDED.dietary,
				accessibility = EXCLUDED.accessibility,
				interests     = EXCLUDED.interests,
				avoid         = EXCLUDED.avoid,
				updated_at    = NOW()
			RETURNING user_id, pace, budget_tier, dietary, accessibility, interests, avoid, updated_at`

		var p travelPreferencesRecord
		var updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), q,
			userID, req.Pace, req.BudgetTier,
			pq.Array(req.Dietary), pq.Array(req.Accessibility),
			pq.Array(req.Interests), pq.Array(req.Avoid),
		).Scan(&p.UserID, &p.Pace, &p.BudgetTier,
			pq.Array(&p.Dietary), pq.Array(&p.Accessibility),
			pq.Array(&p.Interests), pq.Array(&p.Avoid), &updatedAt); err != nil {
			log.Printf("travel: upsert preferences: %v", err)
			travelErr(w, http.StatusInternalServerError, "failed to update preferences")
			return
		}
		p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		json.NewEncoder(w).Encode(map[string]any{"preferences": p})
	}
}
