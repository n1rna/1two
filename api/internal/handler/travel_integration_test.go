//go:build integration

package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/n1rna/1tt/api/internal/middleware"
)

// ─── DB setup ────────────────────────────────────────────────────────────────

func openTravelTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to run travel handler integration tests")
	}
	// Use pgx with simple_protocol — matches production db.Open and works with
	// PgBouncer/Neon poolers that don't support server-side prepared statements.
	sep := "?"
	if strings.Contains(dsn, "?") {
		sep = "&"
	}
	db, err := sql.Open("pgx", dsn+sep+"default_query_exec_mode=simple_protocol")
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Fatalf("ping test db: %v", err)
	}
	return db
}

func cleanupTravelUser(t *testing.T, db *sql.DB, userID string) {
	t.Helper()
	// Tickets, reservations, activities, destinations cascade through trip delete.
	if _, err := db.Exec(
		`DELETE FROM life_travel_trips WHERE owner_user_id = $1`, userID,
	); err != nil {
		t.Logf("cleanup trips for %s: %v", userID, err)
	}
	if _, err := db.Exec(
		`DELETE FROM life_travel_preferences WHERE user_id = $1`, userID,
	); err != nil {
		t.Logf("cleanup preferences for %s: %v", userID, err)
	}
	if _, err := db.Exec(
		`DELETE FROM life_travel_trip_members WHERE user_id = $1`, userID,
	); err != nil {
		t.Logf("cleanup members for %s: %v", userID, err)
	}
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// authedRequest builds an http.Request with the given userID injected into the
// context (simulating the post-Auth middleware state) and a chi URL-params
// routing context containing the provided named params.
func authedRequest(t *testing.T, method, path, userID string, body any, params map[string]string) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if userID != "" {
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
		req = req.WithContext(ctx)
	}
	if len(params) > 0 {
		rctx := chi.NewRouteContext()
		for k, v := range params {
			rctx.URLParams.Add(k, v)
		}
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	}
	return req
}

func doHandler(h http.HandlerFunc, req *http.Request) *httptest.ResponseRecorder {
	rr := httptest.NewRecorder()
	h(rr, req)
	return rr
}

// ─── tests ───────────────────────────────────────────────────────────────────

