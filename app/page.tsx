import { getAnalysis } from "@/lib/get-analysis"
import { getStravaStatus } from "@/app/actions/strava"
import { getLatestLog } from "@/app/actions/log"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { DataControls } from "@/components/data-controls"
import { SettingsForm } from "@/components/settings-form"
import { LoadCharts } from "@/components/load-charts"
import { ThisWeeksCall, WeeklyTimeline } from "@/components/week-summary"
import { DisciplineSummary } from "@/components/discipline-summary"
import { LogPanel } from "@/components/log-panel"
import { AccountMenu } from "@/components/account-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Footprints, PersonStanding, Dumbbell, Flower2, Settings } from "lucide-react"
import Image from "next/image"

// This dashboard reads per-request data (database state + Vercel Connect tokens),
// so it must render at request time rather than being prerendered at build time.
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")
  const ownerId = session.user.id

  const [{ weeks, activityCount, totalCount, hasRealData, runWorkouts, disciplines }, strava, latestLog, settingsRows] =
    await Promise.all([
      getAnalysis(ownerId),
      getStravaStatus(),
      getLatestLog(),
      db.select().from(settings).where(eq(settings.ownerId, ownerId)).limit(1),
    ])

  const s = settingsRows[0]
  const settingsValues = s
    ? {
        injuryHistory: s.injuryHistory,
        restingHr: s.restingHr,
        targetRace: s.targetRace,
        targetRaceDate: s.targetRaceDate ? String(s.targetRaceDate) : null,
        weeklyMileageGoalMi: s.weeklyMileageGoalMi,
        phoneNumber: s.phoneNumber,
        smsRecapEnabled: s.smsRecapEnabled,
      }
    : null

  const currentWeek = weeks[weeks.length - 1] ?? null
  // Only populate the dashboard from real, connected data (Strava / imported runs).
  // Sample-only data does not drive the summary, charts, or log.
  const hasData = hasRealData && currentWeek

  const disciplineByKey = Object.fromEntries(disciplines.map((d) => [d.discipline, d]))

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-0 md:px-6 md:pb-10 md:pt-10">
      <header className="flex flex-col gap-3 md:gap-2">
        {/* Sticky, compact top bar on mobile; plain inline row on desktop. */}
        <div className="sticky top-0 z-40 -mx-4 flex items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none">
          <div className="flex items-center gap-2 text-primary">
            <Image
              src="/app-icon.png"
              alt="RampWise logo"
              width={28}
              height={28}
              priority
              className="size-7 rounded-lg ring-1 ring-border"
            />
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Pace &amp; Load Agent
            </span>
          </div>
          <AccountMenu email={session.user.email} name={session.user.name} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            Training log &amp; multi-sport load coach
          </h1>
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Pulls your Strava activities, tracks acute vs. chronic workload for each discipline, and tells you exactly
            what to adjust — cut back, hold, or ramp up — then writes a narrative running log.
          </p>
        </div>
      </header>

      <Tabs defaultValue="running" className="w-full">
        {/* Desktop: inline top tabs. */}
        <TabsList className="hidden flex-wrap md:inline-flex">
          <TabsTrigger value="running">Running</TabsTrigger>
          <TabsTrigger value="walking">Walking</TabsTrigger>
          <TabsTrigger value="strength">Strength</TabsTrigger>
          <TabsTrigger value="yoga">Yoga</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>

        {/* Mobile: fixed native-style bottom tab bar with icons. */}
        <TabsList className="fixed inset-x-0 bottom-0 z-50 !h-auto !w-full items-stretch justify-around gap-0 !rounded-none border-t border-border !bg-card/95 !p-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
          {[
            { value: "running", label: "Running", Icon: Footprints },
            { value: "walking", label: "Walking", Icon: PersonStanding },
            { value: "strength", label: "Strength", Icon: Dumbbell },
            { value: "yoga", label: "Yoga", Icon: Flower2 },
            { value: "setup", label: "Setup", Icon: Settings },
          ].map(({ value, label, Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="!flex-col gap-1 !rounded-none !bg-transparent px-1 py-2.5 text-[10px] font-medium tracking-tight data-active:!bg-transparent data-active:!text-primary"
            >
              <Icon className="size-5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="running" className="mt-4">
          {hasData ? (
            <div className="flex flex-col gap-6">
              <ThisWeeksCall week={currentWeek} workouts={runWorkouts} />
              <LoadCharts weeks={weeks} />
              <LogPanel initialMarkdown={latestLog?.generatedMarkdown ?? null} hasActivities={activityCount > 0} />
              <WeeklyTimeline weeks={weeks} workouts={runWorkouts} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
              <h2 className="text-lg font-medium">No running data yet</h2>
              <p className="mx-auto mt-1 max-w-md text-pretty text-sm text-muted-foreground">
                Connect your Strava account or import a CSV of your runs from the Setup tab to see your weekly load
                analysis and cut-back / ramp-up flags.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="walking" className="mt-4">
          <DisciplineSummary analysis={disciplineByKey.walking} />
        </TabsContent>
        <TabsContent value="strength" className="mt-4">
          <DisciplineSummary analysis={disciplineByKey.strength} />
        </TabsContent>
        <TabsContent value="yoga" className="mt-4">
          <DisciplineSummary analysis={disciplineByKey.yoga} />
        </TabsContent>

        <TabsContent value="setup" className="mt-4">
          <div className="flex flex-col gap-6">
            <DataControls strava={strava} activityCount={activityCount} totalCount={totalCount} />
            <SettingsForm initial={settingsValues} />
          </div>
        </TabsContent>
      </Tabs>
    </main>
  )
}
