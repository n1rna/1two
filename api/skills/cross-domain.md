## Cross-domain tools

These tools let you fetch data from a domain outside the current conversation scope.

### get_health_summary

Get the user's health profile, recent weight entries, nutrition stats, and active sessions. Use when the user asks about health data in a life-focused conversation.

### get_life_summary

Get upcoming calendar events, active routines, and pending actionables count. Use when the user asks about their schedule or routines in a health-focused conversation.

IMPORTANT: These are aggregation tools — their result already contains everything from the underlying fetchers. After calling get_life_summary, do NOT also call get_calendar_events / list_routines / list_actionables in the same turn. After calling get_health_summary, do NOT also call list_tasks or refetch the health profile. Use the aggregated result and answer the user.
