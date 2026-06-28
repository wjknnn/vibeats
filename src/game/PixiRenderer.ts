import { Application, Container, Graphics, Text } from 'pixi.js'
import type { NoteData } from './NoteTrack'
import type { GameState } from './GameEngine'
import { JUDGE_COLOR } from './Judge'
import { PLAYER_WIDTH, NOTE_HEIGHT, JUDGE_LINE_RATIO, getLaneColor } from './config'

const JUDGE_FADE_MS = 500
const HIT_FX_MS = 240 // 일반 히트 버스트 지속 시간
const PERFECT_FX_MS = 400 // PERFECT 화려한 버스트 지속 시간

/**
 * 게임 상태를 Pixi로 그리는 뷰. 로직/시간 계산은 하지 않는다.
 * Game이 매 프레임 draw()를 호출하면 화면을 갱신한다.
 */
export class PixiRenderer {
  private field = new Container() // 중앙 정렬된 플레이필드 (로컬 x: 0..PLAYER_WIDTH)
  private bg = new Graphics() // 레인 배경/구분선
  private barLines = new Graphics() // 마디/박자선 (노트 뒤)
  private judgeLine = new Graphics()
  private laneGlow: Graphics[] = [] // 레인별 키프레스 하이라이트
  private hitFx: Graphics[] = [] // 레인별 히트 버스트 이펙트
  private notePool: Graphics[] = [] // 노트 그래픽 풀 (재사용)
  private noteLayer = new Container()

  private comboText: Text
  private accText: Text
  private judgeText: Text

  // 일시정지/카운트다운 오버레이 (최상단)
  private dim = new Graphics()
  private overlayMain: Text
  private overlaySub: Text
  private menuTexts: Text[] = [] // 클릭 가능한 일시정지 메뉴 항목
  private menuCallbacks: (() => void)[] = []
  private menuLabels: string[] = []
  private menuCount = 0
  private menuFocus = 0

  private laneWidth: number

  // 박자 그리드 (마디/박자선)
  private beatMs = 0 // 0이면 비표시
  private firstBeatMs = 0
  private beatsPerMeasure = 4

  // 텍스트 애니메이션 상태
  private lastCombo = 0
  private comboPopAt = -Infinity
  private lastJudgeId = -1
  private judgeTextBaseY = 0

  constructor(
    private app: Application,
    private keys: number,
  ) {
    this.laneWidth = PLAYER_WIDTH / keys

    this.field.addChild(this.bg)
    for (let i = 0; i < keys; i++) {
      const g = new Graphics()
      g.visible = false
      this.laneGlow.push(g)
      this.field.addChild(g)
    }
    this.field.addChild(this.barLines)
    this.field.addChild(this.judgeLine)
    this.field.addChild(this.noteLayer)

    // 히트 버스트 (노트 위, HUD 아래). 가산 블렌딩 → 빛이 겹칠수록 밝아짐.
    for (let i = 0; i < keys; i++) {
      const g = new Graphics()
      g.visible = false
      g.blendMode = 'add'
      this.hitFx.push(g)
      this.field.addChild(g)
    }

    this.comboText = new Text({
      text: '',
      style: { fontFamily: 'sans-serif', fontSize: 56, fontWeight: '900', fill: 0xffffff },
    })
    this.comboText.anchor.set(0.5)
    this.accText = new Text({
      text: '100.00%',
      style: { fontFamily: 'sans-serif', fontSize: 16, fontWeight: '700', fill: 0x6b6b73 },
    })
    this.accText.anchor.set(0.5)
    this.judgeText = new Text({
      text: '',
      style: { fontFamily: 'sans-serif', fontSize: 36, fontWeight: '900', fill: 0xffffff },
    })
    this.judgeText.anchor.set(0.5)
    this.judgeText.alpha = 0
    this.field.addChild(this.comboText, this.accText, this.judgeText)

    this.app.stage.addChild(this.field)

    // 오버레이 (field 위 = 최상단)
    this.overlayMain = new Text({
      text: '',
      style: { fontFamily: 'sans-serif', fontSize: 72, fontWeight: '900', fill: 0xffffff },
    })
    this.overlayMain.anchor.set(0.5)
    this.overlaySub = new Text({
      text: '',
      style: { fontFamily: 'sans-serif', fontSize: 18, fontWeight: '600', fill: 0x9a9aa6 },
    })
    this.overlaySub.anchor.set(0.5)
    this.dim.visible = false
    this.overlayMain.visible = false
    this.overlaySub.visible = false
    this.app.stage.addChild(this.dim, this.overlayMain, this.overlaySub)

    this.layout()
  }

  /** 마디/박자선 설정. bpm 0이면 비표시. */
  configureBeatGrid(bpm: number, firstBeatMs = 0, beatsPerMeasure = 4) {
    this.beatMs = bpm > 0 ? 60000 / bpm : 0
    this.firstBeatMs = firstBeatMs
    this.beatsPerMeasure = beatsPerMeasure
  }

