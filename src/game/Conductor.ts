/**
 * 시간의 기준(source of truth).
 *
 * Unity의 AudioSettings.dspTime에 해당. performance.now()/deltaTime 누적이 아니라
 * 오디오 하드웨어 클럭(AudioContext.currentTime)에서 시각을 끌어온다 → 프레임 드랍이
 * 누적 오차로 쌓이지 않는다.
 *
 * scheduleStart() 호출 시점부터 leadIn(approach time)만큼 음수로 시작해서, 곡이
 * 실제로 재생되는 순간 timeMs === 0 이 되고, 이후 오디오 재생 위치와 정확히 일치한다.
 */
export class Conductor {
  /** ctx.currentTime 기준, 게임 시각 0(=곡 시작)에 해당하는 시점(초) */
  private zeroAt = 0
  private started = false
  private paused = false
  private frozenMs = 0

  /**
   * @param ctx       audioEngine.context
   * @param offsetMs  싱크 보정값(ms). 양수면 오디오를 그만큼 늦게 재생 → 노트가 상대적으로 빨라짐.
   */
  constructor(
    private ctx: AudioContext,
    private offsetMs = 0,
  ) {}

  /**
   * 카운트다운(lead-in) 시작. 게임 시각 0이 되는 ctx 시점을 잡는다.
   * @param leadInMs  노트가 화면을 가로지르는 시간(approach time)
   * @returns 곡 오디오를 start()해야 하는 ctx 시각(초). AudioEngine.playScheduled에 전달.
   */
  scheduleStart(leadInMs: number): number {
    this.zeroAt = this.ctx.currentTime + leadInMs / 1000
    this.started = true
    this.paused = false
    return this.zeroAt + this.offsetMs / 1000
  }

  /** 현재 게임 시각(ms). lead-in 동안 음수, 곡 시작 시 0. 멈춤 중엔 고정값. */
  get timeMs(): number {
    if (!this.started) return -Infinity
    return this.paused ? this.frozenMs : (this.ctx.currentTime - this.zeroAt) * 1000
  }

  /** 현재 시각에서 멈춤 — timeMs가 그 값으로 고정된다. */
  pause() {
    if (!this.started || this.paused) return
    this.frozenMs = this.timeMs
    this.paused = true
  }

  /** 멈춘 채로 특정 게임 시각을 표시(카운트다운 중 되감은 위치 보여주기). */
  freezeAt(ms: number) {
    this.frozenMs = ms
    this.paused = true
  }

  /** ctxWhen(초) 시점에 게임 시각이 fromMs가 되도록 재개. */
  resumeAt(ctxWhen: number, fromMs: number) {
    this.zeroAt = ctxWhen - fromMs / 1000
    this.paused = false
  }

  /** 게임 시각 gameMs에 대응하는 오디오 재생 오프셋(초). */
  audioOffsetSec(gameMs: number): number {
    return Math.max(0, (gameMs - this.offsetMs) / 1000)
  }

  /** 멈춘 시점의 게임 시각(ms). */
  get pausedMs(): number {
    return this.frozenMs
  }

  get isStarted(): boolean {
    return this.started
  }

  get isPaused(): boolean {
    return this.paused
  }

  setOffset(ms: number) {
    this.offsetMs = ms
  }
}
