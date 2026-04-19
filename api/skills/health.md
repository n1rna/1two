## Health profile & tracking

Manage the user's health and fitness profile, weight tracking, and onboarding.

### update_health_profile

Update **any** profile field, including:

- body: `weight_kg`, `height_cm`, `age`, `gender`, `activity_level`, `goal_weight_kg`
- diet: `diet_type`, `diet_goal`, `dietary_restrictions` (array of strings), `target_calories`, `protein_g`, `carbs_g`, `fat_g`
- fitness: `fitness_level`, `fitness_goal`, `available_equipment`, `physical_limitations`, `workout_likes`, `workout_dislikes`, `preferred_duration_min`, `days_per_week`

Always call this tool when the user asks to change any of the above. **Do NOT** fall back to `remember` / memory notes for profile-shaped updates — that leaves the real profile stale and meal/workout plans keep ignoring the change.

For arrays (`dietary_restrictions`, `available_equipment`, `physical_limitations`, `workout_likes`, `workout_dislikes`): fetch the current list via `get_health_summary` first so you can submit a merged array rather than overwriting.

### Smart-UI action keys

The drawer may send a silent user marker like `→ {label} [action={actionKey}]` with a parenthetical system note. Map these directly to tool calls:

- `diet_profile.change_diet_type` → `update_health_profile(diet_type: ...)`
- `diet_profile.update_macros` → `update_health_profile(protein_g/carbs_g/fat_g: ...)`
- `diet_profile.set_calories` → `update_health_profile(target_calories: N)`
- `diet_profile.set_goal_weight` → `update_health_profile(goal_weight_kg: N)`
- `diet_profile.restrictions` → `update_health_profile(dietary_restrictions: [...merged])`
- `diet_profile.activity_level` → `update_health_profile(activity_level: ...)`
- `gym_profile.change_goal` → `update_health_profile(fitness_goal: ...)`
- `gym_profile.set_days` → `update_health_profile(days_per_week: N)`
- `gym_profile.set_duration` → `update_health_profile(preferred_duration_min: N)`
- `gym_profile.equipment` → `update_health_profile(available_equipment: [...merged])`
- `gym_profile.preferences` → `update_health_profile(workout_likes/workout_dislikes: [...merged])`

Explicitly confirm the update in your reply and do not invent a "saved to memory" workaround.

### log_weight

Record a weight measurement for a given date.

### complete_onboarding

Mark the health onboarding as complete. Call only after the user confirms they are ready and all required profile fields have been set.

### get_health_summary

Get the user's full health profile, recent weight entries, nutrition stats, and active sessions. This is an aggregation tool — after calling it, do NOT also call individual health data fetchers in the same turn.
