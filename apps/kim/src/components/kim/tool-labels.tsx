import type { ReactNode } from "react";
import {
  CalendarDays,
  Check,
  CheckSquare,
  Dumbbell,
  Heart,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  Plus,
  Repeat,
  Settings,
  Trash2,
  User as UserIcon,
  UtensilsCrossed,
  Weight,
  X,
} from "lucide-react";

export interface ToolMeta {
  label: string;
  activeLabel: string;
  icon: ReactNode;
}

export const TOOL_LABELS: Record<string, ToolMeta> = {
  remember: { label: "Saved to memory", activeLabel: "Saving to memory", icon: <Lightbulb className="size-3.5" /> },
  forget: { label: "Removed memory", activeLabel: "Removing memory", icon: <X className="size-3.5" /> },
  create_routine: { label: "Created routine", activeLabel: "Creating routine", icon: <Repeat className="size-3.5" /> },
  update_routine: { label: "Updated routine", activeLabel: "Updating routine", icon: <Repeat className="size-3.5" /> },
  delete_routine: { label: "Removed routine", activeLabel: "Removing routine", icon: <Repeat className="size-3.5" /> },
  list_routines: { label: "Looked up routines", activeLabel: "Looking up routines", icon: <Repeat className="size-3.5" /> },
  create_actionable: { label: "Created actionable", activeLabel: "Creating actionable", icon: <CheckSquare className="size-3.5" /> },
  list_actionables: { label: "Looked up actionables", activeLabel: "Looking up actionables", icon: <CheckSquare className="size-3.5" /> },
  get_calendar_events: { label: "Fetched calendar", activeLabel: "Checking calendar", icon: <CalendarDays className="size-3.5" /> },
  create_calendar_event: { label: "Created event", activeLabel: "Creating calendar event", icon: <CalendarDays className="size-3.5" /> },
  update_calendar_event: { label: "Updated event", activeLabel: "Updating calendar event", icon: <CalendarDays className="size-3.5" /> },
  delete_calendar_event: { label: "Deleted event", activeLabel: "Deleting calendar event", icon: <CalendarDays className="size-3.5" /> },
  list_tasks: { label: "Fetched tasks", activeLabel: "Looking up tasks", icon: <ListTodo className="size-3.5" /> },
  create_task: { label: "Created task", activeLabel: "Creating task", icon: <ListTodo className="size-3.5" /> },
  complete_task: { label: "Completed task", activeLabel: "Completing task", icon: <Check className="size-3.5" /> },
  update_task: { label: "Updated task", activeLabel: "Updating task", icon: <ListTodo className="size-3.5" /> },
  delete_task: { label: "Deleted task", activeLabel: "Deleting task", icon: <ListTodo className="size-3.5" /> },
  create_task_list: { label: "Created task list", activeLabel: "Creating task list", icon: <ListTodo className="size-3.5" /> },
  link_event_to_routine: { label: "Linked event to routine", activeLabel: "Linking event to routine", icon: <CalendarDays className="size-3.5" /> },
  update_health_profile: { label: "Updated health profile", activeLabel: "Updating health profile", icon: <UserIcon className="size-3.5" /> },
  log_weight: { label: "Logged weight", activeLabel: "Logging weight", icon: <Weight className="size-3.5" /> },
  generate_meal_plan: { label: "Generated meal plan", activeLabel: "Generating meal plan", icon: <UtensilsCrossed className="size-3.5" /> },
  create_session: { label: "Created workout", activeLabel: "Creating workout", icon: <Dumbbell className="size-3.5" /> },
  update_session: { label: "Updated workout", activeLabel: "Updating workout", icon: <Dumbbell className="size-3.5" /> },
  add_exercise_to_session: { label: "Added exercise", activeLabel: "Adding exercise", icon: <Plus className="size-3.5" /> },
  remove_exercise_from_session: { label: "Removed exercise", activeLabel: "Removing exercise", icon: <Trash2 className="size-3.5" /> },
  complete_onboarding: { label: "Onboarding complete", activeLabel: "Completing onboarding", icon: <Check className="size-3.5" /> },
  get_health_summary: { label: "Fetched health summary", activeLabel: "Checking health summary", icon: <Heart className="size-3.5" /> },
  get_life_summary: { label: "Fetched life summary", activeLabel: "Checking life summary", icon: <LayoutDashboard className="size-3.5" /> },
  draft_form: { label: "Drafted form fields", activeLabel: "Drafting form", icon: <Plus className="size-3.5" /> },
  dismiss_actionables: { label: "Dismissed actionables", activeLabel: "Dismissing actionables", icon: <X className="size-3.5" /> },
};

export function toolMeta(tool: string): ToolMeta {
  return (
    TOOL_LABELS[tool] ?? {
      label: tool,
      activeLabel: tool,
      icon: <Settings className="size-3.5" />,
    }
  );
}

export const READ_ONLY_TOOLS = new Set([
  "list_routines",
  "list_actionables",
  "get_calendar_events",
  "list_tasks",
]);

export const THINKING_PHRASES = [
  "Accomplishing", "Actioning", "Architecting", "Brewing", "Calculating",
  "Cerebrating", "Channelling", "Cogitating", "Composing", "Computing",
  "Concocting", "Considering", "Contemplating", "Cooking", "Crafting",
  "Creating", "Crystallizing", "Deliberating", "Determining", "Elucidating",
  "Envisioning", "Forging", "Forming", "Generating", "Hatching", "Ideating",
  "Imagining", "Improvising", "Incubating", "Infusing", "Kneading",
  "Manifesting", "Marinating", "Musing", "Orchestrating", "Percolating",
  "Pondering", "Processing", "Puzzling", "Ruminating", "Scheming",
  "Sketching", "Stewing", "Sussing", "Synthesizing", "Thinking",
  "Tinkering", "Unravelling", "Weaving", "Working", "Wrangling",
];
