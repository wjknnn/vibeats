import { Application } from 'pixi.js'
import { audioEngine } from '@/audio/AudioEngine'
import { loadBeatmap } from '@/data/beatmap'
import type { SongData } from '@/data/songs'
import { Conductor } from './Conductor'
import { GameEngine, type GameResult } from './GameEngine'
import { PixiRenderer } from './PixiRenderer'
import { attachInput } from './input'
import { calcApproachTime, DEFAULT_KEYS } from './config'

export type { GameResult }

/** 재개 시 되감을 양(ms) — 멈춘 지점보다 이만큼 앞에서 노트가 다시 내려온다. */
const REWIND_MS = 1600
/** 재개 카운트다운 길이(ms) */
const COUNTDOWN_MS = 3000

type Phase = 'loading' | 'playing' | 'paused' | 'countdown' | 'finished'

export type GameOptions = {
  song: SongData
  speed: number
  keys?: number
  onComplete?: (result: GameResult) => void
  onSpeedChange?: (speed: number) => void
  /** 재시작 요청 (보통 GamePage가 Game 인스턴스를 재생성) */
  onRestart?: () => void
  /** 곡 선택으로 나가기 */
  onExit?: () => void
}

/**
 * 게임플레이 1회의 수명을 소유하는 오케스트레이터.
 * - rAF 루프(Pixi ticker)를 단독으로 소유: 매 프레임 시간→엔진 update→렌더.
 * - React는 이 인스턴스를 만들고 destroy()만 한다(매 프레임 침범 없음).
 * - StrictMode 이중 마운트에 안전하도록 destroyed 가드를 둔다.
 */
export class Game {
  private app = new Application()
  private engine: GameEngine | null = null
  private conductor: Conductor | null = null
  private renderer: PixiRenderer | null = null
  private detachInput: () => void = () => {}

  private keys = DEFAULT_KEYS
  private speed = 3
  private approachMs = 0
  private songId = ''
  private opts!: GameOptions

  private inited = false
  private destroyed = false
  private completed = false

  private phase: Phase = 'loading'
  private resumeFromMs = 0
  private countdownEndCtx = 0
  private onControlKey: (e: KeyboardEvent) => void = () => {}
  private onVisibility: () => void = () => {}

  async start(container: HTMLElement, opts: GameOptions) {
    this.opts = opts
    this.keys = opts.keys ?? DEFAULT_KEYS
    this.speed = opts.speed
    this.approachMs = calcApproachTime(opts.speed)

    // 1) Pixi 초기화 (비동기). 도중에 언마운트(StrictMode)되면 중단.
    await this.app.init({
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    })
    if (this.destroyed) {
      this.app.destroy(true)
      return
    }
    this.inited = true
    container.appendChild(this.app.canvas)

    // 2) 비트맵 + 오디오 로드 (병렬)
    await audioEngine.resume() // 사용자 제스처 후 호출되었다는 가정. suspended면 깨움.
    this.songId = `song_${opts.song.id}`
    const [raw] = await Promise.all([
      loadBeatmap(opts.song.beatmapUrl),
      audioEngine.addPlayer('song', String(opts.song.id), opts.song.musicUrl, {
        volume: opts.song.volume,
      }),
    ])
    if (this.destroyed) return

    // 타이밍: 비트맵 JSON에 있으면 우선, 없으면 SongData 폴백 (에디터 저장값 반영)
    const bpm = raw.bpm ?? opts.song.bpm
    const firstBeatMs = raw.firstBeatMs ?? opts.song.firstBeatMs ?? 0
    const songOffsetMs = raw.offset ?? opts.song.offset ?? 0

    // 3) 엔진/렌더러/입력 구성
    this.engine = new GameEngine(this.keys)
    this.engine.loadBeatmap(raw.map)
    this.renderer = new PixiRenderer(this.app, this.keys)
    this.renderer.configureBeatGrid(bpm, firstBeatMs)
    this.app.renderer.on('resize', this.onResize)

    this.detachInput = attachInput(this.keys, {
      // 플레이 중에만 레인 입력을 엔진에 전달 (일시정지/카운트다운 중엔 무시)
      onLaneDown: (lane) => {
        if (this.phase === 'playing') this.engine?.pressLane(lane, this.conductor!.timeMs)
      },
      onLaneUp: (lane) => {
        if (this.phase === 'playing') this.engine?.releaseLane(lane, this.conductor!.timeMs)
      },
      onSpeed: (delta) => this.changeSpeed(delta),
    })

    // 4) Conductor로 시간 0 시점을 잡고, 그 시점에 오디오 재생 예약
    this.conductor = new Conductor(audioEngine.context, songOffsetMs)
    const audioStartCtx = this.conductor.scheduleStart(this.approachMs)
    audioEngine.playScheduled(this.songId, audioStartCtx)

    // 5) 제어 입력(일시정지) + 탭 가시성 자동 일시정지
    this.onControlKey = (e) => {
      // 재시작: F5 (best-effort로 브라우저 새로고침 차단)
      if (e.key === 'F5') {
        if (this.phase === 'playing' || this.phase === 'paused' || this.phase === 'countdown') {
          e.preventDefault()
          this.restart()
        }
        return
      }
      // 일시정지 메뉴: ↑↓ 포커스 이동, Enter 선택, Esc 즉시 계속
      if (this.phase === 'paused') {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          this.renderer!.moveFocus(-1)
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          this.renderer!.moveFocus(1)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          this.renderer!.activateFocus()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          this.requestResume()
        }
        return
      }
      // 플레이 중: Esc로 일시정지
      if (this.phase === 'playing' && e.key === 'Escape') {
        e.preventDefault()
        this.pause()
      }
    }
    this.onVisibility = () => {
      if (document.hidden && (this.phase === 'playing' || this.phase === 'countdown')) this.pause()
    }
    window.addEventListener('keydown', this.onControlKey)
    document.addEventListener('visibilitychange', this.onVisibility)