func TestCreateAndGetTrip(t *testing.T) {
	db := openTravelTestDB(t)
	defer db.Close()
	userID := "u_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	defer cleanupTravelUser(t, db, userID)

	// Create trip.
	req := authedRequest(t, "POST", "/life/travel/trips", userID, map[string]any{
		"title":          "Japan 2026",
		"summary":        "Tokyo -> Kyoto -> Osaka",
		"startDate":      "2026-09-01",
		"endDate":        "2026-09-14",
		"budgetCurrency": "JPY",
	}, nil)
	rr := doHandler(CreateTrip(db), req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("CreateTrip: want 201, got %d: %s", rr.Code, rr.Body.String())
	}
	var createResp struct {
		Trip travelTripRecord `json:"trip"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&createResp); err != nil {
		t.Fatalf("decode create: %v", err)
	}
	trip := createResp.Trip
	if trip.ID == "" || trip.OwnerUserID != userID || trip.Title != "Japan 2026" {
		t.Fatalf("unexpected trip: %+v", trip)
	}
	if trip.Role != "owner" {
		t.Errorf("role: want owner, got %q", trip.Role)
	}
	if trip.Status != "planning" {
		t.Errorf("status: want planning, got %q", trip.Status)
	}

	// Get it back.
	req = authedRequest(t, "GET", "/life/travel/trips/"+trip.ID, userID, nil, map[string]string{"id": trip.ID})
	rr = doHandler(GetTrip(db), req)
	if rr.Code != http.StatusOK {
		t.Fatalf("GetTrip: want 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var getResp struct {
		Trip travelTripRecord `json:"trip"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&getResp); err != nil {
		t.Fatalf("decode get: %v", err)
	}
	if getResp.Trip.ID != trip.ID || getResp.Trip.Role != "owner" {
		t.Errorf("mismatch: %+v", getResp.Trip)
	}

	// List it.
	req = authedRequest(t, "GET", "/life/travel/trips", userID, nil, nil)
	rr = doHandler(ListTrips(db), req)
	if rr.Code != http.StatusOK {
		t.Fatalf("ListTrips: want 200, got %d", rr.Code)
	}
	var listResp struct {
		Trips []travelTripRecord `json:"trips"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&listResp); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	found := false
	for _, tr := range listResp.Trips {
		if tr.ID == trip.ID {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("created trip not in list")
	}
}

func TestCreateTripValidation(t *testing.T) {
	db := openTravelTestDB(t)
	defer db.Close()
	userID := "u_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	defer cleanupTravelUser(t, db, userID)

	// Missing title.
	req := authedRequest(t, "POST", "/life/travel/trips", userID, map[string]any{}, nil)
	rr := doHandler(CreateTrip(db), req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("empty title: want 400, got %d", rr.Code)
	}

	// End before start.
	req = authedRequest(t, "POST", "/life/travel/trips", userID, map[string]any{
		"title":     "Bad dates",
		"startDate": "2026-10-10",
		"endDate":   "2026-10-01",
	}, nil)
	rr = doHandler(CreateTrip(db), req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("reversed dates: want 400, got %d", rr.Code)
	}
}

func TestUnauthorized(t *testing.T) {
	db := openTravelTestDB(t)
	defer db.Close()

	req := httptest.NewRequest("GET", "/life/travel/trips", nil)
	rr := doHandler(ListTrips(db), req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("no auth: want 401, got %d", rr.Code)
	}
}

func TestTripAccessIsolation(t *testing.T) {
	db := openTravelTestDB(t)
	defer db.Close()
	owner := "u_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	other := "u_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	defer cleanupTravelUser(t, db, owner)
	defer cleanupTravelUser(t, db, other)

	// Owner creates trip.
	req := authedRequest(t, "POST", "/life/travel/trips", owner, map[string]any{
		"title": "Private",
	}, nil)
	rr := doHandler(CreateTrip(db), req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create: %d", rr.Code)
	}
	var cr struct {
		Trip travelTripRecord `json:"trip"`
	}
	json.NewDecoder(rr.Body).Decode(&cr)

	// Other user tries to read.
	req = authedRequest(t, "GET", "/life/travel/trips/"+cr.Trip.ID, other, nil, map[string]string{"id": cr.Trip.ID})
	rr = doHandler(GetTrip(db), req)
	if rr.Code != http.StatusForbidden {
		t.Errorf("other user read: want 403, got %d: %s", rr.Code, rr.Body.String())
	}

	// Other user tries to delete.
	req = authedRequest(t, "DELETE", "/life/travel/trips/"+cr.Trip.ID, other, nil, map[string]string{"id": cr.Trip.ID})
	rr = doHandler(DeleteTrip(db), req)
	if rr.Code != http.StatusForbidden && rr.Code != http.StatusNotFound {
		// Current impl returns either 403 (trip exists, not owner) or 404 — both
		// acceptably refuse. Anything 2xx is a leak.
		t.Errorf("other user delete: want 403/404, got %d", rr.Code)
	}

	// Confirm trip still exists for owner.
	req = authedRequest(t, "GET", "/life/travel/trips/"+cr.Trip.ID, owner, nil, map[string]string{"id": cr.Trip.ID})
	rr = doHandler(GetTrip(db), req)
	if rr.Code != http.StatusOK {
		t.Errorf("owner read after leak attempt: want 200, got %d", rr.Code)
	}
}

func TestDestinationAndActivityFlow(t *testing.T) {
	db := openTravelTestDB(t)
	defer db.Close()
	userID := "u_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	defer cleanupTravelUser(t, db, userID)

	// Create trip.
	req := authedRequest(t, "POST", "/life/travel/trips", userID, map[string]any{
		"title": "Destinations test",
	}, nil)
	rr := doHandler(CreateTrip(db), req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create trip: %d", rr.Code)
	}
	var cr struct {
		Trip travelTripRecord `json:"trip"`
	}
	json.NewDecoder(rr.Body).Decode(&cr)
	tripID := cr.Trip.ID

	// Add 3 destinations.
	destIDs := make([]string, 0, 3)
	for _, n := range []string{"Tokyo", "Kyoto", "Osaka"} {
		req = authedRequest(t, "POST", "/life/travel/trips/"+tripID+"/destinations", userID, map[string]any{
			"name": n, "country": "Japan",
		}, map[string]string{"id": tripID})
		rr = doHandler(AddDestination(db), req)
		if rr.Code != http.StatusCreated {
			t.Fatalf("add destination %s: %d %s", n, rr.Code, rr.Body.String())
		}
		var dr struct {
			Destination travelDestinationRecord `json:"destination"`
		}
		json.NewDecoder(rr.Body).Decode(&dr)
		destIDs = append(destIDs, dr.Destination.ID)
	}

	// List and verify ordinals.
	req = authedRequest(t, "GET", "/life/travel/trips/"+tripID+"/destinations", userID, nil, map[string]string{"id": tripID})
	rr = doHandler(ListDestinations(db), req)
	if rr.Code != http.StatusOK {
		t.Fatalf("list destinations: %d", rr.Code)
	}
	var lr struct {
		Destinations []travelDestinationRecord `json:"destinations"`
	}
	json.NewDecoder(rr.Body).Decode(&lr)
	if len(lr.Destinations) != 3 {
		t.Fatalf("want 3 destinations, got %d", len(lr.Destinations))
	}
	for i, d := range lr.Destinations {
		if d.Ordinal != i {
			t.Errorf("destination[%d] ordinal: want %d, got %d", i, i, d.Ordinal)
		}
	}

	// Reorder reversed.
	reversed := []string{destIDs[2], destIDs[1], destIDs[0]}
	req = authedRequest(t, "POST", "/life/travel/trips/"+tripID+"/destinations/reorder", userID,
		map[string]any{"order": reversed}, map[string]string{"id": tripID})
	rr = doHandler(ReorderDestinations(db), req)
	if rr.Code != http.StatusOK {
		t.Fatalf("reorder: %d %s", rr.Code, rr.Body.String())
	}
	// Verify.
	req = authedRequest(t, "GET", "/life/travel/trips/"+tripID+"/destinations", userID, nil, map[string]string{"id": tripID})
	rr = doHandler(ListDestinations(db), req)
	json.NewDecoder(rr.Body).Decode(&lr)
	for i, d := range lr.Destinations {
		if d.ID != reversed[i] {
			t.Errorf("after reorder pos %d: want %s, got %s", i, reversed[i], d.ID)
		}
	}

	// Add activity to first destination.
	firstDest := lr.Destinations[0].ID
	req = authedRequest(t, "POST", "/life/travel/destinations/"+firstDest+"/activities", userID, map[string]any{
		"title":        "Fushimi Inari",
		"category":     "sightseeing",
		"startAt":      "2026-09-05T09:00:00Z",
		"endAt":        "2026-09-05T12:00:00Z",
		"costAmount":   0.0,
		"costCurrency": "JPY",
	}, map[string]string{"id": firstDest})
	rr = doHandler(AddActivity(db), req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("add activity: %d %s", rr.Code, rr.Body.String())
	}
	var ar struct {
		Activity travelActivityRecord `json:"activity"`
	}
	json.NewDecoder(rr.Body).Decode(&ar)
	if ar.Activity.Title != "Fushimi Inari" || ar.Activity.TripID != tripID {
		t.Errorf("activity mismatch: %+v", ar.Activity)
	}

	// Delete the trip; destinations + activities should cascade.
	req = authedRequest(t, "DELETE", "/life/travel/trips/"+tripID, userID, nil, map[string]string{"id": tripID})
	rr = doHandler(DeleteTrip(db), req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("delete trip: %d", rr.Code)
	}
	var count int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM life_travel_destinations WHERE trip_id = $1`, tripID,
	).Scan(&count); err != nil {
		t.Fatalf("count destinations: %v", err)
	}
	if count != 0 {
		t.Errorf("expected cascade delete of destinations, %d remain", count)
	}
}

