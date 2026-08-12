import { getAnalysis } from "@/lib/get-analysis"
import { getStravaStatus } from "@/app/actions/strava"
import { getLatestLog, getNotionStatus } from "@/app/actions/log"
import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { OWNER_ID } from "@/lib/owner"
import { eq } from "drizzle-orm"
import { DataControls } from "@/components/data-controls"
import { SettingsForm } from "@/components/settings-form"
import { LoadCharts } from "@/components/load-charts"
import { ThisWeeksCall, WeeklyTimeline } from "@/components/week-summary"
import { LogPanel } from "@/components/log-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity } from "lucide-react"

export default async function DashboardPage() {
  const [{ weeks, activityCount }, strava, notion, latestLog, settingsRows] = await Promise.all([
    getAnalysis(),
    getStravaStatus(),
    getNotionStatus(),
    getLatestLog(),
    db.select().from(settings).where(eq(settings.ownerId, OWNER_ID)).limit(1),
  ])

  const s = settingsRows[0]
  const settingsValues = s
    ? {
        injuryHistory: s.injuryHistory,
        restingHr: s.restingHr,
        targetRace: s.targetRace,
        targetRaceDate: s.targetRaceDate ? String(s.targetRaceDate) : null,
        weeklyMileageGoalMi: s.weeklyMileageGoalMi,
      }
    : null

  const currentWeek = weeks[weeks.length - 1] ?? null
  const hasData = activityCount > 0 && currentWeek

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <Activity className="size-5" />
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Pace &amp; Load Agent
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
          Running log &amp; training-load coach
        </h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Pulls your Runna runs from Strava, tracks acute vs. chronic workload and pace trends, and flags exactly when
          to cut back or ramp up — then writes a narrative log to Notion.
        </p>
      </header>

      {hasData ? (
        <>
          <ThisWeeksCall week={currentWeek} />
          <LoadCharts weeks={weeks} />
          <LogPanel
            initialMarkdown={latestLog?.generatedMarkdown ?? null}
            initialSyncedAt={latestLog?.syncedAt ? latestLog.syncedAt.toISOString() : null}
            notionConnected={notion.connected}
            hasActivities={activityCount > 0}
          />
          <WeeklyTimeline weeks={weeks} />
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
          <h2 className="text-lg font-medium">No training data yet</h2>
          <p className="mx-auto mt-1 max-w-md text-pretty text-sm text-muted-foreground">
            Connect Strava, import a CSV of your runs, or load sample data below to see your weekly load analysis and
            cut-back / ramp-up flags.
          </p>
        </div>
      )}

      <Tabs defaultValue="data" className="w-full">
        <TabsList>
          <TabsTrigger value="data">Data sources</TabsTrigger>
          <TabsTrigger value="baseline">Health baseline</TabsTrigger>
        </TabsList>
        <TabsContent value="data" className="mt-4">
          <DataControls strava={strava} activityCount={activityCount} />
        </TabsContent>
        <TabsContent value="baseline" className="mt-4">
          <SettingsForm initial={settingsValues} />
        </TabsContent>
      </Tabs>
    </main>
  )
}
