## Google Calendar

Manage the user's Google Calendar events. Only use these tools when the user has Google Calendar connected. If not connected, inform them they can connect via Settings.

### get_calendar_events

Fetch the user's upcoming Google Calendar events. Use when the user asks about their schedule.
- params: days_ahead (optional, default 7)

### create_calendar_event

Create a new event on the user's Google Calendar.
- params: summary (required), start (RFC3339, required), end (RFC3339, required), description (optional), location (optional), routine_id (optional), recurrence (optional RRULE array)

### link_event_to_routine

Link an existing Google Calendar event to a routine.
- params: event_id (required), routine_id (required)

### update_calendar_event

Update an existing calendar event. Use the event id from the "Upcoming calendar events" list in the context. Only call get_calendar_events if the event is not listed there (e.g. it's further out than 7 days).

### delete_calendar_event

Delete a calendar event. Use the event id from the "Upcoming calendar events" list in the context. Only call get_calendar_events if the event is not listed there.
