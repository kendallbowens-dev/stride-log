"use client"

import { saveSettings, type SettingsInput } from "@/app/actions/settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

interface SettingsValues {
  injuryHistory: string | null
  restingHr: number | null
  targetRace: string | null
  targetRaceDate: string | null
  weeklyMileageGoalMi: number | null
}

export function SettingsForm({ initial }: { initial: SettingsValues | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [injuryHistory, setInjuryHistory] = useState(initial?.injuryHistory ?? "")
  const [restingHr, setRestingHr] = useState(initial?.restingHr?.toString() ?? "")
  const [targetRace, setTargetRace] = useState(initial?.targetRace ?? "")
  const [targetRaceDate, setTargetRaceDate] = useState(initial?.targetRaceDate ?? "")
  const [goal, setGoal] = useState(initial?.weeklyMileageGoalMi?.toString() ?? "")

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input: SettingsInput = {
      injuryHistory: injuryHistory || null,
      restingHr: restingHr ? Number(restingHr) : null,
      targetRace: targetRace || null,
      targetRaceDate: targetRaceDate || null,
      weeklyMileageGoalMi: goal ? Number(goal) : null,
    }
    startTransition(async () => {
      await saveSettings(input)
      toast.success("Baseline saved. It will inform your next log.")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Health & training baseline</CardTitle>
        <CardDescription>
          Context the coaching agent uses to ground its recommendations. All optional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="injury">Injury history / current niggles</Label>
            <Textarea
              id="injury"
              value={injuryHistory}
              onChange={(e) => setInjuryHistory(e.target.value)}
              placeholder="e.g. Right Achilles tendinopathy in 2023; occasional ITB tightness on long runs."
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resting-hr">Resting heart rate (bpm)</Label>
            <Input
              id="resting-hr"
              type="number"
              inputMode="numeric"
              value={restingHr}
              onChange={(e) => setRestingHr(e.target.value)}
              placeholder="52"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal">Weekly mileage goal (mi)</Label>
            <Input
              id="goal"
              type="number"
              inputMode="decimal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="40"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="race">Target race</Label>
            <Input
              id="race"
              value={targetRace}
              onChange={(e) => setTargetRace(e.target.value)}
              placeholder="Chicago Marathon"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="race-date">Race date</Label>
            <Input id="race-date" type="date" value={targetRaceDate} onChange={(e) => setTargetRaceDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save baseline"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
