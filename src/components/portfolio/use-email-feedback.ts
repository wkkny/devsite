import { useEffect, useRef, useState } from 'react'

import type { MailClient } from '@/components/portfolio/mail-clients'

export type Feedback =
  | { kind: 'idle' }
  | { kind: 'error' }
  | { kind: 'copied' }
  | { kind: 'opened'; client: MailClient }
  | { kind: 'no-mail-app' }

// How long the browser has to give way to a mail app before we suspect none answered the mailto.
// Chrome and Firefox may first ask in-page whether to open it, which doesn't blur the page, so
// the result is offered as a question with a way out, and withdrawn if the app opens after all.
const MAIL_APP_GRACE_MS = 2500

// What the email pill is reporting, how long it stays up, and what screen readers hear about it.
export function useEmailFeedback() {
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' })
  // Counts each copy or send, so doing it again re-pops the icon and is announced again.
  const [feedbackCount, setFeedbackCount] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  // What the pill is showing, for handlers that outlive the render they came from.
  const feedbackKind = useRef<Feedback['kind']>('idle')
  useEffect(() => {
    feedbackKind.current = feedback.kind
  })
  // Whether the visitor is pointing at or focused on the copy offer, which holds it open.
  const offerHeld = useRef({ hover: false, focus: false })
  const stopFeedbackTimer = useRef<(() => void) | null>(null)
  const stopMailAppCheck = useRef<(() => void) | null>(null)

  useEffect(() => () => {
    stopFeedbackTimer.current?.()
    stopMailAppCheck.current?.()
  }, [])

  function clearFeedbackTimeout() {
    stopFeedbackTimer.current?.()
    stopFeedbackTimer.current = null
  }

  // Every new action starts clean: no earlier result timing out on it, no earlier check reporting.
  function cancel() {
    clearFeedbackTimeout()
    stopMailAppCheck.current?.()
  }

  function show(next: Feedback, message: string, duration = 1800) {
    clearFeedbackTimeout()
    setFeedback(next)
    setFeedbackCount((count) => count + 1)
    // Clear, then set on the next frame, so a repeat is announced instead of ignored.
    setAnnouncement('')
    requestAnimationFrame(() => setAnnouncement(message))
    startFeedbackTimer(duration)
  }

  // Stays up until the next action, unlike `show`.
  function showError(message: string) {
    setFeedback({ kind: 'error' })
    setAnnouncement(message)
  }

  function reset() {
    setFeedback({ kind: 'idle' })
  }

  // The result stays up for `duration` of the visitor actually looking at it: one sent off to a
  // webmail tab waits for them to come back before it starts to count down.
  function startFeedbackTimer(duration: number) {
    clearFeedbackTimeout()
    if (document.hidden || !document.hasFocus()) {
      const resume = () => {
        if (document.hidden) return
        stopWaitingForReturn()
        startFeedbackTimer(duration)
      }
      const stopWaitingForReturn = () => {
        window.removeEventListener('focus', resume)
        document.removeEventListener('visibilitychange', resume)
      }
      window.addEventListener('focus', resume)
      document.addEventListener('visibilitychange', resume)
      stopFeedbackTimer.current = stopWaitingForReturn
      return
    }
    const timeout = window.setTimeout(() => {
      stopFeedbackTimer.current = null
      setFeedback({ kind: 'idle' })
    }, duration)
    stopFeedbackTimer.current = () => window.clearTimeout(timeout)
  }

  // A mail app taking over blurs or hides the page. If neither happens in time, offer the copy
  // instead of claiming something opened; if the app turns up late, take the offer back.
  function watchForMailApp() {
    let answered = false
    let offered = false
    const onLeave = () => {
      answered = true
      if (!offered) return
      stop()
      clearFeedbackTimeout()
      setFeedback({ kind: 'idle' })
    }
    const timeout = window.setTimeout(() => {
      if (answered) {
        stop()
        return
      }
      offered = true
      offerHeld.current = { hover: false, focus: false }
      show({ kind: 'no-mail-app' }, 'Did your mail app open? If not, copy the address instead.', 6000)
    }, MAIL_APP_GRACE_MS)
    function stop() {
      window.clearTimeout(timeout)
      window.removeEventListener('blur', onLeave)
      document.removeEventListener('visibilitychange', onLeave)
      stopMailAppCheck.current = null
    }
    window.addEventListener('blur', onLeave)
    document.addEventListener('visibilitychange', onLeave)
    stopMailAppCheck.current = stop
  }

  // The offer never times out from under someone using it; once they move on, it gives them a
  // few more seconds.
  function holdOffer(key: 'hover' | 'focus', held: boolean) {
    if (feedbackKind.current !== 'no-mail-app') return
    offerHeld.current[key] = held
    if (offerHeld.current.hover || offerHeld.current.focus) clearFeedbackTimeout()
    else startFeedbackTimer(3000)
  }

  return { feedback, feedbackCount, announcement, show, showError, reset, cancel, watchForMailApp, holdOffer }
}