func TestReservationCRUD(t *testing.T) {
	db := openTravelTestDB(t)
	defer db.Close()
	userID := "u_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	defer cleanupTravelUser(t, db, userID)

	req := authedRequest(t, "POST", "/life/travel/trips", userID, map[string]any{"title": "Res test"}, nil)
	rr := doHandler(CreateTrip(db), req)
	var cr struct {
		Trip travelTripRecord `json:"trip"`
	}
	json.NewDecoder(rr.Body).Decode(&cr)
	tripID := cr.Trip.ID

	// Add flight reservation.
	req = authedRequest(t, "POST", "/life/travel/trips/"+tripID+"/reservations", userID, map[string]any{
		"kind":         "flight",
		"title":        "HND -> KIX",
		"provider":     "ANA",
		"startAt":      "2026-09-10T08:00:00Z",
		"endAt":        "2026-09-10T09:15:00Z",
		"originPlace":  "HND",
		"destPlace":    "KIX",
		"costAmount":   15000.0,
		"costCurrency": "JPY",
		"payload":      map[string]any{"flightNo": "NH 21"},
	}, map[string]string{"id": tripID})
	rr = doHandler(AddReservation(db), req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("add reservation: %d %s", rr.Code, rr.Body.String())
	}
	var resp struct {
		Reservation travelReservationRecord `json:"reservation"`
	}
	json.NewDecoder(rr.Body).Decode(&resp)
	resID := resp.Reservation.ID
	if resp.Reservation.Status != "planned" {
		t.Errorf("default status: want planned, got %q", resp.Reservation.Status)
	}

	// Update to booked.
	req = authedRequest(t, "PATCH", "/life/travel/reservations/"+resID, userID,
		map[string]any{"status": "booked", "confirmationCode": "ABC123"},
		map[string]string{"id": resID})
	rr = doHandler(UpdateReservation(db), req)
	if rr.Code != http.StatusOK {
		t.Fatalf("update reservation: %d %s", rr.Code, rr.Body.String())
	}
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.Reservation.Status != "booked" || resp.Reservation.ConfirmationCode != "ABC123" {
		t.Errorf("update: %+v", resp.Reservation)
	}

	// Delete.
	req = authedRequest(t, "DELETE", "/life/travel/reservations/"+resID, userID, nil, map[string]string{"id": resID})
	rr = doHandler(DeleteReservation(db), req)
	if rr.Code != http.StatusNoContent {
		t.Errorf("delete reservation: %d", rr.Code)
	}

	// Second delete → 404.
	req = authedRequest(t, "DELETE", "/life/travel/reservations/"+resID, userID, nil, map[string]string{"id": resID})
	rr = doHandler(DeleteReservation(db), req)
	if rr.Code != http.StatusNotFound {
		t.Errorf("delete missing: want 404, got %d", rr.Code)
	}
}