  /** 카운트다운 숫자 표시 (메뉴 없음). */
  showCountdown(text: string) {
    const { width, height } = this.app.screen
    this.dim.visible = true
    this.overlayMain.visible = true
    this.overlayMain.text = text
    this.overlayMain.style.fontSize = 96
    this.overlayMain.position.set(width / 2, height / 2)
    this.overlaySub.visible = false
    this.hideMenu()
  }

  /** 일시정지 메뉴 표시 — 클릭 가능한 항목들. */
  showPause(items: { label: string; onClick: () => void }[]) {
    const { width, height } = this.app.screen
    this.dim.visible = true
    this.overlayMain.visible = true
    this.overlayMain.text = 'PAUSED'
    this.overlayMain.style.fontSize = 52
    this.overlayMain.position.set(width / 2, height / 2 - 90)
    this.overlaySub.visible = false

    this.ensureMenu(items.length)
    this.menuCallbacks = items.map((it) => it.onClick)
    this.menuLabels = items.map((it) => it.label)
    this.menuCount = items.length
    this.menuFocus = 0
    const gap = 46
    for (let i = 0; i < this.menuTexts.length; i++) {
      const t = this.menuTexts[i]
      t.visible = i < items.length
      if (i < items.length) t.position.set(width / 2, height / 2 - 10 + i * gap)
    }
    this.renderFocus()
  }

  /** 일시정지 메뉴 포커스 이동 (↑↓). */
  moveFocus(delta: number) {
    if (this.menuCount === 0) return
    this.menuFocus = (this.menuFocus + delta + this.menuCount) % this.menuCount
    this.renderFocus()
  }

  /** 현재 포커스된 메뉴 항목 실행 (Enter). */
  activateFocus() {
    this.menuCallbacks[this.menuFocus]?.()
  }

  private renderFocus() {
    for (let i = 0; i < this.menuCount; i++) {
      const t = this.menuTexts[i]
      const focused = i === this.menuFocus
      t.text = focused ? `‹ ${this.menuLabels[i]} ›` : this.menuLabels[i]
      t.alpha = focused ? 1 : 0.5
      t.scale.set(focused ? 1.12 : 1)
      t.style.fill = focused ? 0xffffff : 0x9a9aa6
    }
  }

  hideOverlay() {
    this.dim.visible = false
    this.overlayMain.visible = false
    this.overlaySub.visible = false
    this.hideMenu()
  }

  private hideMenu() {
    for (const t of this.menuTexts) t.visible = false
  }

  private ensureMenu(count: number) {
    while (this.menuTexts.length < count) {
      const idx = this.menuTexts.length
      const t = new Text({
        text: '',
        style: { fontFamily: 'sans-serif', fontSize: 24, fontWeight: '700', fill: 0xffffff },
      })
      t.anchor.set(0.5)
      t.eventMode = 'static'
      t.cursor = 'pointer'
      // 마우스 호버 → 포커스 동기화
      t.on('pointerover', () => {
        this.menuFocus = idx
        this.renderFocus()
      })
      t.on('pointerdown', () => {
        this.menuFocus = idx
        this.menuCallbacks[idx]?.()
      })
      this.menuTexts.push(t)
      this.app.stage.addChild(t)
    }
  }

  /** 화면 크기에 맞춰 정적 요소를 다시 그린다. 생성 시 + 리사이즈 시 호출. */
  layout() {
    const { width, height } = this.app.screen
    this.field.x = (width - PLAYER_WIDTH) / 2
    this.field.y = 0
    const judgeY = height * JUDGE_LINE_RATIO

    // 레인 배경
    this.bg.clear()
    this.bg.rect(0, 0, PLAYER_WIDTH, height).fill({ color: 0x0a0a12, alpha: 0.55 })
    for (let i = 1; i < this.keys; i++) {
      this.bg.rect(i * this.laneWidth - 0.5, 0, 1, height).fill({ color: 0xffffff, alpha: 0.06 })
    }
    // 좌우 테두리
    this.bg.rect(-1, 0, 2, height).fill({ color: 0xffffff, alpha: 0.1 })
    this.bg.rect(PLAYER_WIDTH - 1, 0, 2, height).fill({ color: 0xffffff, alpha: 0.1 })

    // 판정선
    this.judgeLine.clear()
    this.judgeLine.rect(0, judgeY - 1.5, PLAYER_WIDTH, 3).fill({ color: 0xffffff, alpha: 0.9 })

    // 레인 키프레스 하이라이트(세로 그라데이션 대용: 단색 알파)
    for (let i = 0; i < this.keys; i++) {
      const color = getLaneColor(i, this.keys)
      const g = this.laneGlow[i]
      g.clear()
      g.rect(i * this.laneWidth, 0, this.laneWidth, judgeY).fill({ color: color.glow, alpha: 0.14 })
      // 판정선 위 히트 바
      g.rect(i * this.laneWidth + 2, judgeY - 4, this.laneWidth - 4, 6).fill({ color: color.head, alpha: 0.9 })
    }

    // HUD 위치
    this.comboText.position.set(PLAYER_WIDTH / 2, judgeY * 0.42)
    this.accText.position.set(PLAYER_WIDTH / 2, judgeY * 0.42 + 44)
    this.judgeTextBaseY = judgeY - 70
    this.judgeText.position.set(PLAYER_WIDTH / 2, this.judgeTextBaseY)

    // 오버레이 (스크린 좌표 — field가 아니라 stage에 붙어 있음)
    this.dim.clear()
    this.dim.rect(0, 0, width, height).fill({ color: 0x05050a, alpha: 0.66 })
    this.overlayMain.position.set(width / 2, height / 2 - 10)
    this.overlaySub.position.set(width / 2, height / 2 + 44)
  }