    // 6) 루프 시작
    this.phase = 'playing'
    this.app.ticker.add(this.tick)
  }

  /** 일시정지 — 오디오 정지 + 시간 고정 + 오버레이 표시. */
  pause() {
    if (this.phase === 'playing') {
      audioEngine.stop(this.songId)
      this.conductor!.pause()
    } else if (this.phase !== 'countdown') {
      return // 카운트다운 중이면 오디오 미재생 상태라 그대로 멈춤으로 전환
    }
    this.phase = 'paused'
    this.renderer!.showPause([
      { label: '계속', onClick: () => this.requestResume() },
      { label: '재시작', onClick: () => this.restart() },
      { label: '곡 선택', onClick: () => this.exitToSelect() },
    ])
  }

  /** 재시작 — GamePage가 Game을 재생성하도록 위임. */
  restart() {
    this.opts.onRestart?.()
  }

  /** 곡 선택 화면으로 나가기. */
  exitToSelect() {
    this.opts.onExit?.()
  }

  /** 재개 요청 — 되감은 뒤 카운트다운 시작(틱에서 진행). */
  requestResume() {
    if (this.phase !== 'paused' || !this.conductor) return
    this.resumeFromMs = Math.max(0, this.conductor.pausedMs - REWIND_MS)
    this.conductor.freezeAt(this.resumeFromMs) // 되감은 위치를 보여줌
    this.engine?.resetTransient() // 옛 히트 이펙트/판정 잔상 제거 (되감기 재트리거 방지)
    this.countdownEndCtx = audioEngine.context.currentTime + COUNTDOWN_MS / 1000
    this.phase = 'countdown'
  }

  /** 카운트다운 종료 시 호출 — 되감은 지점부터 오디오/시간 재개. */
  private beginResume() {
    if (!this.conductor) return
    const when = audioEngine.context.currentTime + 0.06 // 미세 룩어헤드로 정확히 동기
    this.conductor.resumeAt(when, this.resumeFromMs)
    audioEngine.playScheduled(this.songId, when, this.conductor.audioOffsetSec(this.resumeFromMs))
    this.renderer!.hideOverlay()
    this.phase = 'playing'
  }

  private tick = () => {
    if (!this.engine || !this.renderer || !this.conductor) return

    // 카운트다운 진행 (오디오 클럭 기준 — 프레임 레이트 무관)
    if (this.phase === 'countdown') {
      const remainMs = (this.countdownEndCtx - audioEngine.context.currentTime) * 1000
      if (remainMs <= 0) this.beginResume()
      else this.renderer.showCountdown(String(Math.ceil(remainMs / 1000)))
    }

    const t = this.conductor.timeMs
    if (this.phase === 'playing') this.engine.update(t)

    // 멈춤/카운트다운 중에도 그리기는 계속 (되감은 위치의 노트가 보임)
    const notes = this.engine.track.getVisibleNotes(t, this.approachMs)
    this.renderer.draw(notes, this.engine.state, t, this.approachMs)

    if (this.phase === 'playing' && this.engine.finished) this.finish()
  }

  private finish() {
    if (this.completed) return
    this.completed = true
    this.phase = 'finished'
    this.app.ticker.remove(this.tick)
    audioEngine.stop(this.songId)
    const result = this.engine?.getResult()
    if (result) this.opts.onComplete?.(result)
  }

  private changeSpeed(delta: number) {
    this.speed = Math.max(1, Math.min(7, Math.round((this.speed + delta) * 10) / 10))
    this.approachMs = calcApproachTime(this.speed)
    this.opts.onSpeedChange?.(this.speed)
  }

  private onResize = () => {
    this.renderer?.layout()
  }

  destroy() {
    this.destroyed = true
    this.detachInput()
    window.removeEventListener('keydown', this.onControlKey)
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.songId) {
      audioEngine.stop(this.songId)
      audioEngine.removePlayer(this.songId)
    }
    if (this.inited) {
      this.app.ticker.remove(this.tick)
      this.app.renderer?.off('resize', this.onResize)
      this.renderer?.destroy()
      try {
        this.app.destroy(true, { children: true })
      } catch {
        /* 이미 파괴됨 */
      }
    }
  }
}
