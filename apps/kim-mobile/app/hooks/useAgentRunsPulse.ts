import { useEffect, useRef, useState } from "react"
import { AppState, type AppStateStatus } from "react-native"
import { getLifeAgentRunsPulse } from "@1tt/api-client/life"

/**
 * useAgentRunsPulse polls /life/agent-runs/pulse so the mobile header can
 * show a small teal dot whenever the signed-in user has any background
 * agent work in flight (journey runs, actionable follow-ups, scheduler
 * cycles).
 *
 * Port of apps/kim/src/components/kim/use-agent-runs-pulse.tsx with one
 * mobile-only addition: polling pauses while the app is backgrounded, so
 * we don't burn radio cycles when the user isn't looking.
 *
 * Cadence:
 *   - `active === true` and something running → 5s
 *   - otherwise (idle or inactive screen) → 30s
 *   - app in background → paused
 *
 * Errors are swallowed — the pulse is a cue, not a hard dependency.
 */
export function useAgentRunsPulse(opts?: { active?: boolean }): {
  running: boolean
  count: number
} {
  const { active = true } = opts ?? {}
  const [running, setRunning] = useState(false)
  const [count, setCount] = useState(0)
  const [appActive, setAppActive] = useState<boolean>(
    AppState.currentState === "active",
  )
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Pause polling while the OS has backgrounded the app.
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      setAppActive(state === "active")
    }
    const sub = AppState.addEventListener("change", handler)
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!appActive) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await getLifeAgentRunsPulse()
        if (cancelled || !mounted.current) return
        setRunning(res.running)
        setCount(res.count)
      } catch {
        // best-effort; keep last known value.
      }
    }
    void tick()
    const interval = running && active ? 5000 : 30000
    const h = setInterval(() => void tick(), interval)
    return () => {
      cancelled = true
      clearInterval(h)
    }
  }, [active, running, appActive])

  return { running, count }
}
