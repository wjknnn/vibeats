import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { audioEngine } from '@/audio/AudioEngine'
import { loadBeatmap } from '@/data/beatmap'
import { getSongById } from '@/data/songs'
import { useCommonStore } from '@/store'
import { getLaneColor, KEY_BINDINGS } from '@/game'

// dev 전용 채보 에디터. 캔버스 타임라인에서 노트를 배치/이동/리사이즈/녹음하고 JSON 저장.

const KEYS = 4
const PLAYER_W = 480
const LANE_W = PLAYER_W / KEYS
const NOTE_H = 30 // 두꺼운 탭 노트
const CANVAS_H = 680
const PLAYHEAD_Y = CANVAS_H * 0.82
const KEYMAP = KEY_BINDINGS[KEYS]
const MINIMAP_W = 90
const GRAB_PX = 9 // 롱노트 끝 잡기 허용 픽셀

type EditNote = { lane: number; time: number; endTime: number }
type Drag =
  | { mode: 'create'; lane: number; startTime: number; startY: number; curY: number; curX: number }
  | { mode: 'move'; target: EditNote; grabTime: number; isLong: boolean; len: number }
  | { mode: 'resize'; target: EditNote; end: 'head' | 'tail' }

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toFixed(2).padStart(5, '0')}`
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export default function EditorPage() {
  const navigate = useNavigate()
  const selectedMusicId = useCommonStore((s) => s.selectedMusicId)
  const song = getSongById(selectedMusicId ?? 1)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const minimapRef = useRef<HTMLCanvasElement>(null)
  const notesRef = useRef<EditNote[]>([])
  const timeRef = useRef(0)
  const durationRef = useRef(0)
  const playingRef = useRef(false)
  const playStartCtxRef = useRef(0)
  const playFromRef = useRef(0)
  const readyRef = useRef(false)
  const rafRef = useRef(0)
  const songIdRef = useRef('')

  const bpmRef = useRef(0)
  const firstBeatRef = useRef(0)
  const zoomRef = useRef(0.4)
  const snapDivRef = useRef(4)
  const snapOnRef = useRef(true)
  const keyRecRef = useRef(true)
  const heldRef = useRef<Map<number, number>>(new Map())

  const mouseRef = useRef({ x: 0, y: 0, inside: false, shift: false, ctrl: false, alt: false })
  const dragRef = useRef<Drag | null>(null)
  const guideRef = useRef<number | null>(null) // alt 정렬 스냅 가이드 시각(ms)
  const miniDragRef = useRef(false)
  const miniYRef = useRef(0)
  const undoRef = useRef<EditNote[][]>([])
  const redoRef = useRef<EditNote[][]>([])
  const dragBeforeRef = useRef<EditNote[] | null>(null)

  const [bpm, setBpm] = useState(0)
  const [firstBeat, setFirstBeat] = useState(0)
  const [offset, setOffset] = useState(0)
  const [zoom, setZoom] = useState(0.4)
  const [snapDiv, setSnapDiv] = useState(4)
  const [snapOn, setSnapOn] = useState(true)
  const [keyRec, setKeyRec] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [noteCount, setNoteCount] = useState(0)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => void (bpmRef.current = bpm), [bpm])
  useEffect(() => void (firstBeatRef.current = firstBeat), [firstBeat])
  useEffect(() => void (zoomRef.current = zoom), [zoom])
  useEffect(() => void (snapDivRef.current = snapDiv), [snapDiv])
  useEffect(() => void (snapOnRef.current = snapOn), [snapOn])
  useEffect(() => void (keyRecRef.current = keyRec), [keyRec])

  // --- 좌표/스냅 ---
  const laneFromX = (x: number) => clamp(Math.floor(x / LANE_W), 0, KEYS - 1)
  const timeFromY = (y: number) => timeRef.current + (PLAYHEAD_Y - y) / zoomRef.current
  const gridSnap = (t: number) => {
    if (!snapOnRef.current || bpmRef.current <= 0) return Math.round(t)
    const step = 60000 / bpmRef.current / snapDivRef.current
    return Math.round(firstBeatRef.current + Math.round((t - firstBeatRef.current) / step) * step)
  }
  // 순수 스냅: alt면 다른 노트 시각에 정렬(Figma식), 아니면 그리드. {time, guide} 반환.
  const snapPure = (t: number, alt: boolean, exclude: EditNote | null) => {
    if (alt) {
      const thr = 8 / zoomRef.current
      let best: number | null = null
      let bestD = thr
      for (const n of notesRef.current) {
        if (n === exclude) continue
        const cands = n.endTime > 0 ? [n.time, n.endTime] : [n.time]
        for (const c of cands) {
          const d = Math.abs(c - t)
          if (d <= bestD) {
            bestD = d
            best = c
          }
        }
      }
      if (best !== null) return { time: best, guide: best }
      return { time: Math.round(t), guide: null }
    }
    return { time: gridSnap(t), guide: null }
  }
  const applySnap = (t: number, exclude: EditNote | null) => {
    const r = snapPure(t, mouseRef.current.alt, exclude)
    guideRef.current = r.guide
    return r.time
  }

  const hitNote = (lane: number, y: number, T: number, px: number) => {
    for (const n of notesRef.current) {
      if (n.lane !== lane) continue
      const yHead = PLAYHEAD_Y - (n.time - T) * px
      if (n.endTime > 0) {
        const yTail = PLAYHEAD_Y - (n.endTime - T) * px
        if (Math.abs(y - yHead) <= GRAB_PX) return { note: n, part: 'head' as const }
        if (Math.abs(y - yTail) <= GRAB_PX) return { note: n, part: 'tail' as const }
        if (y >= yTail - GRAB_PX && y <= yHead + GRAB_PX) return { note: n, part: 'body' as const }
      } else if (Math.abs(y - yHead) <= NOTE_H / 2 + 2) {
        return { note: n, part: 'body' as const }
      }
    }
    return null
  }

  const finalize = () => {
    notesRef.current.sort((a, b) => a.time - b.time || a.lane - b.lane)
    setNoteCount(notesRef.current.length)
    setSaveMsg('')
  }

  // --- 실행 취소 / 다시 실행 ---
  const snapshot = () => notesRef.current.map((n) => ({ ...n }))
  const ser = (a: EditNote[]) =>
    JSON.stringify(
      [...a]
        .sort((x, y) => x.time - y.time || x.lane - y.lane || x.endTime - y.endTime)
        .map((n) => [n.lane, n.time, n.endTime]),
    )
  const commitIfChanged = (prev: EditNote[]) => {
    if (ser(prev) === ser(notesRef.current)) return
    undoRef.current.push(prev)
    if (undoRef.current.length > 200) undoRef.current.shift()
    redoRef.current = []
  }
  const undo = () => {
    const prev = undoRef.current.pop()
    if (!prev) return
    redoRef.current.push(snapshot())
    notesRef.current = prev
    finalize()
  }
  const redo = () => {
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push(snapshot())
    notesRef.current = next
    finalize()
  }

  // --- 재생 ---
  const play = async () => {
    if (!readyRef.current) return
    await audioEngine.resume()
    audioEngine.play(songIdRef.current, timeRef.current / 1000)
    playStartCtxRef.current = audioEngine.context.currentTime
    playFromRef.current = timeRef.current
    playingRef.current = true
    setPlaying(true)
  }
  const pause = () => {
    audioEngine.stop(songIdRef.current)
    playingRef.current = false
    setPlaying(false)
  }
  const togglePlay = () => (playingRef.current ? pause() : play())
  const seekTo = (ms: number) => {
    if (playingRef.current) pause()
    timeRef.current = clamp(ms, 0, durationRef.current || Infinity)
  }
  const seekBy = (d: number) => seekTo(timeRef.current + d)

  // --- 마운트 ---
  useEffect(() => {
    if (!song || !song.beatmapUrl) {
      navigate('/music-list', { replace: true })
      return
    }
    let cancelled = false
    const id = `song_editor_${song.id}`
    songIdRef.current = id

    loadBeatmap(song.beatmapUrl).then((raw) => {
      if (cancelled) return
      notesRef.current = raw.map.map(([lane, time, endTime]) => ({ lane, time, endTime }))
      setNoteCount(notesRef.current.length)
      setBpm(raw.bpm ?? song.bpm)
      setFirstBeat(raw.firstBeatMs ?? song.firstBeatMs ?? 0)
      setOffset(raw.offset ?? song.offset ?? 0)
    })

    audioEngine.addPlayer('song', `editor_${song.id}`, song.musicUrl, { volume: song.volume }).then(() => {
      if (cancelled) return // StrictMode 더블마운트: 여기서 removePlayer 하면 안 됨(같은 id 레이스)
      durationRef.current = (audioEngine.getPlayer(id)?.buffer.duration ?? 0) * 1000
      readyRef.current = true
    })

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      if (playingRef.current) {
        const t = (audioEngine.context.currentTime - playStartCtxRef.current) * 1000 + playFromRef.current
        timeRef.current = t
        if (durationRef.current && t >= durationRef.current) {
          timeRef.current = durationRef.current
          pause()
        }
      }
      render()
      renderMinimap()
    }
    rafRef.current = requestAnimationFrame(draw)

    const setMods = (e: KeyboardEvent) => {
      mouseRef.current.shift = e.shiftKey
      mouseRef.current.ctrl = e.ctrlKey || e.metaKey
      mouseRef.current.alt = e.altKey
    }
    const onKey = (e: KeyboardEvent) => {
      setMods(e)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
        return
      }
      const step = snapOnRef.current && bpmRef.current ? 60000 / bpmRef.current / snapDivRef.current : 100
      if (e.key === 'ArrowLeft') return seekBy(-step)
      if (e.key === 'ArrowRight') return seekBy(step)
      if (!keyRecRef.current || e.repeat) return
      const lane = KEYMAP.indexOf(e.key)
      if (lane !== -1) heldRef.current.set(lane, gridSnap(timeRef.current))
    }
    const onKeyUp = (e: KeyboardEvent) => {
      setMods(e)
      if (!keyRecRef.current) return
      const lane = KEYMAP.indexOf(e.key)
      if (lane === -1) return
      const start = heldRef.current.get(lane)
      if (start === undefined) return
      heldRef.current.delete(lane)
      const prev = snapshot()
      const end = gridSnap(timeRef.current)
      notesRef.current.push({ lane, time: start, endTime: end - start > 80 ? end : 0 })
      finalize()
      commitIfChanged(prev)
    }
    // Ctrl+휠 줌은 브라우저 페이지 줌을 막아야 하므로 non-passive 네이티브 리스너
    const cv = canvasRef.current
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const f = e.deltaY < 0 ? 1.12 : 1 / 1.12
        setZoom((z) => +clamp(z * f, 0.05, 2).toFixed(3))
      } else {
        seekBy(e.deltaY / zoomRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    cv?.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      cv?.removeEventListener('wheel', onWheel)
      audioEngine.stop(id)
      audioEngine.removePlayer(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- 노트 1개 그리기 (실제/고스트 공용) ---
  const drawNote = (ctx: CanvasRenderingContext2D, n: EditNote, T: number, px: number, ghost: boolean) => {
    const c = getLaneColor(n.lane, KEYS)
    const x = n.lane * LANE_W + 3
    const w = LANE_W - 6
    const yHead = PLAYHEAD_Y - (n.time - T) * px
    ctx.globalAlpha = ghost ? 0.4 : 1
    if (n.endTime > 0) {
      const yTail = PLAYHEAD_Y - (n.endTime - T) * px
      ctx.fillStyle = hex(c.note)
      ctx.fillRect(x, yTail, w, yHead - yTail)
      ctx.fillStyle = '#ffffff' // 양 끝 판정 기준선
      ctx.fillRect(x, yHead - 1.5, w, 3)
      ctx.fillRect(x, yTail - 1.5, w, 3)
    } else {
      ctx.fillStyle = hex(c.note)
      ctx.fillRect(x, yHead - NOTE_H / 2, w, NOTE_H)
      ctx.fillStyle = '#ffffff' // 중앙 판정 기준선
      ctx.fillRect(x, yHead - 1.5, w, 3)
    }
    ctx.globalAlpha = 1
  }

  // 호버한 노트(또는 끝) 하이라이트
  const highlightNote = (
    ctx: CanvasRenderingContext2D,
    n: EditNote,
    T: number,
    px: number,
    part: 'body' | 'head' | 'tail',
  ) => {
    const x = n.lane * LANE_W + 3
    const w = LANE_W - 6
    const yHead = PLAYHEAD_Y - (n.time - T) * px
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'
    ctx.lineWidth = 2
    if (n.endTime > 0) {
      const yTail = PLAYHEAD_Y - (n.endTime - T) * px
      ctx.strokeRect(x - 1, yTail - 1, w + 2, yHead - yTail + 2)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      if (part === 'head') ctx.fillRect(x - 2, yHead - 3, w + 4, 6)
      if (part === 'tail') ctx.fillRect(x - 2, yTail - 3, w + 4, 6)
    } else {
      ctx.strokeRect(x - 1, yHead - NOTE_H / 2 - 1, w + 2, NOTE_H + 2)
    }
  }

  const render = () => {
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const T = timeRef.current
    const px = zoomRef.current
    ctx.clearRect(0, 0, PLAYER_W, CANVAS_H)
    ctx.fillStyle = '#0a0a12'
    ctx.fillRect(0, 0, PLAYER_W, CANVAS_H)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    for (let i = 1; i < KEYS; i++) ctx.fillRect(i * LANE_W - 0.5, 0, 1, CANVAS_H)

    // 그리드
    if (bpmRef.current > 0) {
      const beatMs = 60000 / bpmRef.current
      const top = T + PLAYHEAD_Y / px
      const bottom = T - (CANVAS_H - PLAYHEAD_Y) / px
      let k = Math.floor((bottom - firstBeatRef.current) / beatMs)
      let lt = firstBeatRef.current + k * beatMs
      while (lt <= top) {
        const y = PLAYHEAD_Y - (lt - T) * px
        const measure = (((k % 4) + 4) % 4) === 0
        ctx.fillStyle = measure ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'
        ctx.fillRect(0, y, PLAYER_W, measure ? 2 : 1)
        k++
        lt += beatMs
      }
    }

    // 노트
    for (const n of notesRef.current) drawNote(ctx, n, T, px, false)

    // create 드래그 프리뷰
    const d = dragRef.current
    if (d && d.mode === 'create') {
      const a = PLAYHEAD_Y - (d.startTime - T) * px
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.strokeRect(d.lane * LANE_W + 3, Math.min(a, d.curY), LANE_W - 6, Math.abs(a - d.curY))
    }

    // alt 정렬 가이드
    if (guideRef.current !== null) {
      const gy = PLAYHEAD_Y - (guideRef.current - T) * px
      ctx.fillStyle = 'rgba(255,80,180,0.9)'
      ctx.fillRect(0, gy - 0.5, PLAYER_W, 1)
    }

    // 커서 + 호버 (드래그 중 아닐 때만 호버 표시)
    const m = mouseRef.current
    let cursor = 'crosshair'
    if (d) {
      cursor = d.mode === 'resize' ? 'ns-resize' : d.mode === 'move' ? 'grabbing' : 'crosshair'
    } else if (m.inside) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.fillRect(0, m.y, PLAYER_W, 1) // 따라오는 가로선
      const hit = hitNote(laneFromX(m.x), m.y, T, px)
      if (hit) {
        // 노트 위: 생성 프리뷰 대신 호버 하이라이트
        highlightNote(ctx, hit.note, T, px, hit.part)
        cursor = hit.part === 'head' || hit.part === 'tail' ? 'ns-resize' : 'grab'
      } else {
        // 빈 곳: 생성될 노트 프리뷰
        const t = snapPure(timeFromY(m.y), m.alt, null).time
        drawNote(ctx, { lane: laneFromX(m.x), time: t, endTime: 0 }, T, px, true)
      }
    }
    cv.style.cursor = cursor

    // 플레이헤드
    ctx.fillStyle = 'rgba(120,200,255,0.95)'
    ctx.fillRect(0, PLAYHEAD_Y - 1, PLAYER_W, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = '12px sans-serif'
    ctx.fillText(fmt(T), 6, PLAYHEAD_Y + 16)
  }

  const renderMinimap = () => {
    const cv = minimapRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const dur = durationRef.current
    ctx.clearRect(0, 0, MINIMAP_W, CANVAS_H)
    ctx.fillStyle = '#08080e'
    ctx.fillRect(0, 0, MINIMAP_W, CANVAS_H)
    if (dur <= 0) return
    const scale = CANVAS_H / dur
    // 위아래 반전: 시각 0 = 아래, 끝 = 위 (게임 진행 방향과 동일)
    const yOf = (t: number) => CANVAS_H - t * scale
    // 레인을 좁은 간격으로 묶어 배치 (갭 축소)
    const SQ = 4
    const STEP = SQ + 2
    const laneX = (lane: number) => (MINIMAP_W - STEP * KEYS) / 2 + lane * STEP

    // 시간 눈금 + 라벨
    const durSec = dur / 1000
    const tickSec = durSec < 60 ? 10 : durSec < 180 ? 30 : 60
    ctx.font = '9px sans-serif'
    for (let s = 0; s * 1000 <= dur; s += tickSec) {
      const y = yOf(s * 1000)
      ctx.fillStyle = 'rgba(255,255,255,0.09)'
      ctx.fillRect(0, y, MINIMAP_W, 1)
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.fillText(fmt(s * 1000), 3, y - 2)
    }

    // 노트 (정사각형)
    for (const n of notesRef.current) {
      const c = getLaneColor(n.lane, KEYS)
      const x = laneX(n.lane)
      ctx.fillStyle = hex(c.note)
      if (n.endTime > 0) {
        const yh = yOf(n.time)
        const yt = yOf(n.endTime)
        ctx.fillRect(x, Math.min(yh, yt), SQ, Math.abs(yh - yt) || SQ)
      } else {
        ctx.fillRect(x, yOf(n.time) - SQ / 2, SQ, SQ)
      }
    }

    // 뷰포트
    const px = zoomRef.current
    const T = timeRef.current
    const y0 = yOf(T - (CANVAS_H - PLAYHEAD_Y) / px)
    const y1 = yOf(T + PLAYHEAD_Y / px)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(0, Math.min(y0, y1), MINIMAP_W, Math.abs(y1 - y0))
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.strokeRect(0.5, Math.min(y0, y1), MINIMAP_W - 1, Math.abs(y1 - y0))
    // 플레이헤드
    ctx.fillStyle = 'rgba(120,200,255,0.95)'
    ctx.fillRect(0, yOf(T) - 1, MINIMAP_W, 2)

    // 드래그 중 시간 툴팁
    if (miniDragRef.current) {
      const my = miniYRef.current
      const t = clamp((1 - my / CANVAS_H) * dur, 0, dur)
      const label = fmt(t)
      ctx.font = '11px sans-serif'
      const tw = ctx.measureText(label).width
      const by = clamp(my, 9, CANVAS_H - 9)
      ctx.fillStyle = 'rgba(0,0,0,0.85)'
      ctx.fillRect(MINIMAP_W - tw - 12, by - 9, tw + 10, 18)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, MINIMAP_W - tw - 7, by + 4)
    }
  }

  // --- 마우스 (메인 캔버스) ---
  const pos = (e: React.MouseEvent, el: HTMLCanvasElement | null) => {
    const r = el!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const updateMods = (e: React.MouseEvent) => {
    mouseRef.current.shift = e.shiftKey
    mouseRef.current.ctrl = e.ctrlKey || e.metaKey
    mouseRef.current.alt = e.altKey
  }
  const onDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    updateMods(e)
    dragBeforeRef.current = snapshot() // 실행취소용: 변경 직전 상태
    const { x, y } = pos(e, canvasRef.current)
    const T = timeRef.current
    const px = zoomRef.current
    const lane = laneFromX(x)
    const hit = hitNote(lane, y, T, px)
    if (hit) {
      if (hit.part === 'head' || hit.part === 'tail') {
        dragRef.current = { mode: 'resize', target: hit.note, end: hit.part }
        return
      }
      let target = hit.note
      if (mouseRef.current.ctrl) {
        target = { ...hit.note } // Ctrl+드래그 = 복제본을 이동
        notesRef.current.push(target)
      }
      dragRef.current = {
        mode: 'move',
        target,
        grabTime: timeFromY(y) - target.time,
        isLong: target.endTime > 0,
        len: target.endTime > 0 ? target.endTime - target.time : 0,
      }
      return
    }
    const time = applySnap(timeFromY(y), null)
    dragRef.current = { mode: 'create', lane, startTime: Math.max(0, time), startY: y, curY: y, curX: x }
  }
  const onMove = (e: React.MouseEvent) => {
    updateMods(e)
    const { x, y } = pos(e, canvasRef.current)
    mouseRef.current.x = x
    mouseRef.current.y = y
    mouseRef.current.inside = true
    const d = dragRef.current
    if (!d) return
    if (d.mode === 'create') {
      d.curY = y
      d.curX = x
    } else if (d.mode === 'move') {
      const head = Math.max(0, applySnap(timeFromY(y) - d.grabTime, d.target))
      d.target.time = head
      if (d.isLong) d.target.endTime = head + d.len
      if (!mouseRef.current.shift) d.target.lane = laneFromX(x) // shift면 라인 고정
    } else if (d.mode === 'resize') {
      const t = Math.max(0, applySnap(timeFromY(y), d.target))
      const minLen = Math.max(40, bpmRef.current > 0 ? 60000 / bpmRef.current / 8 : 60)
      if (d.end === 'head') d.target.time = Math.min(t, d.target.endTime - minLen)
      else d.target.endTime = Math.max(t, d.target.time + minLen)
    }
  }
  const onUp = () => {
    const d = dragRef.current
    dragRef.current = null
    guideRef.current = null
    const before = dragBeforeRef.current
    dragBeforeRef.current = null
    if (!d) return
    if (d.mode === 'create') {
      const moved = Math.abs(d.curY - d.startY) > 6
      let placed = false
      if (moved) {
        const end = applySnap(timeFromY(d.curY), null)
        const a = Math.max(0, Math.min(d.startTime, end))
        const b = Math.max(d.startTime, end)
        if (b - a > 80) {
          notesRef.current.push({ lane: d.lane, time: a, endTime: b })
          placed = true
        }
      }
      if (!placed) notesRef.current.push({ lane: d.lane, time: d.startTime, endTime: 0 })
    }
    finalize()
    if (before) commitIfChanged(before)
  }
  const onLeave = () => {
    mouseRef.current.inside = false
    onUp()
  }
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const { x, y } = pos(e, canvasRef.current)
    const hit = hitNote(laneFromX(x), y, timeRef.current, zoomRef.current)
    if (hit) {
      const prev = snapshot()
      notesRef.current = notesRef.current.filter((n) => n !== hit.note)
      finalize()
      commitIfChanged(prev)
    }
  }

  // --- 미니맵 클릭 시킹 ---
  const miniSeek = (e: React.MouseEvent) => {
    const { y } = pos(e, minimapRef.current)
    miniYRef.current = y
    // 반전 매핑: 위=끝, 아래=시작
    seekTo((1 - y / CANVAS_H) * (durationRef.current || 0))
  }
  const onMiniDown = (e: React.MouseEvent) => {
    miniDragRef.current = true
    miniSeek(e)
  }
  const onMiniMove = (e: React.MouseEvent) => {
    if (miniDragRef.current) miniSeek(e)
  }

  const save = async () => {
    if (!song) return
    const data = {
      bpm,
      offset,
      firstBeatMs: firstBeat,
      map: [...notesRef.current]
        .sort((a, b) => a.time - b.time || a.lane - b.lane)
        .map((n) => [n.lane, n.time, n.endTime]),
    }
    try {
      const res = await fetch('/__save-beatmap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: song.beatmapUrl, data }),
      })
      setSaveMsg(res.ok ? '저장됨 ✓' : '저장 실패')
    } catch {
      setSaveMsg('저장 실패 (dev 서버?)')
    }
  }

  if (!song) return null

  const btn =
    'px-3 py-1.5 rounded-md text-[13px] font-semibold bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] text-white/80 transition-colors cursor-pointer'
  const numInput = 'w-20 px-2 py-1 rounded bg-white/[0.06] border border-white/[0.1] text-white/90 text-[13px] tabular-nums'

  return (
    <main className="min-h-dvh w-full bg-[#050508] text-white/90 flex flex-col">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-white/[0.08] text-[13px]">
        <button className={btn} onClick={() => navigate('/music-list', { replace: true })}>
          ← 목록
        </button>
        <span className="font-bold px-2">
          {song.artist} — {song.title}
        </span>
        <button className={btn} onClick={() => seekTo(0)}>
          ⏮
        </button>
        <button className={btn} onClick={togglePlay}>
          {playing ? '⏸ 정지' : '▶ 재생 (Space)'}
        </button>
        <label className="flex items-center gap-1">
          줌
          <button className={btn} onClick={() => setZoom((z) => +clamp(z - 0.05, 0.05, 2).toFixed(3))}>
            −
          </button>
          <span className="tabular-nums w-10 text-center">{zoom.toFixed(2)}</span>
          <button className={btn} onClick={() => setZoom((z) => +clamp(z + 0.05, 0.05, 2).toFixed(3))}>
            ＋
          </button>
        </label>
        <label className="flex items-center gap-1">
          스냅
          <input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} />
          <select
            className="bg-white/[0.06] border border-white/[0.1] rounded px-1 py-1"
            value={snapDiv}
            onChange={(e) => setSnapDiv(Number(e.target.value))}
          >
            <option value={1}>1/1</option>
            <option value={2}>1/2</option>
            <option value={4}>1/4</option>
            <option value={8}>1/8</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          키 녹음
          <input type="checkbox" checked={keyRec} onChange={(e) => setKeyRec(e.target.checked)} />
        </label>
      </div>

      <div className="flex flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          width={PLAYER_W}
          height={CANVAS_H}
          style={{ width: PLAYER_W, height: CANVAS_H }}
          className="m-4 rounded-lg border border-white/[0.08] cursor-crosshair select-none"
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onLeave}
          onContextMenu={onContextMenu}
        />

        {/* 미니맵 (vscode식) */}
        <canvas
          ref={minimapRef}
          width={MINIMAP_W}
          height={CANVAS_H}
          style={{ width: MINIMAP_W, height: CANVAS_H }}
          className="my-4 rounded border border-white/[0.08] cursor-pointer select-none"
          onMouseDown={onMiniDown}
          onMouseMove={onMiniMove}
          onMouseUp={() => (miniDragRef.current = false)}
          onMouseLeave={() => (miniDragRef.current = false)}
        />

        <div className="flex-1 p-4 flex flex-col gap-4 text-[13px] max-w-[360px]">
          <section className="flex flex-col gap-2">
            <h3 className="text-white/40 font-bold tracking-wider uppercase text-[11px]">타이밍 (저장됨)</h3>
            <label className="flex items-center justify-between">
              BPM
              <input className={numInput} type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
            </label>
            <label className="flex items-center justify-between">
              offset (ms)
              <input className={numInput} type="number" value={offset} onChange={(e) => setOffset(Number(e.target.value))} />
            </label>
            <label className="flex items-center justify-between">
              firstBeat (ms)
              <input
                className={numInput}
                type="number"
                value={firstBeat}
                onChange={(e) => setFirstBeat(Number(e.target.value))}
              />
            </label>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-white/40 font-bold tracking-wider uppercase text-[11px]">노트</h3>
            <div className="text-white/60">총 {noteCount}개</div>
            <button className={btn} onClick={save}>
              💾 저장 (JSON 파일에 기록)
            </button>
            <button className={btn} onClick={() => navigate('/game')}>
              ▶ 플레이 테스트 (저장본 기준)
            </button>
            {saveMsg && <div className="text-emerald-400/80">{saveMsg}</div>}
          </section>

          <section className="text-white/40 text-[12px] leading-relaxed mt-auto">
            <p className="font-bold text-white/50 mb-1">조작</p>
            <p>· 빈 곳 클릭: 탭 / 위아래 드래그: 롱노트</p>
            <p>· 노트 드래그: 이동 · 우클릭: 삭제</p>
            <p>· Shift+드래그: 같은 라인 고정</p>
            <p>· Ctrl+드래그: 복제해서 이동</p>
            <p>· 롱노트 끝 드래그: 길이 조절</p>
            <p>· Alt+드래그: 다른 노트에 정렬 스냅</p>
            <p>· 휠: 스크럽 · Ctrl+휠: 줌 · Space: 재생</p>
            <p>· 키 녹음 ON + 재생 중 D/F/J/K</p>
            <p>· Ctrl+Z: 실행취소 · Shift+Ctrl+Z: 다시실행</p>
          </section>
        </div>
      </div>
    </main>
  )
}
