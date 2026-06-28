import { NoteTrack, nextNoteId, LONG_NOTE_TICK_INTERVAL, type NoteData } from './NoteTrack'
import { ScoreManager } from './Score'
import { nextJudgeId, type JudgeResult, type JudgeType } from './Judge'

/**
 * 렌더러가 매 프레임 읽어가는 게임 상태.
 * 엔진은 이 객체를 제자리에서(mutate) 갱신만 한다 — React로 push하지 않는다.
 */
export type GameState = {
  combo: number
  accuracy: number
  maxCombo: number
  score: number
  /** 가장 최근 판정 (없으면 null) */
  judgeResult: JudgeResult | null
  /** judgeResult가 발생한 게임 시각(ms) — 렌더러가 페이드 계산에 사용 */
  judgeAtMs: number
  pressedLanes: boolean[]
  /** 레인별 마지막 '성공 히트' 시각(ms) — 히트 이펙트 페이드용 */
  laneHitAt: number[]
  /** 레인별 마지막 히트 판정 등급 */
  laneHitType: (JudgeType | null)[]
}

export type GameResult = {
  score: number
  accuracy: number
  maxCombo: number
  totalNotes: number
  counts: Record<JudgeType, number>
}

type BeatmapEntry = [number, number, number]

/**
 * 순수 게임 로직. 자체 루프/시계가 없다.
 * 외부(Game)가 매 프레임 `update(timeMs)`를 호출하고, 입력 시
 * `pressLane/releaseLane(lane, timeMs)`를 호출한다. 시각은 Conductor가 준다.
 */
export class GameEngine {
  readonly track = new NoteTrack()
  private scoreMgr = new ScoreManager()
  private lastNoteTime = 0
  private _finished = false
  readonly state: GameState

  constructor(private keys: number) {
    this.state = {
      combo: 0,
      accuracy: 100,
      maxCombo: 0,
      score: 0,
      judgeResult: null,
      judgeAtMs: -Infinity,
      pressedLanes: new Array(keys).fill(false),
      laneHitAt: new Array(keys).fill(-Infinity),
      laneHitType: new Array(keys).fill(null),
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
    this.track.load(notes)
    this.lastNoteTime = Math.max(...entries.map(([, t, e]) => (e > 0 ? e : t)))
  }

  /** 매 프레임 호출 — 시간 경과에 따른 자동 판정(미스/홀드 틱/자동완료)을 처리한다. */
  update(timeMs: number) {
    if (timeMs > 0) {
      // 일반 노트 MISS (롱노트 미입력 시 틱만큼 추가 MISS)
      const missed = this.track.collectMisses(timeMs)
      if (missed.length > 0) {
        for (const note of missed) {
          this.scoreMgr.push('MISS')
          if (note.endTime > 0) {
            const totalTicks = Math.floor((note.endTime - note.time) / LONG_NOTE_TICK_INTERVAL)
            for (let t = 0; t < totalTicks; t++) this.scoreMgr.push('MISS')
          }
        }
        this.setJudge('MISS', timeMs)
      }

      // 롱노트 홀드 틱 — 틱마다(콤보 오를 때) 해당 레인에 히트 이펙트
      const ticks = this.track.collectHoldTicks(timeMs)
      if (ticks.length > 0) {
        for (const { type, note } of ticks) {
          this.scoreMgr.push(type)
          this.state.laneHitAt[note.lane] = timeMs
          this.state.laneHitType[note.lane] = type
        }
        this.setJudge(ticks[ticks.length - 1].type, timeMs)
      }

      // 롱노트 자동 완료 (끝까지 안 뗀 경우 강제 종료)
      const autoCompleted = this.track.collectLongNoteAutoComplete(timeMs)
      for (const { type } of autoCompleted) {
        this.scoreMgr.push(type)
        this.setJudge(type, timeMs)
      }
    }

    this.sync()

    // 곡 종료: 마지막 노트 이후 2초 경과
    if (!this._finished && this.track.totalCount > 0 && timeMs > this.lastNoteTime + 2000) {
      this._finished = true
    }
  }

  pressLane(lane: number, timeMs: number) {
    if (lane < 0 || lane >= this.keys) return
    if (this.state.pressedLanes[lane]) return
    this.state.pressedLanes[lane] = true

    const result = this.track.tryJudge(lane, timeMs)
    if (result) {
      // 일반 노트는 즉시 점수 반영, 롱노트는 릴리즈 시 확정
      if (result.note.endTime <= 0) this.scoreMgr.push(result.type)
      this.setJudge(result.type, timeMs, result.offset)
      this.state.laneHitAt[lane] = timeMs
      this.state.laneHitType[lane] = result.type
      this.sync()
    }
  }

  releaseLane(lane: number, timeMs: number) {
    if (lane < 0 || lane >= this.keys) return
    this.state.pressedLanes[lane] = false

    const result = this.track.releaseLongNote(lane, timeMs)
    if (result) {
      if (result.success) {
        // 윈도우 안에서 뗌: 못 채운 틱을 시작 등급으로 인정(콤보 유지) + 릴리즈 판정 1개.
        // → 윈도우 안 어디서 떼든 끝까지 잡은 것과 동일한 콤보/점수가 된다.
        for (let i = 0; i < result.remainingTicks; i++) this.scoreMgr.push(result.type)
        this.scoreMgr.push(result.type)
        this.setJudge(result.type, timeMs)
        this.state.laneHitAt[lane] = timeMs
        this.state.laneHitType[lane] = result.type
      } else {
        // 진짜 일찍 뗌(윈도우 밖): 릴리즈 + 남은 틱 전부 MISS.
        this.scoreMgr.push('MISS')
        for (let i = 0; i < result.remainingTicks; i++) this.scoreMgr.push('MISS')
        this.setJudge('MISS', timeMs)
      }
      this.sync()
    }
  }

  get finished(): boolean {
    return this._finished
  }

  /**
   * 멈춤→재개(되감기) 시 호출. 시각적 잔상(히트 이펙트/판정 텍스트/키 눌림)을 비운다.
   * 이렇게 안 하면 되감은 뒤 시간이 옛 히트 시각을 다시 지날 때 이펙트가 재트리거된다.
   * 점수·콤보·이미 판정된 노트는 건드리지 않는다.
   */
  resetTransient() {
    this.state.judgeResult = null
    this.state.judgeAtMs = -Infinity
    for (let i = 0; i < this.keys; i++) {
      this.state.laneHitAt[i] = -Infinity
      this.state.laneHitType[i] = null
      this.state.pressedLanes[i] = false
    }
  }

  getResult(): GameResult {
    return {
      score: this.scoreMgr.score,
      accuracy: this.scoreMgr.accuracy,
      maxCombo: this.scoreMgr.maxCombo,
      totalNotes: this.scoreMgr.totalNotes,
      counts: this.scoreMgr.counts,
    }
  }

  private setJudge(type: JudgeType, timeMs: number, offset?: number) {
    this.state.judgeResult = { id: nextJudgeId(), type, offset }
    this.state.judgeAtMs = timeMs
  }

  private sync() {
    this.state.combo = this.scoreMgr.combo
    this.state.accuracy = this.scoreMgr.accuracy
    this.state.maxCombo = this.scoreMgr.maxCombo
    this.state.score = this.scoreMgr.score
  }
}