  draw(notes: NoteData[], state: GameState, timeMs: number, approachMs: number) {
    const height = this.app.screen.height
    const judgeY = height * JUDGE_LINE_RATIO

    // --- 마디/박자선 (노트와 동일한 approach 변환으로 흘러내림) ---
    this.barLines.clear()
    if (this.beatMs > 0) {
      const top = timeMs + approachMs
      let k = Math.floor((timeMs - this.firstBeatMs) / this.beatMs) // 현재 지나는 박부터
      let lt = this.firstBeatMs + k * this.beatMs
      while (lt <= top) {
        const y = judgeY - ((lt - timeMs) / approachMs) * judgeY
        if (y >= -2 && y <= height) {
          const isMeasure = (((k % this.beatsPerMeasure) + this.beatsPerMeasure) % this.beatsPerMeasure) === 0
          this.barLines
            .rect(0, isMeasure ? y - 1 : y, PLAYER_WIDTH, isMeasure ? 2 : 1)
            .fill({ color: 0xffffff, alpha: isMeasure ? 0.14 : 0.05 })
        }
        k++
        lt += this.beatMs
      }
    }

    // --- 노트 ---
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      const g = this.getNoteGraphic(i)
      const color = getLaneColor(note.lane, this.keys)
      const x = note.lane * this.laneWidth + 3
      const w = this.laneWidth - 6

      const startProgress = (note.time - timeMs) / approachMs
      const startY = judgeY - startProgress * judgeY

      g.clear()
      g.visible = true

      if (note.endTime > 0) {
        // 롱노트
        const endProgress = (note.endTime - timeMs) / approachMs
        const endY = judgeY - endProgress * judgeY
        const headY = note.holding ? judgeY : Math.min(startY, judgeY + NOTE_HEIGHT)
        const tailY = endY
        const top = tailY - NOTE_HEIGHT
        const h = headY - tailY + NOTE_HEIGHT
        if (h <= 0) {
          g.visible = false
          continue
        }
        g.roundRect(x, top, w, h, 4).fill({ color: color.note, alpha: note.holding ? 0.95 : 0.8 })
        g.rect(x, top + h - 4, w, 4).fill({ color: color.head, alpha: 1 })
      } else {
        // 일반 노트
        const top = startY - NOTE_HEIGHT
        g.roundRect(x, top, w, NOTE_HEIGHT, 5).fill({ color: color.note, alpha: 1 })
        g.rect(x, top + NOTE_HEIGHT - 4, w, 4).fill({ color: color.head, alpha: 1 })
      }
    }
    // 남는 풀은 숨김
    for (let i = notes.length; i < this.notePool.length; i++) {
      this.notePool[i].visible = false
    }

