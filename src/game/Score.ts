import { JUDGE_SCORE, type JudgeType } from './Judge'

/** 점수/콤보/정확도 집계 — 순수 로직. */
export class ScoreManager {
  private history: JudgeType[] = []
  private _combo = 0
  private _maxCombo = 0

  push(judge: JudgeType) {
    this.history.push(judge)
    if (judge !== 'MISS') {
      this._combo++
      if (this._combo > this._maxCombo) this._maxCombo = this._combo
    } else {
      this._combo = 0
    }
  }

  get combo() {
    return this._combo
  }

  get maxCombo() {
    return this._maxCombo
  }

  get totalNotes() {
    return this.history.length
  }

  /** 0~100, 판정별 점수의 평균 */
  get accuracy(): number {
    if (this.history.length === 0) return 100
    const sum = this.history.reduce((acc, j) => acc + JUDGE_SCORE[j], 0)
    return sum / this.history.length
  }

  get score(): number {
    return this.history.reduce((acc, j) => acc + JUDGE_SCORE[j], 0)
  }

  get counts(): Record<JudgeType, number> {
    const c: Record<JudgeType, number> = { PERFECT: 0, GREAT: 0, GOOD: 0, BAD: 0, MISS: 0 }
    for (const j of this.history) c[j]++
    return c
  }

  reset() {
    this.history = []
    this._combo = 0
    this._maxCombo = 0
  }
}
