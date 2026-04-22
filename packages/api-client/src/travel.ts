"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TripStatus =
  | "planning"
  | "booked"
  | "ongoing"
  | "completed"
  | "cancelled";

export type TripRole = "owner" | "editor" | "viewer";

export interface Trip {
  id: string;
  ownerUserId: string;
  title: string;
  summary: string;
  startDate: string | null;
  endDate: string | null;
  coverImageUrl: string;
  status: TripStatus;
  budgetCurrency: string;
  role: TripRole | "";
  createdAt: string;
  updatedAt: string;
}

export interface Destination {
  id: string;
  tripId: string;
  ordinal: number;
  name: string;
  mapboxPlaceId: string;
  country: string;
  region: string;
  lat: number | null;
  lng: number | null;
  arriveAt: string | null;
  departAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityCategory =
  | "sightseeing"
  | "food"
  | "nightlife"
  | "outdoor"
  | "wellness"
  | "other";

export interface Activity {
  id: string;
  tripId: string;
  destinationId: string;
  title: string;
  category: ActivityCategory | string;
  startAt: string | null;
  endAt: string | null;
  lat: number | null;
  lng: number | null;
  address: string;
  costAmount: number | null;
  costCurrency: string;
  bookingUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ReservationKind =
  | "flight"
  | "train"
  | "bus"
  | "car"
  | "hotel"
  | "bnb"
  | "restaurant"
  | "event"
  | "other";

export type ReservationStatus = "planned" | "booked" | "cancelled";

export interface Reservation {
  id: string;
  tripId: string;
  destinationId: string | null;
  kind: ReservationKind | string;
  title: string;
  provider: string;
  confirmationCode: string;
  startAt: string | null;
  endAt: string | null;
  originPlace: string;
  destPlace: string;
  costAmount: number | null;
  costCurrency: string;
  status: ReservationStatus;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type TicketKind = "transit" | "event" | "pass" | "voucher";

export interface Ticket {
  id: string;
  tripId: string;
  reservationId: string | null;
  title: string;
  kind: TicketKind | string;
  fileUrl: string;
  issuedTo: string;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
}

export interface TravelPreferences {
  userId: string;
  pace: "slow" | "moderate" | "packed";
  budgetTier: "budget" | "mid" | "lux";
  dietary: string[];
  accessibility: string[];
  interests: string[];
  avoid: string[];
  updatedAt: string;
}

export interface CreateTripInput {
  title: string;
  summary?: string;
  startDate?: string;
  endDate?: string;
  budgetCurrency?: string;
  coverImageUrl?: string;
}

export interface UpdateTripInput {
  title?: string;
  summary?: string;
  startDate?: string | null;
  endDate?: string | null;
  coverImageUrl?: string;
  status?: TripStatus;
  budgetCurrency?: string;
}

export interface AddDestinationInput {
  name: string;
  mapboxPlaceId?: string;
  country?: string;
  region?: string;
  lat?: number;
  lng?: number;
  arriveAt?: string;
  departAt?: string;
  notes?: string;
}

export interface UpdateDestinationInput {
  name?: string;
  country?: string;
  region?: string;
  lat?: number | null;
  lng?: number | null;
  arriveAt?: string | null;
  departAt?: string | null;
  notes?: string;
}

export interface AddActivityInput {
  title: string;
  category?: ActivityCategory | string;
  startAt?: string;
  endAt?: string;
  lat?: number;
  lng?: number;
  address?: string;
  costAmount?: number;
  costCurrency?: string;
  bookingUrl?: string;
  notes?: string;
}

export interface UpdateActivityInput {
  title?: string;
  category?: string;
  startAt?: string | null;
  endAt?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string;
  costAmount?: number | null;
  costCurrency?: string;
  bookingUrl?: string;
  notes?: string;
}

export interface AddReservationInput {
  destinationId?: string;
  kind: ReservationKind | string;
  title: string;
  provider?: string;
  confirmationCode?: string;
  startAt?: string;
  endAt?: string;
  originPlace?: string;
  destPlace?: string;
  costAmount?: number;
  costCurrency?: string;
  status?: ReservationStatus;
  payload?: Record<string, unknown>;
}

export interface UpdateReservationInput {
  title?: string;
  provider?: string;
  confirmationCode?: string;
  startAt?: string | null;
  endAt?: string | null;
  originPlace?: string;
  destPlace?: string;
  costAmount?: number | null;
  costCurrency?: string;
  status?: ReservationStatus;
  payload?: Record<string, unknown> | null;
}

export interface UploadTicketInput {
  file: File;
  title?: string;
  kind?: TicketKind;
  reservationId?: string;
  issuedTo?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface UpdatePreferencesInput {
  pace?: TravelPreferences["pace"];
  budgetTier?: TravelPreferences["budgetTier"];
  dietary?: string[];
  accessibility?: string[];
  interests?: string[];
  avoid?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function travelApiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`/api/proxy/life/travel${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = "";
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || "";
    } catch {
      message = text;
    }
    if (res.status === 502 || res.status === 503 || message === "Backend unavailable") {
      throw new Error("Service is temporarily unavailable. Please try again in a moment.");
    }
    if (res.status === 401) {
      throw new Error("Please sign in to continue.");
    }
    if (res.status === 403) {
      throw new Error(message || "You don't have access to this trip.");
    }
    if (res.status === 404) {
      throw new Error(message || "Not found.");
    }
    if (res.status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    throw new Error(message || `Request failed (${res.status})`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// multipartApiFetch — same URL shape, no Content-Type so browser sets boundary.
async function travelMultipartFetch<T>(
  path: string,
  form: FormData
): Promise<T> {
  const res = await fetch(`/api/proxy/life/travel${path}`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = "";
    try {
      message = (JSON.parse(text) as { error?: string }).error || "";
    } catch {
      message = text;
    }
    throw new Error(message || `Upload failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function listTrips(): Promise<Trip[]> {
  const res = await travelApiFetch<{ trips: Trip[] }>("/trips");
  return res.trips;
}

export async function getTrip(id: string): Promise<Trip> {
  const res = await travelApiFetch<{ trip: Trip }>(`/trips/${id}`);
  return res.trip;
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const res = await travelApiFetch<{ trip: Trip }>("/trips", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.trip;
}

export async function updateTrip(
  id: string,
  input: UpdateTripInput
): Promise<Trip> {
  const res = await travelApiFetch<{ trip: Trip }>(`/trips/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.trip;
}

export async function deleteTrip(id: string): Promise<void> {
  return travelApiFetch<void>(`/trips/${id}`, { method: "DELETE" });
}

// ─── Destinations ─────────────────────────────────────────────────────────────

export async function listDestinations(tripId: string): Promise<Destination[]> {
  const res = await travelApiFetch<{ destinations: Destination[] }>(
    `/trips/${tripId}/destinations`
  );
  return res.destinations;
}

export async function addDestination(
  tripId: string,
  input: AddDestinationInput
): Promise<Destination> {
  const res = await travelApiFetch<{ destination: Destination }>(
    `/trips/${tripId}/destinations`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return res.destination;
}

export async function updateDestination(
  id: string,
  input: UpdateDestinationInput
): Promise<Destination> {
  const res = await travelApiFetch<{ destination: Destination }>(
    `/destinations/${id}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return res.destination;
}

export async function deleteDestination(id: string): Promise<void> {
  return travelApiFetch<void>(`/destinations/${id}`, { method: "DELETE" });
}

export async function reorderDestinations(
  tripId: string,
  order: string[]
): Promise<void> {
  await travelApiFetch<void>(`/trips/${tripId}/destinations/reorder`, {
    method: "POST",
    body: JSON.stringify({ order }),
  });
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function listTripActivities(tripId: string): Promise<Activity[]> {
  const res = await travelApiFetch<{ activities: Activity[] }>(
    `/trips/${tripId}/activities`
  );
  return res.activities;
}

export async function addActivity(
  destinationId: string,
  input: AddActivityInput
): Promise<Activity> {
  const res = await travelApiFetch<{ activity: Activity }>(
    `/destinations/${destinationId}/activities`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return res.activity;
}

export async function updateActivity(
  id: string,
  input: UpdateActivityInput
): Promise<Activity> {
  const res = await travelApiFetch<{ activity: Activity }>(
    `/activities/${id}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return res.activity;
}

export async function deleteActivity(id: string): Promise<void> {
  return travelApiFetch<void>(`/activities/${id}`, { method: "DELETE" });
}

// ─── Reservations ─────────────────────────────────────────────────────────────

export async function listReservations(tripId: string): Promise<Reservation[]> {
  const res = await travelApiFetch<{ reservations: Reservation[] }>(
    `/trips/${tripId}/reservations`
  );
  return res.reservations;
}

export async function addReservation(
  tripId: string,
  input: AddReservationInput
): Promise<Reservation> {
  const res = await travelApiFetch<{ reservation: Reservation }>(
    `/trips/${tripId}/reservations`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return res.reservation;
}

export async function updateReservation(
  id: string,
  input: UpdateReservationInput
): Promise<Reservation> {
  const res = await travelApiFetch<{ reservation: Reservation }>(
    `/reservations/${id}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return res.reservation;
}

export async function deleteReservation(id: string): Promise<void> {
  return travelApiFetch<void>(`/reservations/${id}`, { method: "DELETE" });
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

export async function listTickets(tripId: string): Promise<Ticket[]> {
  const res = await travelApiFetch<{ tickets: Ticket[] }>(
    `/trips/${tripId}/tickets`
  );
  return res.tickets;
}

export async function uploadTicket(
  tripId: string,
  input: UploadTicketInput
): Promise<Ticket> {
  const form = new FormData();
  form.append("file", input.file);
  if (input.title) form.append("title", input.title);
  if (input.kind) form.append("kind", input.kind);
  if (input.reservationId) form.append("reservationId", input.reservationId);
  if (input.issuedTo) form.append("issuedTo", input.issuedTo);
  if (input.validFrom) form.append("validFrom", input.validFrom);
  if (input.validUntil) form.append("validUntil", input.validUntil);
  const res = await travelMultipartFetch<{ ticket: Ticket }>(
    `/trips/${tripId}/tickets`,
    form
  );
  return res.ticket;
}

export async function deleteTicket(id: string): Promise<void> {
  return travelApiFetch<void>(`/tickets/${id}`, { method: "DELETE" });
}

// ─── Preferences ──────────────────────────────────────────────────────────────

export async function getTravelPreferences(): Promise<TravelPreferences> {
  const res = await travelApiFetch<{ preferences: TravelPreferences }>(
    "/preferences"
  );
  return res.preferences;
}

export async function updateTravelPreferences(
  input: UpdatePreferencesInput
): Promise<TravelPreferences> {
  const res = await travelApiFetch<{ preferences: TravelPreferences }>(
    "/preferences",
    { method: "PUT", body: JSON.stringify(input) }
  );
  return res.preferences;
}