    // --- 히트 버스트 (성공 히트 시 판정선에서 터짐) ---
    // PERFECT는 화려하게(스파크+이중 링+플래시), GREAT 이하는 일반 버스트.
    for (let i = 0; i < this.keys; i++) {
      const fx = this.hitFx[i]
      const type = state.laneHitType[i]
      const life = type === 'PERFECT' ? PERFECT_FX_MS : HIT_FX_MS
      const age = timeMs - state.laneHitAt[i]
      if (age < 0 || age >= life || !type) {
        fx.visible = false
        continue
      }
      const p = age / life // 0 → 1
      const ease = 1 - (1 - p) * (1 - p) // out-quad (퍼지는 속도 감속)
      const alpha = 1 - p
      const color = getLaneColor(i, this.keys)
      const cx = i * this.laneWidth + this.laneWidth / 2
      const cy = judgeY
      const half = this.laneWidth / 2

      // 사각별 반짝임: 빠르게 솟았다(0→0.2) 사그라듦(0.2→1)
      const tw = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8
      const rot = p * 0.4 // 살짝 회전

      fx.clear()
      fx.visible = true

      if (type === 'PERFECT') {
        // 1) 큰 소프트 글로우(블룸) + 흰 플래시 코어
        fx.circle(cx, cy, half * 1.5 * (1 - p)).fill({ color: color.glow, alpha: alpha * 0.5 })
        fx.circle(cx, cy, half * 0.8 * (1 - p)).fill({ color: 0xffffff, alpha: alpha * 0.95 })
        // 2) 이중 확장 링
        fx.circle(cx, cy, half * 0.4 + ease * half * 1.4).stroke({
          width: 4 * (1 - p),
          color: 0xffffff,
          alpha: alpha * 0.9,
        })
        fx.circle(cx, cy, ease * half * 2.0).stroke({
          width: 2 * (1 - p),
          color: color.glow,
          alpha: alpha * 0.6,
        })
        // 3) 사각별 — 색상(큰) 위에 흰색(작은)을 겹쳐 강하게 빛남
        const R = half * (1.0 + 1.4 * tw)
        this.star(fx, cx, cy, R, rot, color.note, alpha * 0.9)
        this.star(fx, cx, cy, R * 0.62, rot, 0xffffff, alpha)
      } else {
        // 일반 (GREAT/GOOD/BAD)
        fx.circle(cx, cy, half * 0.5 + ease * half * 0.9).stroke({
          width: 3 * (1 - p),
          color: color.glow,
          alpha: alpha * 0.8,
        })
        fx.circle(cx, cy, half * 0.45 * (1 - p)).fill({ color: 0xffffff, alpha: alpha * 0.7 })
        // 작은 사각별
        const R = half * (0.6 + 0.8 * tw)
        this.star(fx, cx, cy, R, rot, color.head, alpha * 0.7)
        this.star(fx, cx, cy, R * 0.55, rot, 0xffffff, alpha * 0.85)
      }
    }

    // --- 키프레스 하이라이트 ---
    for (let i = 0; i < this.keys; i++) {
      this.laneGlow[i].visible = state.pressedLanes[i] ?? false
    }

    // --- HUD ---
    // 콤보: 값이 바뀔 때마다 팝(스케일 오버슈트)
    if (state.combo > 0) {
      this.comboText.visible = true
      this.comboText.text = String(state.combo)
      if (state.combo !== this.lastCombo) this.comboPopAt = timeMs
      const cp = Math.min(1, Math.max(0, (timeMs - this.comboPopAt) / 150))
      this.comboText.scale.set(1 + 0.45 * (1 - cp) * (1 - cp)) // 1.45 → 1
    } else {
      this.comboText.visible = false
    }
    this.lastCombo = state.combo

    this.accText.text = `${state.accuracy.toFixed(2)}%`

    // 판정 텍스트: 등장 시 팝 + 위로 떠오르며 페이드
    const jr = state.judgeResult
    if (jr) {
      if (jr.id !== this.lastJudgeId) {
        // 새 판정에만 텍스트/색 갱신 (매 프레임 재생성 방지)
        this.lastJudgeId = jr.id
        this.judgeText.text = jr.type
        this.judgeText.style.fill = JUDGE_COLOR[jr.type]
      }
      const age = timeMs - state.judgeAtMs
      if (age >= 0 && age < JUDGE_FADE_MS) {
        const f = age / JUDGE_FADE_MS
        this.judgeText.alpha = 1 - f * f // 후반에 빠르게 사라짐
        const jp = Math.min(1, age / 110)
        this.judgeText.scale.set(1 + 0.6 * (1 - jp) * (1 - jp)) // 1.6 → 1
        this.judgeText.y = this.judgeTextBaseY - 16 * f // 위로 떠오름
      } else {
        this.judgeText.alpha = 0
      }
    } else {
      this.judgeText.alpha = 0 // 판정 없음(되감기 직후 등)
    }
  }

  /** 4각 반짝임(사각별) 패스를 그리고 채운다. */
  private star(g: Graphics, cx: number, cy: number, r: number, rot: number, color: number, alpha: number) {
    const inner = r * 0.16
    const pts: number[] = []
    for (let k = 0; k < 4; k++) {
      const a = rot + (k * Math.PI) / 2
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      const ai = a + Math.PI / 4
      pts.push(cx + Math.cos(ai) * inner, cy + Math.sin(ai) * inner)
    }
    g.poly(pts).fill({ color, alpha })
  }

  private getNoteGraphic(index: number): Graphics {
    let g = this.notePool[index]
    if (!g) {
      g = new Graphics()
      this.notePool[index] = g
      this.noteLayer.addChild(g)
    }
    return g
  }

  destroy() {
    // field 및 모든 자식 그래픽/텍스트 해제
    this.field.destroy({ children: true })
  }
}
