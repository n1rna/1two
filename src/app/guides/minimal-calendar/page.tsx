import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "minimal-calendar";

export const metadata = guideMetadata({
  slug,
  title: "A Calendar for Quick Planning",
  description:
    "A minimal, distraction-free calendar for when you need to plan something fast without opening your personal calendar.",
  keywords: [
    "calendar",
    "minimal calendar",
    "quick planning",
    "milestone",
    "timeline",
    "date range",
    "project planning",
  ],
});

export default function MinimalCalendarGuide() {
  const jsonLd = guideJsonLd(slug);
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <GuideLayout slug={slug}>
        <Guide.H2>Not another calendar app</Guide.H2>
        <Guide.P>
          You don&apos;t always need your full calendar. Sometimes you just want to
          count the days between two dates, figure out which week a deadline falls on,
          or sketch out a rough timeline for a project. Opening Google Calendar or
          Outlook for that means signing in, waiting for it to load, and getting
          distracted by all the meetings you&apos;d rather not think about.
        </Guide.P>
        <Guide.P>
          The 1tt.dev <Guide.Strong>Calendar</Guide.Strong> is built for those moments.
          It opens instantly, has no accounts to connect, and focuses on one thing:
          letting you look at dates and mark things on them.
        </Guide.P>

        <Guide.H2>What it&apos;s good at</Guide.H2>

        <Guide.H3>Counting days</Guide.H3>
        <Guide.P>
          Drag across any range of days to select them. The sidebar instantly shows you
          how many days you&apos;ve selected, how many are weekdays vs weekends, and the
          exact date range. No mental math, no Googling &quot;days between two dates.&quot;
        </Guide.P>

        <Guide.H3>Marking milestones</Guide.H3>
        <Guide.P>
          Select a date range and create a <Guide.Strong>marker</Guide.Strong> — give it
          a label and a color. Markers span across the calendar cells so you can
          visualize how long something takes and how different things overlap.
        </Guide.P>
        <Guide.P>
          This is useful for rough project timelines: mark your sprints, deadlines,
          vacations, or release windows. You get a visual sense of the plan without
          building a full Gantt chart.
        </Guide.P>

        <Guide.H3>Zooming in and out</Guide.H3>
        <Guide.P>
          Five views let you look at time at different scales:
        </Guide.P>
        <Guide.UL>
          <li><Guide.Strong>Day</Guide.Strong> — 24-hour timeline with a live &quot;now&quot; indicator</li>
          <li><Guide.Strong>Week</Guide.Strong> — 7-day grid with hourly rows</li>
          <li><Guide.Strong>Month</Guide.Strong> — the classic month grid, showing markers that span across days</li>
          <li><Guide.Strong>Quarter</Guide.Strong> — 3 months side by side for mid-range planning</li>
          <li><Guide.Strong>Year</Guide.Strong> — all 12 months at once for the big picture</li>
        </Guide.UL>
        <Guide.P>
          Switch between them to plan at whatever granularity makes sense. Quarter view
          is especially useful for roadmap-style planning where you need to see a few
          months at a glance.
        </Guide.P>

        <Guide.H2>When to use it</Guide.H2>

        <Guide.H3>Quick date math</Guide.H3>
        <Guide.P>
          &quot;How many working days until the deadline?&quot; &quot;What day of the week is March
          15th?&quot; &quot;If I start on Monday and need 10 business days, when does it
          end?&quot; — select, read the sidebar, done.
        </Guide.P>

        <Guide.H3>Sketching a project timeline</Guide.H3>
        <Guide.P>
          You&apos;re in a meeting or planning session and need to map out rough phases.
          Open the calendar, mark the key dates with colored markers, and you have a
          visual timeline in seconds. Share your screen — everyone can see it.
        </Guide.P>

        <Guide.H3>Avoiding your real calendar</Guide.H3>
        <Guide.P>
          Sometimes you need a calendar view that&apos;s not tied to your email or work
          account. Planning a personal trip, checking holiday dates, or figuring out a
          side project schedule — things that don&apos;t belong in your work calendar and
          don&apos;t need the overhead of a calendar app.
        </Guide.P>

        <Guide.H3>Sprint and release planning</Guide.H3>
        <Guide.P>
          Mark your sprints, code freezes, and release dates. The summary in the sidebar
          shows you the total span, how markers overlap, and how many days each phase
          covers. It&apos;s lighter than a project management tool but more visual than a
          spreadsheet.
        </Guide.P>

        <Guide.H2>State and sync</Guide.H2>
        <Guide.P>
          Markers are saved to <Guide.Code>localStorage</Guide.Code> automatically, so
          they survive page reloads. If you&apos;re signed in, you can enable{" "}
          <Guide.Strong>cloud sync</Guide.Strong> to keep your markers across devices.
          The calendar is always ready when you come back.
        </Guide.P>
        <Guide.P>
          There&apos;s no import/export, no iCal integration, no event invites. That&apos;s
          the point — it&apos;s a calendar you can use without any setup, for the kind
          of planning that doesn&apos;t need a full productivity suite.
        </Guide.P>
      </GuideLayout>
    </>
  );
}
