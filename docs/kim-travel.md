# Kim Travel Assistant

Full travel planning + booking app built on top of kim agent. Web first, mobile to follow. Multi-user shared trips. Mapbox for maps/geocoding.

## Goals

- End-to-end trip planning: discover → plan → book → track → live assist.
- Kim agent as co-pilot throughout: suggest destinations/activities, price estimates, tool-calls that mutate trip state, generative smart UI cards for itineraries/flights/hotels.
- Shared trips: multi-user real-time edits, per-trip permissions, invites.
- Calendar integration: trip events sync to user's Google Calendar.
- Map-centric views: trip route preview, destination map, daily activity map.

## Out of scope (v1)

- Payments / real bookings executed in-product (we link out to provider checkout).
- Offline mobile mode (mobile comes later anyway).
- Public trip sharing / social feed.
- AI-generated day-by-day auto-plan (manual + kim-assisted only in v1; auto-plan in v2).

## User flows

1. **Create trip**: name, date range, primary travelers, empty destination list.
2. **Add destinations**: search place (Mapbox geocode) → add city/region → set arrival/departure per destination.
3. **Trip map preview**: show destinations with connecting polyline (flight/train/car hints).
4. **Per-destination plan**: activities, reservations, notes, day-by-day schedule, uploaded tickets/docs.
5. **Transit tickets**: inter-destination (flights, trains) and in-town (metro passes, event tickets) with attachments.
6. **Flight search**: kim or user searches flights between destinations, attach chosen option as a reservation.
7. **Hotel search**: same for lodging per destination.
8. **Kim chat in trip context**: travel mode agent has trip-aware tools — `add_activity`, `suggest_destinations`, `estimate_budget`, `search_flights`, `search_hotels`, `add_reservation`, `sync_to_calendar`.
9. **Share trip**: invite co-travelers via email; they accept → join trip → shared edits.
10. **During-trip live mode**: today-card on home surfaces current destination, next activity, upcoming transit.

## Data model (Postgres, `life_travel_*` namespace)

- `life_travel_trips` — id, owner_user_id, title, summary, start_date, end_date, cover_image_url, status (`planning|booked|ongoing|completed|cancelled`), budget_currency, created_at.
- `life_travel_trip_members` — trip_id, user_id, role (`owner|editor|viewer`), invite_email (nullable pre-accept), joined_at.
- `life_travel_destinations` — id, trip_id, ordinal, name, mapbox_place_id, country, region, lat, lng, arrive_at, depart_at, notes.
- `life_travel_activities` — id, destination_id, title, category (`sightseeing|food|nightlife|outdoor|wellness|other`), start_at, end_at, lat, lng, address, cost_amount, cost_currency, booking_url, notes.
- `life_travel_reservations` — id, trip_id, destination_id (nullable for inter-destination), kind (`flight|train|bus|car|hotel|bnb|restaurant|event|other`), title, provider, confirmation_code, start_at, end_at, origin_place, dest_place, cost_amount, cost_currency, status (`planned|booked|cancelled`), payload JSONB (provider-specific).
- `life_travel_tickets` — id, reservation_id (nullable), trip_id, title, kind (`transit|event|pass|voucher`), file_url (R2), issued_to, valid_from, valid_until.
- `life_travel_preferences` — user_id, pace (`slow|moderate|packed`), budget_tier, dietary, accessibility, interests (array), avoid (array).
- `life_travel_suggestions_cache` — query_hash, kind (`destination|activity|flight|hotel`), payload, expires_at.
- `life_travel_invites` — trip_id, email, token, role, status, expires_at.

## Backend — Go API

Routes under `/api/v1/life/travel/*`:

- `POST /trips`, `GET /trips`, `GET /trips/:id`, `PATCH /trips/:id`, `DELETE /trips/:id`.
- `POST /trips/:id/members` (invite), `DELETE /trips/:id/members/:userId`.
- `POST /invites/accept` (token).
- CRUD for destinations, activities, reservations, tickets.
- `POST /trips/:id/sync-calendar` — push reservations/activities as events to Google Calendar (reuses existing gcal connection).
- `GET /search/places?q=` — Mapbox geocoding proxy.
- `GET /search/flights?origin=&dest=&date=&pax=` — provider proxy (Duffel or Amadeus; pick in spike).
- `GET /search/hotels?place_id=&checkin=&checkout=&guests=` — provider proxy.
- `GET /estimate/budget?trip_id=` — aggregate cost estimate with per-category breakdown.

Realtime (for shared trips): Postgres LISTEN/NOTIFY + SSE endpoint `/trips/:id/stream` for collaborative updates. Fallback polling if SSE unavailable.

## Agent — travel mode

New category `travel` alongside `life`/`health`. System prompt gives current trip context (destinations, dates, budget, preferences, members). Tool set:

