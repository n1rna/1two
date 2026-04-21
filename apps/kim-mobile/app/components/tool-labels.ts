import type { ComponentProps } from "react"
import type { Ionicons } from "@expo/vector-icons"

// Narrow alias so consumers can pass the string name to <Ionicons name={...}>
// without a separate import.
export type IoniconsName = ComponentProps<typeof Ionicons>["name"]

export interface ToolMeta {
  label: string
  activeLabel: string
  icon: IoniconsName
}

/**
 * Mobile mirror of apps/kim/src/components/kim/tool-labels.tsx.
 * Icons are Ionicons names — rendering is left to the caller so we don't
 * have to pull lucide-react-native just for parity.
 */
export const TOOL_LABELS: Record<string, ToolMeta> = {
  remember: {
    label: "Saved to memory",
    activeLabel: "Saving to memory",
    icon: "bulb-outline",
  },
  forget: {
    label: "Removed memory",
    activeLabel: "Removing memory",
    icon: "close-outline",
  },
  create_routine: {
    label: "Created routine",
    activeLabel: "Creating routine",
    icon: "repeat-outline",
  },
  update_routine: {
    label: "Updated routine",
    activeLabel: "Updating routine",
    icon: "repeat-outline",
  },
  delete_routine: {
    label: "Removed routine",
    activeLabel: "Removing routine",
    icon: "repeat-outline",
  },
  list_routines: {
    label: "Looked up routines",
    activeLabel: "Looking up routines",
    icon: "repeat-outline",
  },
  create_actionable: {
    label: "Created actionable",
    activeLabel: "Creating actionable",
    icon: "checkbox-outline",
  },
  list_actionables: {
    label: "Looked up actionables",
    activeLabel: "Looking up actionables",
    icon: "checkbox-outline",
  },
  get_calendar_events: {
    label: "Fetched calendar",
    activeLabel: "Checking calendar",
    icon: "calendar-outline",
  },
  create_calendar_event: {
    label: "Created event",
    activeLabel: "Creating calendar event",
    icon: "calendar-outline",
  },
  update_calendar_event: {
    label: "Updated event",
    activeLabel: "Updating calendar event",
    icon: "calendar-outline",
  },
  delete_calendar_event: {
    label: "Deleted event",
    activeLabel: "Deleting calendar event",
    icon: "calendar-outline",
  },
  list_tasks: {
    label: "Fetched tasks",
    activeLabel: "Looking up tasks",
    icon: "list-outline",
  },
  create_task: {
    label: "Created task",
    activeLabel: "Creating task",
    icon: "list-outline",
  },
  complete_task: {
    label: "Completed task",
    activeLabel: "Completing task",
    icon: "checkmark-outline",
  },
  update_task: {
    label: "Updated task",
    activeLabel: "Updating task",
    icon: "list-outline",
  },
  delete_task: {
    label: "Deleted task",
    activeLabel: "Deleting task",
    icon: "list-outline",
  },
  create_task_list: {
    label: "Created task list",
    activeLabel: "Creating task list",
    icon: "list-outline",
  },
  link_event_to_routine: {
    label: "Linked event to routine",
    activeLabel: "Linking event to routine",
    icon: "calendar-outline",
  },
  update_health_profile: {
    label: "Updated health profile",
    activeLabel: "Updating health profile",
    icon: "person-outline",
  },
  log_weight: {
    label: "Logged weight",
    activeLabel: "Logging weight",
    icon: "fitness-outline",
  },
  generate_meal_plan: {
    label: "Generated meal plan",
    activeLabel: "Generating meal plan",
    icon: "restaurant-outline",
  },
  create_session: {
    label: "Created workout",
    activeLabel: "Creating workout",
    icon: "barbell-outline",
  },
  update_session: {
    label: "Updated workout",
    activeLabel: "Updating workout",
    icon: "barbell-outline",
  },
  add_exercise_to_session: {
    label: "Added exercise",
    activeLabel: "Adding exercise",
    icon: "add-outline",
  },
  remove_exercise_from_session: {
    label: "Removed exercise",
    activeLabel: "Removing exercise",
    icon: "trash-outline",
  },
  complete_onboarding: {
    label: "Onboarding complete",
    activeLabel: "Completing onboarding",
    icon: "checkmark-outline",
  },
  get_health_summary: {
    label: "Fetched health summary",
    activeLabel: "Checking health summary",
    icon: "heart-outline",
  },
  get_life_summary: {
    label: "Fetched life summary",
    activeLabel: "Checking life summary",
    icon: "grid-outline",
  },
  draft_form: {
    label: "Drafted form fields",
    activeLabel: "Drafting form",
    icon: "create-outline",
  },
  dismiss_actionables: {
    label: "Dismissed actionables",
    activeLabel: "Dismissing actionables",
    icon: "close-outline",
  },
}

export function toolMeta(tool: string): ToolMeta {
  return (
    TOOL_LABELS[tool] ?? {
      label: tool,
      activeLabel: tool,
      icon: "cog-outline",
    }
  )
}
