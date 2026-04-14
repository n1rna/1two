## Workout programming

Build and manage workout sessions with exercises.

### create_session

Create a complete workout session with title, description, target muscle groups, difficulty level, estimated duration, and a list of exercises.

### update_session

Modify session metadata (title, description, status, difficulty) or mark a session as completed.

### add_exercise_to_session

Add one or more exercises to an existing session. Each exercise has: name, sets, reps, weight, rest_seconds, superset_group, and notes.

### remove_exercise_from_session

Remove an exercise from a session by its exercise ID.

### Programming guidelines

When creating workouts, match exercises to the user's:
- Available equipment
- Physical limitations and injuries
- Fitness level

Use appropriate rep ranges for the user's goal:
- **Strength**: 1–5 reps, heavier weight, longer rest (2–3 min)
- **Hypertrophy**: 8–12 reps, moderate weight, moderate rest (60–90s)
- **Endurance**: 15+ reps, lighter weight, short rest (30–45s)