- `travel.create_trip` — bootstrap a trip from freeform prompt.
- `travel.suggest_destinations` — returns places matching preferences/season/budget.
- `travel.add_destination`, `travel.reorder_destinations`, `travel.remove_destination`.
- `travel.suggest_activities` — per destination with cost/category filters.
- `travel.add_activity`, `travel.remove_activity`.
- `travel.search_flights`, `travel.search_hotels` — hit provider proxy, return summarized options.
- `travel.add_reservation` — commit a flight/hotel/etc. to the trip.
- `travel.estimate_budget`.
- `travel.sync_to_calendar`.
- `travel.get_trip_summary` — returns current trip state snapshot for context.

Tool effects render as smart UI cards (see below). All tools respect trip membership / role.

## Smart UI — new components

Under `apps/kim/src/components/kim/smart-ui/travel/`:

- `trip-card` — summary tile (cover, title, dates, destination count, budget).
- `destination-list` — reorderable list of destinations with mini-map.
- `destination-detail` — header, map, activities, reservations tabs.
- `map-preview` — Mapbox GL JS component, multi-destination route.
- `activity-card` — inline confirmable card ("Add Sagrada Familia visit Tue 10am — €33? [Confirm] [Edit] [Skip]").
- `flight-options` — comparable flight offers with select-to-book action.
- `hotel-options` — hotel offer list with select.
- `reservation-card` — booked/planned reservation with docs.
- `itinerary-timeline` — day-by-day vertical timeline.
- `budget-breakdown` — pie + per-category rows.
- `traveler-chip` — member avatar list with invite affordance.

## Web surfaces (apps/kim)

Routes:

- `/travel` — trip list (with CTA "Plan a trip" opening kim in travel mode).
- `/travel/[tripId]` — trip overview: map preview, destination carousel, timeline, budget, travelers, chat dock.
- `/travel/[tripId]/destinations/[destId]` — destination detail.
- `/travel/[tripId]/timeline` — full-width day-by-day view.
- `/travel/[tripId]/bookings` — flights, hotels, other reservations, tickets.
- `/travel/[tripId]/map` — full-screen map with all activities/reservations pinned.
- `/travel/invites/[token]` — accept invite.

Chat dock is persistent on every trip page, seeded with trip context.

## Integrations

- **Mapbox**: geocoding, static + interactive maps, directions (for inter-destination hints). Web: `mapbox-gl`. Tokens via worker env.
- **Flight search**: spike ticket to choose Duffel vs Amadeus vs Kiwi/Tequila. Pref Duffel for clean REST + sandbox.
- **Hotel search**: Amadeus Hotel Search or Booking affiliate. Spike ticket.
- **Price estimation**: LLM estimation for long-tail activities when no API; cache in `suggestions_cache`.
- **Google Calendar**: reuse existing gcal connection; write events into a dedicated "Kim Travel — {trip title}" calendar or tag events.
- **File uploads (tickets)**: reuse R2 paste infra; new bucket prefix `travel/{tripId}/`.

## Phasing

**Phase 0 — Foundation (4 tickets)**
- DB migrations for all `life_travel_*` tables.
- Go API scaffolding + CRUD for trips, destinations, members, invites.
- api-client: `@1tt/api-client/travel` package with types + endpoints.
- Mapbox infra: token wiring, reusable `<MapView>` component.

**Phase 1 — Trip shell (web) (5 tickets)**
- `/travel` list + create modal.
- `/travel/[tripId]` overview page with map preview + destination list.
- Destination CRUD UI + reorder.
- Activity + reservation CRUD UI.
- Timeline view.

**Phase 2 — Kim travel mode (5 tickets)**
- New agent category `travel` + system prompt + context loader.
- Travel tool registry (all `travel.*` tools) with handlers.
- Smart UI travel component library (trip-card, map-preview, flight-options, hotel-options, activity-card, itinerary-timeline, budget-breakdown).
- Streamed tool effects persisted in `life_messages`.
- Chat dock on trip pages.

**Phase 3 — External integrations (5 tickets)**
- Spike: choose flight + hotel providers.
- Flights search endpoint + provider adapter.
- Hotels search endpoint + provider adapter.
- Price estimation + caching.
- Google Calendar sync for reservations/activities.

**Phase 4 — Sharing + live (4 tickets)**
- Invite flow + accept page.
- Permission middleware (owner/editor/viewer).
- SSE realtime stream for collaborative edits.
- Today-card "active trip" surfacing.

**Phase 5 — Polish + mobile (later)**
- Ticket uploads + docs vault UI.
- Budget/expense tracking.
- Mobile screens in kim-mobile.
- Auto-plan generator.

Total v1 tickets: ~23 + epic.

## Open questions

- Currency conversion source (fixer.io? ECB daily rates?).
- Whether flight/hotel bookings redirect out (v1) or use API deep-booking (v2+).
- Timezone handling for multi-destination trips (store activity times in destination local TZ? UTC? — lean local TZ string + UTC for sync).
