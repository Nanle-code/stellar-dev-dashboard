/**
 * Behavioral Data Collector
 *
 * Captures user interaction signals during transaction signing:
 * - Keystroke timing (dwell/flight times)
 * - Mouse movement velocity and acceleration
 * - Session-level behavioral metadata
 */

export interface BehavioralSample {
  keystrokeDurations: number[]     // key dwell times (ms)
  keystrokeIntervals: number[]     // inter-key intervals (ms)
  mouseVelocities: number[]        // consecutive mouse velocities (px/ms)
  mouseAccelerations: number[]     // consecutive velocity deltas
  sessionDuration: number          // total ms from startSession to stopSession
  focusChanges: number             // number of blur/focus events
  pasteEvents: number              // number of paste events
  backspaceCount: number           // number of backspace/delete presses
  totalKeystrokes: number          // total key-press events
  timeToFirstKeystroke: number     // ms between session start and first keydown
  timestamp: number                // when the sample was collected (epoch ms)
}

interface MousePoint {
  x: number
  y: number
  t: number
}

export class BehavioralDataCollector {
  private _active = false
  private _startTime = 0
  private _firstKeystrokeTime = 0
  private _keyDownMap = new Map<string, number>()
  private _keystrokeDurations: number[] = []
  private _keystrokeIntervals: number[] = []
  private _lastKeyDownTime = 0
  private _mousePoints: MousePoint[] = []
  private _mouseVelocities: number[] = []
  private _mouseAccelerations: number[] = []
  private _focusChanges = 0
  private _pasteEvents = 0
  private _backspaceCount = 0
  private _totalKeystrokes = 0
  private _abortController: AbortController | null = null

  isActive(): boolean {
    return this._active
  }

  startSession(): void {
    if (this._active) this.stopSession()

    this._active = true
    this._startTime = Date.now()
    this._firstKeystrokeTime = 0
    this._keyDownMap.clear()
    this._keystrokeDurations = []
    this._keystrokeIntervals = []
    this._lastKeyDownTime = 0
    this._mousePoints = []
    this._mouseVelocities = []
    this._mouseAccelerations = []
    this._focusChanges = 0
    this._pasteEvents = 0
    this._backspaceCount = 0
    this._totalKeystrokes = 0

    if (typeof window === 'undefined') return

    this._abortController = new AbortController()
    const { signal } = this._abortController

    document.addEventListener('keydown', this._onKeyDown, { signal, capture: true })
    document.addEventListener('keyup', this._onKeyUp, { signal, capture: true })
    document.addEventListener('mousemove', this._onMouseMove, { signal, passive: true })
    document.addEventListener('paste', this._onPaste, { signal, capture: true })
    window.addEventListener('focus', this._onFocus, { signal })
    window.addEventListener('blur', this._onBlur, { signal })
  }

  stopSession(): BehavioralSample {
    this._active = false
    this._abortController?.abort()
    this._abortController = null

    const sessionDuration = Date.now() - this._startTime

    // Compute mouse derived signals
    this._computeMouseSignals()

    const sample: BehavioralSample = {
      keystrokeDurations: [...this._keystrokeDurations],
      keystrokeIntervals: [...this._keystrokeIntervals],
      mouseVelocities: [...this._mouseVelocities],
      mouseAccelerations: [...this._mouseAccelerations],
      sessionDuration,
      focusChanges: this._focusChanges,
      pasteEvents: this._pasteEvents,
      backspaceCount: this._backspaceCount,
      totalKeystrokes: this._totalKeystrokes,
      timeToFirstKeystroke: this._firstKeystrokeTime > 0
        ? this._firstKeystrokeTime - this._startTime
        : sessionDuration,
      timestamp: Date.now(),
    }

    return sample
  }

  // ─── Private event handlers ───────────────────────────────────────────────

  private _onKeyDown = (e: KeyboardEvent): void => {
    const now = Date.now()
    this._totalKeystrokes++

    if (this._firstKeystrokeTime === 0) {
      this._firstKeystrokeTime = now
    }

    if (this._lastKeyDownTime > 0) {
      this._keystrokeIntervals.push(now - this._lastKeyDownTime)
    }
    this._lastKeyDownTime = now

    this._keyDownMap.set(e.code, now)

    if (e.key === 'Backspace' || e.key === 'Delete') {
      this._backspaceCount++
    }
  }

  private _onKeyUp = (e: KeyboardEvent): void => {
    const now = Date.now()
    const downTime = this._keyDownMap.get(e.code)
    if (downTime !== undefined) {
      const duration = now - downTime
      if (duration > 0 && duration < 2000) {
        this._keystrokeDurations.push(duration)
      }
      this._keyDownMap.delete(e.code)
    }
  }

  private _onMouseMove = (e: MouseEvent): void => {
    this._mousePoints.push({ x: e.clientX, y: e.clientY, t: Date.now() })
    // Keep only last 200 points to bound memory
    if (this._mousePoints.length > 200) {
      this._mousePoints.shift()
    }
  }

  private _onPaste = (): void => {
    this._pasteEvents++
  }

  private _onFocus = (): void => {
    this._focusChanges++
  }

  private _onBlur = (): void => {
    this._focusChanges++
  }

  private _computeMouseSignals(): void {
    const pts = this._mousePoints
    if (pts.length < 2) return

    const velocities: number[] = []
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x
      const dy = pts[i].y - pts[i - 1].y
      const dt = pts[i].t - pts[i - 1].t
      if (dt > 0) {
        velocities.push(Math.sqrt(dx * dx + dy * dy) / dt)
      }
    }
    this._mouseVelocities = velocities

    const accels: number[] = []
    for (let i = 1; i < velocities.length; i++) {
      accels.push(Math.abs(velocities[i] - velocities[i - 1]))
    }
    this._mouseAccelerations = accels
  }
}

export function createCollector(): BehavioralDataCollector {
  return new BehavioralDataCollector()
}