func TestTravelPreferencesUpsert(t *testing.T) {
	db := openTravelTestDB(t)
	defer db.Close()
	userID := "u_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	defer cleanupTravelUser(t, db, userID)

	// First get: returns defaults (no row).
	req := authedRequest(t, "GET", "/life/travel/preferences", userID, nil, nil)
	rr := doHandler(GetTravelPreferences(db), req)
	if rr.Code != http.StatusOK {
		t.Fatalf("get defaults: %d", rr.Code)
	}
	var resp struct {
		Preferences travelPreferencesRecord `json:"preferences"`
	}
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.Preferences.Pace != "moderate" {
		t.Errorf("default pace: got %q", resp.Preferences.Pace)
	}

	// Update.
	req = authedRequest(t, "PUT", "/life/travel/preferences", userID, map[string]any{
		"pace":       "slow",
		"budgetTier": "lux",
		"interests":  []string{"food", "museums"},
		"avoid":      []string{"crowds"},
	}, nil)
	rr = doHandler(UpdateTravelPreferences(db), req)
	if rr.Code != http.StatusOK {
		t.Fatalf("put: %d %s", rr.Code, rr.Body.String())
	}
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.Preferences.Pace != "slow" || resp.Preferences.BudgetTier != "lux" {
		t.Errorf("upsert: %+v", resp.Preferences)
	}
	if len(resp.Preferences.Interests) != 2 {
		t.Errorf("interests: %+v", resp.Preferences.Interests)
	}

	// Update again (conflict path).
	req = authedRequest(t, "PUT", "/life/travel/preferences", userID, map[string]any{
		"pace":       "packed",
		"budgetTier": "budget",
	}, nil)
	rr = doHandler(UpdateTravelPreferences(db), req)
	if rr.Code != http.StatusOK {
		t.Fatalf("second put: %d", rr.Code)
	}
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.Preferences.Pace != "packed" {
		t.Errorf("conflict update: %+v", resp.Preferences)
	}
}
