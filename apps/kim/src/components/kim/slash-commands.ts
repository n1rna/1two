import type { ReactNode } from "react";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckSquare,
  Dumbbell,
  Edit2,
  Flame,
  Heart,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  PieChart,
  Plus,
  RefreshCw,
  Repeat,
  Sparkles,
  Sun,
  Target,
  Trash2,
  User as UserIcon,
  UtensilsCrossed,
  Weight,
  X,
} from "lucide-react";
import { createElement } from "react";
import type { SlashCommand } from "@/components/ui/slash-commands";
import type { KimMode } from "./types";

const icon = (Icon: typeof Sun): ReactNode =>
  createElement(Icon, { className: "h-3.5 w-3.5" });

const LIFE_COMMANDS: SlashCommand[] = [
  { name: "today", label: "Plan my day", description: "Summary and plan for today", prompt: "Give me a summary of today. What's on my calendar, what routines are scheduled, and what tasks need attention? Help me plan my day.", icon: icon(Sun) },
  { name: "week", label: "Weekly overview", description: "Upcoming week with events, routines, deadlines", prompt: "Give me an overview of my upcoming week. Show my calendar events, active routines, and any tasks with deadlines this week in a table.", icon: icon(CalendarDays) },
  { name: "summary", label: "Life summary", description: "Aggregated view of routines, calendar, actionables", prompt: "Give me a quick aggregated summary of my life right now — active routines, upcoming calendar events, and any pending actionables I need to respond to.", icon: icon(LayoutDashboard) },
  { name: "calendar", label: "Calendar review", description: "Show upcoming calendar events", prompt: "Show me my upcoming calendar events for the next few days.", icon: icon(Calendar) },
  { name: "schedule", label: "Schedule something", description: "Add a new event to your calendar", prompt: "I want to schedule something on my calendar: ", icon: icon(CalendarDays) },
  { name: "reschedule", label: "Move an event", description: "Reschedule an existing calendar event", prompt: "I need to reschedule a calendar event: ", icon: icon(RefreshCw) },
  { name: "cancel", label: "Cancel an event", description: "Delete a calendar event", prompt: "Please cancel this calendar event: ", icon: icon(X) },
  { name: "routines", label: "Review routines", description: "Check active routines and habits", prompt: "List all my active routines and let me know how they're structured. Are there any improvements you'd suggest?", icon: icon(Repeat) },
  { name: "habit", label: "New routine", description: "Start tracking a new recurring routine", prompt: "I want to start a new routine: ", icon: icon(Target) },
  { name: "tasks", label: "Review tasks", description: "Pending Google Tasks and prioritize", prompt: "What tasks do I have pending? Help me prioritize them and suggest what to tackle first.", icon: icon(ListTodo) },
  { name: "task", label: "New task", description: "Add a task to your Google Tasks list", prompt: "Add this task: ", icon: icon(Plus) },
  { name: "done", label: "Mark task done", description: "Mark a Google Task as completed", prompt: "I just finished this task — mark it complete: ", icon: icon(CheckSquare) },
  { name: "actionables", label: "Pending actionables", description: "Show items waiting on your response", prompt: "What actionables are pending and waiting for me to respond?", icon: icon(AlertCircle) },
  { name: "remember", label: "Remember a fact", description: "Tell the agent something to remember", prompt: "I want you to remember this: ", icon: icon(Lightbulb) },
  { name: "forget", label: "Forget a fact", description: "Remove an outdated memory", prompt: "Please forget this about me: ", icon: icon(Trash2) },
  { name: "review", label: "Weekly review", description: "Reflect on the past week and plan ahead", prompt: "Let's do a weekly review. Summarize what happened this past week based on my routines, completed tasks, and calendar events. Then help me set intentions for next week.", icon: icon(Sparkles) },
];

const HEALTH_COMMANDS: SlashCommand[] = [
  { name: "summary", label: "Health summary", description: "Profile, weight, nutrition, active sessions", prompt: "Give me a summary of my health right now — current weight vs goal, calories and macros today, and any active workout sessions.", icon: icon(Heart) },
  { name: "weight", label: "Log weight", description: "Record today's weight measurement", prompt: "Log my weight: ", icon: icon(Weight) },
  { name: "progress", label: "Weight progress", description: "Trend versus your goal weight", prompt: "How is my weight trending compared to my goal? Show me recent entries and what direction I'm moving.", icon: icon(RefreshCw) },
  { name: "macros", label: "Macros today", description: "Calories and protein/carbs/fat breakdown", prompt: "How am I doing on calories and macros today versus my targets?", icon: icon(PieChart) },
  { name: "meal", label: "Generate meal plan", description: "Daily meal plan matching targets", prompt: "Generate a daily meal plan for today that matches my calorie target, macros, and dietary preferences.", icon: icon(UtensilsCrossed) },
  { name: "weekmeals", label: "Weekly meal plan", description: "Plan meals for the whole week", prompt: "Generate a weekly meal plan with breakfast, lunch, and dinner for each day, matching my targets and preferences.", icon: icon(UtensilsCrossed) },
  { name: "workout", label: "New workout", description: "Build a new workout session with exercises", prompt: "Create a new workout session for me. What I want: ", icon: icon(Dumbbell) },
  { name: "exercise", label: "Add exercise", description: "Add an exercise to your current workout", prompt: "Add this exercise to my current workout: ", icon: icon(Plus) },
  { name: "session", label: "Update session", description: "Change your current workout session", prompt: "Update my current workout session: ", icon: icon(Edit2) },
  { name: "profile", label: "Update health profile", description: "Body stats, diet, fitness level", prompt: "I want to update my health profile: ", icon: icon(UserIcon) },
  { name: "diet", label: "Change diet", description: "Set or change diet type and goal", prompt: "I want to change my diet — type and/or goal: ", icon: icon(Flame) },
  { name: "goal", label: "Set fitness goal", description: "Strength, hypertrophy, endurance, etc.", prompt: "I want to set my fitness goal to: ", icon: icon(Target) },
  { name: "remember", label: "Remember a fact", description: "Save a health-related fact, allergy, or injury", prompt: "Remember this about my health: ", icon: icon(Lightbulb) },
];

export function commandsForMode(mode: KimMode): SlashCommand[] {
  if (mode === "health" || mode === "meals" || mode === "gym") return HEALTH_COMMANDS;
  if (mode === "general") {
    const seen = new Set(LIFE_COMMANDS.map((c) => c.name));
    return [...LIFE_COMMANDS, ...HEALTH_COMMANDS.filter((c) => !seen.has(c.name))];
  }
  return LIFE_COMMANDS;
}
