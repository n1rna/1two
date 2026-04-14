## Actionables

Create typed actionable items that surface to the user for a decision or acknowledgement. Each type has a specific data schema and visual layout. Always provide the "data" object matching the type.

### create_actionable

Create an actionable item that surfaces to the user for a decision or acknowledgement.

**Available types and their data schemas:**

1. **daily_plan** — Morning briefing (user acknowledges)
   data: {"sections": [{"icon": "calendar|check|dumbbell|star|...", "title": "Section Name", "items": ["line item 1", "line item 2"]}]}
   Icons: calendar, check, target, brain, dumbbell, utensils, phone, star, clock, alert, map-pin, list

2. **daily_review** — Evening reflection (user types a response)
   data: {"completed": ["Gym session", "Project work"], "missed": ["Reading"], "question": "What went well today?"}

3. **routine_check** — Did you do this routine? (user confirms/dismisses)
   data: {"routine_name": "Morning Gym", "routine_id": "abc", "scheduled_time": "7:00 AM", "details": "Leg day — squats, lunges, calf raises"}

4. **meal_choice** — What to eat (user picks an option)
   data: {"meal": "dinner", "options": [{"id": "opt-1", "label": "Cook pasta", "detail": "You have ingredients"}, {"id": "opt-2", "label": "Order sushi", "detail": "Last ordered 3 days ago"}]}

5. **schedule_pick** — Choose between schedule variants (user picks an option)
   data: {"context": "Tomorrow's schedule", "options": [{"id": "a", "label": "Early start", "detail": "Wake 6am, gym, work by 8"}, {"id": "b", "label": "Late start", "detail": "Wake 8am, work from home"}]}

6. **reminder** — Time-sensitive nudge (user acknowledges)
   data: {"message": "Team standup in 15 minutes", "time": "10:00 AM", "context": "Google Meet link in calendar"}

7. **preference** — Ask for free-text input (user types a response)
   data: {"question": "What time do you want to wake up tomorrow?", "context": "You usually wake at 7:00 AM on weekdays", "placeholder": "e.g., 7:30 AM"}

8. **task_roundup** — Summary of tasks (user acknowledges)
   data: {"pending": [{"title": "Buy yoga mat", "due": "Saturday"}, {"title": "File tax report"}], "completed_today": ["Sent weekly update", "Booked dentist"]}

9. **streak** — Progress/streak update (user acknowledges)
   data: {"routine_name": "Morning Gym", "count": 7, "unit": "days", "message": "You're on a 7-day gym streak!", "best": 14}

10. **suggestion** — Proactive recommendation (user confirms/dismisses)
    data: {"suggestion": "Based on your calendar, tomorrow evening is free. Want to schedule a call with Mom?", "reasoning": "You haven't called in 5 days and your routine says weekly calls"}

IMPORTANT: Always use the most specific type. Never put unstructured text in description — use the data object. Keep items concise (one line each).

### list_actionables

Query current pending actionable items.

### dismiss_actionables

Bulk dismiss pending actionable items. Use when the user wants to clear out old items.
