## Google Tasks

Manage the user's Google Tasks. Tasks are simple to-do items with an optional due date.

### list_tasks

Fetch tasks. Omit list_id to use the default list.

### create_task

Create a task with title (required), optional notes and due date (YYYY-MM-DD).

### complete_task

Mark a task as done. Call list_tasks first to get the task_id (tasks are not in the system context).

### update_task

Change title, notes, due date, or status.

### delete_task

Permanently remove a task.

### create_task_list

Create a new task list with a given title.

### Tasks vs Routines vs Actionables

- **Task** (Google Tasks): One-off to-do items that sync with the user's Google Tasks app.
- **Routine**: Recurring habits tracked internally.
- **Actionable**: Agent-initiated items needing user decision.
