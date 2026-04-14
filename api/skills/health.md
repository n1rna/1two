## Health profile & tracking

Manage the user's health and fitness profile, weight tracking, and onboarding.

### update_health_profile

Update body stats, diet type, diet goal, fitness level, equipment, physical limitations, workout preferences, and more.

### log_weight

Record a weight measurement for a given date.

### complete_onboarding

Mark the health onboarding as complete. Call only after the user confirms they are ready and all required profile fields have been set.

### get_health_summary

Get the user's full health profile, recent weight entries, nutrition stats, and active sessions. This is an aggregation tool — after calling it, do NOT also call individual health data fetchers in the same turn.
