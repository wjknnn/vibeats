import { JUDGE_WINDOW, judge, type JudgeType } from './Judge'

/** 롱노트 틱 간격(ms) */
export const LONG_NOTE_TICK_INTERVAL = 100

export type NoteData = {
  id: number
  lane: number
  time: number
  endTime: number
  judged: boolean
  // 롱노트 전용
  holding: boolean
  holdStartJudge: JudgeType | null
  lastTickTime: number // 마지막 틱 판정 시각
}

let noteIdCounter = 0
export function nextNoteId(): number {
  return ++noteIdCounter
}

/**
 * 노트 집합을 레인별로 관리하며 입력/시간에 대한 판정을 계산한다.
 * 시각(ms)은 외부(Conductor)에서 주입받는다 — 자체 시계를 갖지 않는다.
 */
export class NoteTrack {
  private lanes: Map<number, NoteData[]> = new Map()
  private _allNotes: NoteData[] = []

  load(notes: NoteData[]) {
    this._allNotes = notes
    this.lanes.clear()
    for (const note of notes) {
      if (!this.lanes.has(note.lane)) this.lanes.set(note.lane, [])
      this.lanes.get(note.lane)!.push(note)
    }
    this.lanes.forEach((arr) => arr.sort((a, b) => a.time - b.time))
  }

  get allNotes(): readonly NoteData[] {
    return this._allNotes
  }

  tryJudge(
    lane: number,
    currentTimeMs: number,
  ): { type: JudgeType; offset: number; note: NoteData } | null {
    const laneNotes = this.lanes.get(lane)
    if (!laneNotes) return null

    let best: { note: NoteData; diff: number; offset: number } | null = null

    for (const note of laneNotes) {
      if (note.judged) continue
      if (note.holding) continue
      const diff = Math.abs(note.time - currentTimeMs)
      if (diff > JUDGE_WINDOW.BAD) {
        if (note.time > currentTimeMs + JUDGE_WINDOW.BAD) break
        continue
      }
      if (!best || diff < best.diff) {
        best = { note, diff, offset: currentTimeMs - note.time }
      }
    }

    if (!best) return null

    const type = judge(best.note.time, currentTimeMs)

    if (best.note.endTime > 0) {
      // 롱노트: 홀드 시작
      best.note.holding = true
      best.note.holdStartJudge = type
      best.note.lastTickTime = best.note.time
    } else {
      best.note.judged = true
    }

    return { type, offset: best.offset, note: best.note }
  }

  /**
   * 홀드 중인 롱노트에서 틱 판정 수집.
   * 매 LONG_NOTE_TICK_INTERVAL ms마다 시작 판정과 동일한 틱 생성.
   */
  collectHoldTicks(currentTimeMs: number): { type: JudgeType; note: NoteData }[] {
    const ticks: { type: JudgeType; note: NoteData }[] = []
    this.lanes.forEach((laneNotes) => {
      for (const note of laneNotes) {
        if (!note.holding) continue
        const effectiveEnd = Math.min(currentTimeMs, note.endTime)
        while (note.lastTickTime + LONG_NOTE_TICK_INTERVAL <= effectiveEnd) {
          note.lastTickTime += LONG_NOTE_TICK_INTERVAL
          ticks.push({ type: note.holdStartJudge ?? 'PERFECT', note })
        }
      }
    })
    return ticks
  }

  /**
   * 롱노트 키 릴리즈 — 마지막 틱 판정 반환.
   * GOOD 범위 안에서 뗌 → 시작 판정 유지, 밖이면 MISS.
   */
  releaseLongNote(
    lane: number,
    currentTimeMs: number,
  ): { type: JudgeType; note: NoteData; success: boolean; remainingTicks: number } | null {
    const laneNotes = this.lanes.get(lane)
    if (!laneNotes) return null

    const holdingNote = laneNotes.find((n) => n.holding && n.lane === lane)
    if (!holdingNote) return null

    holdingNote.holding = false
    holdingNote.judged = true

    const totalTicks = Math.floor((holdingNote.endTime - holdingNote.time) / LONG_NOTE_TICK_INTERVAL)
    const elapsedTicks = Math.floor(
      (holdingNote.lastTickTime - holdingNote.time) / LONG_NOTE_TICK_INTERVAL,
    )
    const remainingTicks = totalTicks - elapsedTicks

    // 꼬리 윈도우(±GOOD) 안에서 떼거나 끝을 지나도록 잡았으면 성공.
    // 못 채운 틱(remainingTicks)의 처리는 호출부(GameEngine)가 success로 판단한다.
    const diff = Math.abs(holdingNote.endTime - currentTimeMs)
    const success = diff <= JUDGE_WINDOW.GOOD || currentTimeMs >= holdingNote.endTime

    return {
      type: success ? (holdingNote.holdStartJudge ?? 'PERFECT') : 'MISS',
      note: holdingNote,
      success,
      remainingTicks,
    }
  }

  /**
   * 홀드 중인 롱노트가 endTime을 넘긴 경우 자동 완료.
   * GOOD 윈도우 초과까지 안 뗌 → BAD로 강제 종료.
   */
  collectLongNoteAutoComplete(currentTimeMs: number): { type: JudgeType; note: NoteData }[] {
    const completed: { type: JudgeType; note: NoteData }[] = []
    this.lanes.forEach((laneNotes) => {
      for (const note of laneNotes) {
        if (!note.holding) continue
        if (currentTimeMs >= note.endTime + JUDGE_WINDOW.GOOD) {
          note.holding = false
          note.judged = true
          completed.push({ type: 'BAD', note })
        }
      }
    })
    return completed
  }

  collectMisses(currentTimeMs: number): NoteData[] {
    const missed: NoteData[] = []
    this.lanes.forEach((laneNotes) => {
      for (const note of laneNotes) {
        if (note.judged || note.holding) continue
        if (currentTimeMs - note.time > JUDGE_WINDOW.BAD) {
          note.judged = true
          missed.push(note)
        }
      }
    })
    return missed
  }

  /** 현재 화면에 보여야 할 노트 (판정 끝난 건 제외) */
  getVisibleNotes(currentTimeMs: number, approachTimeMs: number): NoteData[] {
    const visible: NoteData[] = []
    for (const note of this._allNotes) {
      if (note.judged) continue
      const disappearTime = note.endTime > 0 ? note.endTime + 500 : note.time + 500
      if (currentTimeMs >= note.time - approachTimeMs && currentTimeMs <= disappearTime) {
        visible.push(note)
      }
    }
    return visible
  }

  get totalCount(): number {
    return this._allNotes.length
  }

  reset() {
    this.lanes.clear()
    this._allNotes = []
  }
}
