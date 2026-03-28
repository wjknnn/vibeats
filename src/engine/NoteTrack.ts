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
  lastTickTime: number  // 마지막 틱 판정 시각
}

let noteIdCounter = 0
export function nextNoteId(): number {
  return ++noteIdCounter
}

export class NoteTrack {
  private lanes: Map<number, NoteData[]> = new Map()
  private _allNotes: NoteData[] = []

  load(notes: NoteData[]) {
    this._allNotes = notes
    this.lanes.clear()
    for (const note of notes) {
      if (!this.lanes.has(note.lane)) {
        this.lanes.set(note.lane, [])
      }
      this.lanes.get(note.lane)!.push(note)
    }
    this.lanes.forEach((arr) => arr.sort((a, b) => a.time - b.time))
  }

  get allNotes(): readonly NoteData[] {
    return this._allNotes
  }

  tryJudge(lane: number, currentTimeMs: number): { type: JudgeType; offset: number; note: NoteData } | null {
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
   * 홀드 중인 롱노트에서 틱 판정 수집
   * 매 LONG_NOTE_TICK_INTERVAL ms마다 PERFECT 틱 생성
   */
  collectHoldTicks(currentTimeMs: number): { type: JudgeType; note: NoteData }[] {
    const ticks: { type: JudgeType; note: NoteData }[] = []
    this.lanes.forEach((laneNotes) => {
      for (const note of laneNotes) {
        if (!note.holding) continue
        // endTime을 넘었으면 틱 생성 안 함 (자동완료에서 처리)
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
   * 롱노트 키 릴리즈 — 마지막 틱 판정 반환
   * GOOD 범위 안에서 뗌 → 시작 판정 유지, 밖이면 MISS
   */
  releaseLongNote(lane: number, currentTimeMs: number): { type: JudgeType; note: NoteData; remainingMissTicks: number } | null {
    const laneNotes = this.lanes.get(lane)
    if (!laneNotes) return null

    const holdingNote = laneNotes.find((n) => n.holding && n.lane === lane)
    if (!holdingNote) return null

    holdingNote.holding = false
    holdingNote.judged = true

    // 남은 틱 수 계산 (마지막 틱 포함)
    const totalTicks = Math.floor((holdingNote.endTime - holdingNote.time) / LONG_NOTE_TICK_INTERVAL)
    const elapsedTicks = Math.floor((holdingNote.lastTickTime - holdingNote.time) / LONG_NOTE_TICK_INTERVAL)
    const remainingTicks = totalTicks - elapsedTicks

    const diff = Math.abs(holdingNote.endTime - currentTimeMs)
    if (diff <= JUDGE_WINDOW.GOOD || currentTimeMs >= holdingNote.endTime) {
      // 릴리즈 자체는 OK, 하지만 못 얻은 틱은 MISS
      return { type: holdingNote.holdStartJudge ?? 'PERFECT', note: holdingNote, remainingMissTicks: remainingTicks }
    }

    // 너무 일찍 놓음
    return { type: 'MISS', note: holdingNote, remainingMissTicks: remainingTicks }
  }

  /**
   * 홀드 중인 롱노트가 endTime을 넘긴 경우 자동 완료 — 마지막 틱 판정
   * GOOD 범위 안 → 시작 판정 유지, BAD 범위 초과 → BAD
   */
  collectLongNoteAutoComplete(currentTimeMs: number): { type: JudgeType; note: NoteData }[] {
    const completed: { type: JudgeType; note: NoteData }[] = []
    this.lanes.forEach((laneNotes) => {
      for (const note of laneNotes) {
        if (!note.holding) continue
        // GOOD 윈도우 초과까지 안 뗌 → BAD로 강제 종료
        if (currentTimeMs >= note.endTime + JUDGE_WINDOW.GOOD) {
          note.holding = false
          note.judged = true
          completed.push({ type: 'BAD', note })
        }
        // 그 전까지는 holding 유지 (릴리즈로 판정받을 수 있게)
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
}
