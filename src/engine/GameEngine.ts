import { NoteTrack, nextNoteId, type NoteData } from './NoteTrack'
import { ScoreManager } from './Score'
import { nextJudgeId, type JudgeResult } from './Judge'

export type GameState = {
  gameTimeMs: number
  visibleNotes: NoteData[]
  combo: number
  accuracy: number
  maxCombo: number
  judgeResult: JudgeResult | null
  pressedLanes: boolean[]
  playing: boolean
  finished: boolean
}

export type GameConfig = {
  keys: number
  approachTimeMs: number
}

type BeatmapEntry = [number, number, number]

export class GameEngine {
  private noteTrack = new NoteTrack()
  private scoreManager = new ScoreManager()
  private rafId = 0
  private _state: GameState
  private config: GameConfig
  private onUpdate: ((state: GameState) => void) | null = null
  private onFinish: (() => void) | null = null
  private lastNoteTime = 0
  private judgeResultClearTimer = 0
  private started = false
  private engineStartTime = 0
  private initialApproachTimeMs: number

  constructor(config: GameConfig) {
    this.config = config
    this.initialApproachTimeMs = config.approachTimeMs
    this._state = {
      gameTimeMs: -config.approachTimeMs,
      visibleNotes: [],
      combo: 0,
      accuracy: 100,
      maxCombo: 0,
      judgeResult: null,
      pressedLanes: new Array(config.keys).fill(false),
      playing: false,
      finished: false,
    }
  }

  loadBeatmap(entries: BeatmapEntry[]) {
    const notes: NoteData[] = entries.map(([lane, time, endTime]) => ({
      id: nextNoteId(),
      lane,
      time,
      endTime,
      judged: false,
      holding: false,
      holdStartJudge: null,
      lastTickTime: 0,
    }))
    this.noteTrack.load(notes)
    // lastNoteTime: 롱노트면 endTime, 아니면 time
    this.lastNoteTime = Math.max(...entries.map(([, t, e]) => (e > 0 ? e : t)))
  }

  setOnUpdate(cb: (state: GameState) => void) { this.onUpdate = cb }
  setOnFinish(cb: () => void) { this.onFinish = cb }

  start() {
    if (this.started) return
    this.started = true
    this._state.playing = true
    this.engineStartTime = performance.now()
    this.loop()
  }

  stop() {
    cancelAnimationFrame(this.rafId)
    this.started = false
    this._state.playing = false
  }

  getGameTime(): number {
    if (!this.started) return -this.initialApproachTimeMs
    return performance.now() - this.engineStartTime - this.initialApproachTimeMs
  }

  private loop = () => {
    const gameTimeMs = this.getGameTime()
    this._state.gameTimeMs = gameTimeMs

    if (gameTimeMs > 0) {
      // 일반 노트 MISS
      const missed = this.noteTrack.collectMisses(gameTimeMs)
      if (missed.length > 0) {
        for (const note of missed) {
          this.scoreManager.push('MISS')
          // 롱노트를 아예 안 누른 경우, 전체 틱 수만큼 추가 MISS
          if (note.endTime > 0) {
            const totalTicks = Math.floor((note.endTime - note.time) / 100)
            for (let t = 0; t < totalTicks; t++) {
              this.scoreManager.push('MISS')
            }
          }
        }
        this._state.judgeResult = { id: nextJudgeId(), type: 'MISS' }
        this.syncScore()
        this.onUpdate?.(this._state)
        this.scheduleJudgeClear()
      }

      // 롱노트 홀드 틱 판정 (100ms마다 PERFECT)
      const ticks = this.noteTrack.collectHoldTicks(gameTimeMs)
      if (ticks.length > 0) {
        for (const { type } of ticks) {
          this.scoreManager.push(type)
        }
        // 마지막 틱의 판정만 표시
        this._state.judgeResult = { id: nextJudgeId(), type: ticks[ticks.length - 1].type }
        this.syncScore()
        this.onUpdate?.(this._state)
        this.scheduleJudgeClear()
      }

      // 롱노트 자동 완료 (끝까지 홀드한 경우)
      const autoCompleted = this.noteTrack.collectLongNoteAutoComplete(gameTimeMs)
      for (const { type } of autoCompleted) {
        this.scoreManager.push(type)
        this._state.judgeResult = { id: nextJudgeId(), type }
        this.syncScore()
        this.onUpdate?.(this._state)
        this.scheduleJudgeClear()
      }
    }

    // 화면에 보일 노트
    this._state.visibleNotes = this.noteTrack.getVisibleNotes(gameTimeMs, this.config.approachTimeMs)

    // 상태 갱신
    this.syncScore()

    // 곡 끝 판정
    if (gameTimeMs > this.lastNoteTime + 2000 && this.noteTrack.totalCount > 0 && !this._state.finished) {
      this._state.finished = true
      this._state.playing = false
      this.onFinish?.()
      return
    }

    this.rafId = requestAnimationFrame(this.loop)
  }

  handleKeyDown(lane: number) {
    if (lane < 0 || lane >= this.config.keys) return
    if (this._state.pressedLanes[lane]) return

    this._state.pressedLanes[lane] = true

    const gameTimeMs = this.getGameTime()
    const result = this.noteTrack.tryJudge(lane, gameTimeMs)
    if (result) {
      const isLong = result.note.endTime > 0

      if (!isLong) {
        // 일반 노트: 즉시 점수 반영
        this.scoreManager.push(result.type)
      }
      // 롱노트: 시작 판정은 표시만, 점수는 릴리즈 시 확정

      this._state.judgeResult = {
        id: nextJudgeId(),
        type: result.type,
        offset: result.offset,
      }
      this.syncScore()
      this.scheduleJudgeClear()
    }

    this.onUpdate?.(this._state)
  }

  handleKeyUp(lane: number) {
    if (lane < 0 || lane >= this.config.keys) return
    this._state.pressedLanes[lane] = false

    // 롱노트 릴리즈 판정
    const gameTimeMs = this.getGameTime()
    const result = this.noteTrack.releaseLongNote(lane, gameTimeMs)
    if (result) {
      this.scoreManager.push(result.type)
      // 남은 틱만큼 MISS 추가
      for (let i = 0; i < result.remainingMissTicks; i++) {
        this.scoreManager.push('MISS')
      }
      // 남은 틱이 있으면 MISS 표시, 없으면 릴리즈 판정 표시
      this._state.judgeResult = {
        id: nextJudgeId(),
        type: result.remainingMissTicks > 0 ? 'MISS' : result.type,
      }
      this.syncScore()
      this.scheduleJudgeClear()
    }

    this.onUpdate?.(this._state)
  }

  private syncScore() {
    this._state.combo = this.scoreManager.combo
    this._state.accuracy = this.scoreManager.accuracy
    this._state.maxCombo = this.scoreManager.maxCombo
  }

  private scheduleJudgeClear() {
    clearTimeout(this.judgeResultClearTimer)
    this.judgeResultClearTimer = window.setTimeout(() => {
      this._state.judgeResult = null
      this.onUpdate?.(this._state)
    }, 500)
  }

  get state(): GameState { return this._state }
  setApproachTime(ms: number) { this.config.approachTimeMs = ms }
  get score() { return this.scoreManager }

  destroy() {
    this.stop()
    clearTimeout(this.judgeResultClearTimer)
    this.onUpdate = null
    this.onFinish = null
  }
}
