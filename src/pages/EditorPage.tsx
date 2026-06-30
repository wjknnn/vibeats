import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { audioEngine } from '@/audio/AudioEngine'
import { loadBeatmap } from '@/data/beatmap'
import { getSongById, getChart, chartsForKeys, saveSongs, formatArtist, KEY_MODES, DIFFICULTIES, DIFFICULTY_COLORS } from '@/data/songs'
import { useCommonStore } from '@/store'
import { getLaneColor, laneForKey } from '@/game'

// dev 전용 채보 에디터. 4/5/6키 + 키수×난이도 차트별 편집/생성/저장.

const PLAYER_W = 480
const NOTE_H = 30
const CANVAS_H = 680 // 초기/폴백 높이 (실제 높이는 창에 맞춰 가변)
const JUDGE_RATIO = 0.82
const MINIMAP_W = 90
const GRAB_PX = 9

type EditNote = { lane: number; time: number; endTime: number }
type Drag =
  | { mode: 'create'; lane: number; startTime: number; startY: number; curY: number; curX: number }
  | { mode: 'move'; target: EditNote; grabTime: number; isLong: boolean; len: number }
  | { mode: 'resize'; target: EditNote; end: 'head' | 'tail' }

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart'

export default function EditorPage() {
  const navigate = useNavigate()
  const selectedMusicId = useCommonStore((s) => s.selectedMusicId)
  const selKeys = useCommonStore((s) => s.selectedKeys)
  const selDiff = useCommonStore((s) => s.selectedDifficulty)
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
  const waveRef = useRef<HTMLCanvasElement>(null)
  const waveDataRef = useRef<Float32Array | null>(null)
  const sampleRateRef = useRef(44100)
  const metroRef = useRef(false)
  const metroBeatRef = useRef(0)
  const metroPrimedRef = useRef(false)
  const noteSoundRef = useRef(false)
  const lastSoundTimeRef = useRef(0)
  const timeLabelRef = useRef<HTMLSpanElement>(null)
  const viewHRef = useRef(CANVAS_H) // 현재 캔버스 픽셀 높이(가변)

  const keysRef = useRef(selKeys || 4)
  const bpmRef = useRef(song?.bpm ?? 0)
  const firstBeatRef = useRef(song?.firstBeatMs ?? 0)
  const zoomRef = useRef(0.4)
  const snapDivRef = useRef(4)
  const snapOnRef = useRef(true)
  const keyRecRef = useRef(true)
  const heldRef = useRef<Map<number, number>>(new Map())

  const mouseRef = useRef({ x: 0, y: 0, inside: false, shift: false, ctrl: false, alt: false })
  const dragRef = useRef<Drag | null>(null)
  const guideRef = useRef<number | null>(null)
  const miniDragRef = useRef(false)
  const miniYRef = useRef(0)
  const undoRef = useRef<EditNote[][]>([])
  const redoRef = useRef<EditNote[][]>([])
  const dragBeforeRef = useRef<EditNote[] | null>(null)

  const [keys, setKeys] = useState(selKeys || 4)
  const [difficulty, setDifficulty] = useState(selDiff || 'NORMAL')
  const [level, setLevel] = useState(1)
  const [title, setTitle] = useState(song?.title ?? '')
  const [artist, setArtist] = useState(song ? formatArtist(song.artist) : '')
  const [cover, setCover] = useState(song?.cover ?? '')
  const [license, setLicense] = useState(song?.license ?? '')
  const [previewStart, setPreviewStart] = useState(song?.previewStart ?? 0)
  const [previewEnd, setPreviewEnd] = useState(song?.previewEnd ?? 0)
  const [bpm, setBpm] = useState(song?.bpm ?? 0)
  const [firstBeat, setFirstBeat] = useState(song?.firstBeatMs ?? 0)
  const [offset, setOffset] = useState(song?.offset ?? 0)
  const [zoom, setZoom] = useState(0.4)
  const [snapDiv, setSnapDiv] = useState(4)
  const [snapOn, setSnapOn] = useState(true)
  const [keyRec, setKeyRec] = useState(true)
  const [metro, setMetro] = useState(false)
  const [noteSound, setNoteSound] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [noteCount, setNoteCount] = useState(0)
  const [saveMsg, setSaveMsg] = useState('')
  const [chartsVer, setChartsVer] = useState(0) // 차트 칩 갱신 트리거

  useEffect(() => void (keysRef.current = keys), [keys])
  useEffect(() => void (bpmRef.current = bpm), [bpm])
  useEffect(() => void (firstBeatRef.current = firstBeat), [firstBeat])
  useEffect(() => void (zoomRef.current = zoom), [zoom])
  useEffect(() => void (snapDivRef.current = snapDiv), [snapDiv])
  useEffect(() => void (snapOnRef.current = snapOn), [snapOn])
  useEffect(() => void (keyRecRef.current = keyRec), [keyRec])
  useEffect(() => void (metroRef.current = metro), [metro])
  useEffect(() => void (noteSoundRef.current = noteSound), [noteSound])

  // --- 좌표/스냅 ---
  const laneW = () => PLAYER_W / keysRef.current
  const ph = () => viewHRef.current * JUDGE_RATIO // 판정선 y (가변 높이 기준)
  const laneFromX = (x: number) => clamp(Math.floor(x / laneW()), 0, keysRef.current - 1)
  const timeFromY = (y: number) => timeRef.current + (ph() - y) / zoomRef.current
  const gridSnap = (t: number) => {
    if (!snapOnRef.current || bpmRef.current <= 0) return Math.round(t)
    const step = 60000 / bpmRef.current / snapDivRef.current
    return Math.round(firstBeatRef.current + Math.round((t - firstBeatRef.current) / step) * step)
  }
  const snapPure = (t: number, alt: boolean, exclude: EditNote | null) => {
    if (alt) {
      const thr = 8 / zoomRef.current
      let best: number | null = null
      let bestD = thr
      for (const n of notesRef.current) {
        if (n === exclude) continue
        for (const c of n.endTime > 0 ? [n.time, n.endTime] : [n.time]) {
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
    const lw = laneW()
    for (const n of notesRef.current) {
      if (n.lane !== lane) continue
      const yHead = ph() - (n.time - T) * px
      if (n.endTime > 0) {
        const yTail = ph() - (n.endTime - T) * px
        if (Math.abs(y - yHead) <= GRAB_PX) return { note: n, part: 'head' as const }
        if (Math.abs(y - yTail) <= GRAB_PX) return { note: n, part: 'tail' as const }
        if (y >= yTail - GRAB_PX && y <= yHead + GRAB_PX) return { note: n, part: 'body' as const }
      } else if (Math.abs(y - yHead) <= NOTE_H / 2 + 2) {
        return { note: n, part: 'body' as const }
      }
    }
    void lw
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
      [...a].sort((x, y) => x.time - y.time || x.lane - y.lane || x.endTime - y.endTime).map((n) => [n.lane, n.time, n.endTime]),
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

  // --- 차트 전환/로드 ---
  const loadChart = async (k: number, diff: string) => {
    keysRef.current = k
    setKeys(k)
    setDifficulty(diff)
    undoRef.current = []
    redoRef.current = []
    const ch = song ? getChart(song, k, diff) : undefined
    setLevel(ch?.level ?? 1)
    if (ch && ch.beatmapUrl) {
      try {
        const raw = await loadBeatmap(ch.beatmapUrl)
        notesRef.current = raw.map.map(([lane, time, endTime]) => ({ lane, time, endTime }))
      } catch {
        notesRef.current = []
      }
    } else {
      notesRef.current = []
    }
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
    if (!song) {
      navigate('/music-list', { replace: true })
      return
    }
    let cancelled = false
    const id = `song_editor_${song.id}`
    songIdRef.current = id

    const initKeys = selKeys || 4
    const initDiff = selDiff || chartsForKeys(song, initKeys)[0]?.difficulty || 'NORMAL'
    loadChart(initKeys, initDiff)

    audioEngine.addPlayer('song', `editor_${song.id}`, song.musicUrl, { volume: song.volume }).then(() => {
      if (cancelled) return
      const buf = audioEngine.getPlayer(id)?.buffer
      durationRef.current = (buf?.duration ?? 0) * 1000
      if (buf) {
        waveDataRef.current = buf.getChannelData(0)
        sampleRateRef.current = buf.sampleRate
      }
      readyRef.current = true
    })

    // 메트로놈 클릭 (오디오 클럭에 예약)
    const click = (when: number, accent: boolean) => {
      const ctx = audioEngine.context
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = accent ? 1800 : 1200
      osc.connect(g)
      g.connect(ctx.destination)
      const t = Math.max(when, ctx.currentTime)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(accent ? 0.4 : 0.24, t + 0.001)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
      osc.start(t)
      osc.stop(t + 0.06)
    }

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      // 캔버스 버퍼 높이를 표시 높이(h-full)에 맞춤 → 창 크기에 따라 가변, 잘림 없음
      const mainCv = canvasRef.current
      if (mainCv) {
        const h = mainCv.clientHeight
        if (h && mainCv.height !== h) {
          mainCv.height = h
          if (waveRef.current) waveRef.current.height = h
          if (minimapRef.current) minimapRef.current.height = h
        }
        viewHRef.current = mainCv.height || CANVAS_H
      }
      if (playingRef.current) {
        const t = (audioEngine.context.currentTime - playStartCtxRef.current) * 1000 + playFromRef.current
        timeRef.current = t
        if (durationRef.current && t >= durationRef.current) {
          timeRef.current = durationRef.current
          pause()
        }
      }

      // 메트로놈: 재생 중 + 켜짐 + bpm 있을 때, 룩어헤드로 비트 예약
      if (playingRef.current && metroRef.current && bpmRef.current > 0) {
        const ctx = audioEngine.context
        const beatMs = 60000 / bpmRef.current
        if (!metroPrimedRef.current) {
          const songNow = (ctx.currentTime - playStartCtxRef.current) * 1000 + playFromRef.current
          metroBeatRef.current = Math.max(0, Math.ceil((songNow - firstBeatRef.current) / beatMs))
          metroPrimedRef.current = true
        }
        for (let guard = 0; guard < 64; guard++) {
          const beatTime = firstBeatRef.current + metroBeatRef.current * beatMs
          const ctxTime = playStartCtxRef.current + (beatTime - playFromRef.current) / 1000
          if (ctxTime > ctx.currentTime + 0.12) break
          if (beatTime >= 0 && ctxTime > ctx.currentTime - 0.05) {
            click(ctxTime, (((metroBeatRef.current % 4) + 4) % 4) === 0)
          }
          metroBeatRef.current++
        }
      } else {
        metroPrimedRef.current = false
      }

      // 노트음(플레이-얼롱): 재생 중 노트가 판정선을 지날 때 탭
      if (noteSoundRef.current && playingRef.current) {
        const cur = timeRef.current
        const last = lastSoundTimeRef.current
        if (cur > last) {
          let crossed = false
          for (const note of notesRef.current) {
            if (note.time > cur) break
            if (note.time > last) {
              crossed = true
              break
            }
          }
          if (crossed) audioEngine.playTap(0.3)
        }
        lastSoundTimeRef.current = cur
      } else {
        lastSoundTimeRef.current = timeRef.current
      }

      if (timeLabelRef.current) timeLabelRef.current.textContent = fmt(timeRef.current)

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
      const lane = laneForKey(keysRef.current, e.key)
      if (lane !== -1) {
        heldRef.current.set(lane, gridSnap(timeRef.current))
        if (noteSoundRef.current) audioEngine.playTap(0.3)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      setMods(e)
      if (!keyRecRef.current) return
      const lane = laneForKey(keysRef.current, e.key)
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
    const cv = canvasRef.current
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) setZoom((z) => +clamp(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.05, 2).toFixed(3))
      else seekBy(e.deltaY / zoomRef.current)
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

  // --- 그리기 ---
  const drawNote = (ctx: CanvasRenderingContext2D, n: EditNote, T: number, px: number, ghost: boolean) => {
    const lw = laneW()
    const c = getLaneColor(n.lane, keysRef.current)
    const x = n.lane * lw + 3
    const w = lw - 6
    const yHead = ph() - (n.time - T) * px
    ctx.globalAlpha = ghost ? 0.4 : 1
    if (n.endTime > 0) {
      const yTail = ph() - (n.endTime - T) * px
      ctx.fillStyle = hex(c.note)
      ctx.fillRect(x, yTail, w, yHead - yTail)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x, yHead - 1.5, w, 3)
      ctx.fillRect(x, yTail - 1.5, w, 3)
    } else {
      ctx.fillStyle = hex(c.note)
      ctx.fillRect(x, yHead - NOTE_H / 2, w, NOTE_H)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x, yHead - 1.5, w, 3)
    }
    ctx.globalAlpha = 1
  }

  const highlightNote = (ctx: CanvasRenderingContext2D, n: EditNote, T: number, px: number, part: 'body' | 'head' | 'tail') => {
    const lw = laneW()
    const x = n.lane * lw + 3
    const w = lw - 6
    const yHead = ph() - (n.time - T) * px
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'
    ctx.lineWidth = 2
    if (n.endTime > 0) {
      const yTail = ph() - (n.endTime - T) * px
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
    const kc = keysRef.current
    const lw = laneW()
    const H = cv.height
    ctx.clearRect(0, 0, PLAYER_W, H)
    ctx.fillStyle = '#0a0a12'
    ctx.fillRect(0, 0, PLAYER_W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    for (let i = 1; i < kc; i++) ctx.fillRect(i * lw - 0.5, 0, 1, H)

    if (bpmRef.current > 0) {
      const beatMs = 60000 / bpmRef.current
      const top = T + ph() / px
      const bottom = T - (H - ph()) / px
      let k = Math.floor((bottom - firstBeatRef.current) / beatMs)
      let lt = firstBeatRef.current + k * beatMs
      while (lt <= top) {
        const y = ph() - (lt - T) * px
        const measure = (((k % 4) + 4) % 4) === 0
        ctx.fillStyle = measure ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'
        ctx.fillRect(0, y, PLAYER_W, measure ? 2 : 1)
        k++
        lt += beatMs
      }
    }

    for (const n of notesRef.current) drawNote(ctx, n, T, px, false)

    const d = dragRef.current
    if (d && d.mode === 'create') {
      const a = ph() - (d.startTime - T) * px
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.strokeRect(d.lane * lw + 3, Math.min(a, d.curY), lw - 6, Math.abs(a - d.curY))
    }

    if (guideRef.current !== null) {
      const gy = ph() - (guideRef.current - T) * px
      ctx.fillStyle = 'rgba(255,80,180,0.9)'
      ctx.fillRect(0, gy - 0.5, PLAYER_W, 1)
    }

    const m = mouseRef.current
    let cursor = 'crosshair'
    if (d) {
      cursor = d.mode === 'resize' ? 'ns-resize' : d.mode === 'move' ? 'grabbing' : 'crosshair'
    } else if (m.inside) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.fillRect(0, m.y, PLAYER_W, 1)
      const hit = hitNote(laneFromX(m.x), m.y, T, px)
      if (hit) {
        highlightNote(ctx, hit.note, T, px, hit.part)
        cursor = hit.part === 'head' || hit.part === 'tail' ? 'ns-resize' : 'grab'
      } else {
        drawNote(ctx, { lane: laneFromX(m.x), time: snapPure(timeFromY(m.y), m.alt, null).time, endTime: 0 }, T, px, true)
      }
    }
    cv.style.cursor = cursor

    ctx.fillStyle = 'rgba(120,200,255,0.95)'
    ctx.fillRect(0, ph() - 1, PLAYER_W, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = '12px sans-serif'
    ctx.fillText(fmt(T), 6, ph() + 16)

    // --- 좌측 파형 스트립 (메인과 동일 시간 축) ---
    const wv = waveRef.current
    const wctx = wv?.getContext('2d')
    if (wv && wctx) {
      const W = wv.width
      const H = wv.height
      const cxw = W / 2
      wctx.clearRect(0, 0, W, H)
      wctx.fillStyle = '#0a0a12'
      wctx.fillRect(0, 0, W, H)

      // 비트/마디 그리드 (메인 캔버스와 동일 위상)
      if (bpmRef.current > 0) {
        const beatMs = 60000 / bpmRef.current
        const topT = T + ph() / px
        const botT = T - (H - ph()) / px
        let k = Math.floor((botT - firstBeatRef.current) / beatMs)
        let lt = firstBeatRef.current + k * beatMs
        while (lt <= topT) {
          const gy = ph() - (lt - T) * px
          const measure = (((k % 4) + 4) % 4) === 0
          wctx.fillStyle = measure ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'
          wctx.fillRect(0, gy, W, 1)
          k++
          lt += beatMs
        }
      }

      // 파형 (보이는 구간만, 픽셀당 피크)
      const data = waveDataRef.current
      const sr = sampleRateRef.current
      if (data) {
        const durMs = (data.length / sr) * 1000
        const spp = sr / 1000 / px // 픽셀당 샘플 수
        wctx.fillStyle = 'rgba(140,185,255,0.6)'
        for (let y = 0; y < H; y++) {
          const t = T + (ph() - y) / px
          if (t < 0 || t > durMs) continue
          const center = (t / 1000) * sr
          const halfWin = Math.max(1, spp / 2)
          const step = Math.max(1, Math.floor(halfWin / 8))
          let peak = 0
          for (let s = center - halfWin; s < center + halfWin; s += step) {
            const si = s | 0
            if (si >= 0 && si < data.length) {
              const v = Math.abs(data[si])
              if (v > peak) peak = v
            }
          }
          const len = Math.sqrt(peak) * (W * 0.46) // sqrt로 약한 부분도 보이게
          wctx.fillRect(cxw - len, y, len * 2, 1)
        }
      }

      // 현재 위치(판정선)
      wctx.fillStyle = 'rgba(120,200,255,0.95)'
      wctx.fillRect(0, ph() - 1, W, 2)
    }
  }

  const renderMinimap = () => {
    const cv = minimapRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const dur = durationRef.current
    const H = cv.height
    ctx.clearRect(0, 0, MINIMAP_W, H)
    ctx.fillStyle = '#08080e'
    ctx.fillRect(0, 0, MINIMAP_W, H)
    if (dur <= 0) return
    const kc = keysRef.current
    const scale = H / dur
    const yOf = (t: number) => H - t * scale
    const SQ = 4
    const STEP = SQ + 2
    const laneX = (lane: number) => (MINIMAP_W - STEP * kc) / 2 + lane * STEP

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

    for (const n of notesRef.current) {
      const c = getLaneColor(n.lane, kc)
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

    const px = zoomRef.current
    const T = timeRef.current
    const y0 = yOf(T - (H - ph()) / px)
    const y1 = yOf(T + ph() / px)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(0, Math.min(y0, y1), MINIMAP_W, Math.abs(y1 - y0))
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.strokeRect(0.5, Math.min(y0, y1), MINIMAP_W - 1, Math.abs(y1 - y0))
    ctx.fillStyle = 'rgba(120,200,255,0.95)'
    ctx.fillRect(0, yOf(T) - 1, MINIMAP_W, 2)

    if (miniDragRef.current) {
      const my = miniYRef.current
      const t = clamp((1 - my / H) * dur, 0, dur)
      const label = fmt(t)
      ctx.font = '11px sans-serif'
      const tw = ctx.measureText(label).width
      const by = clamp(my, 9, H - 9)
      ctx.fillStyle = 'rgba(0,0,0,0.85)'
      ctx.fillRect(MINIMAP_W - tw - 12, by - 9, tw + 10, 18)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, MINIMAP_W - tw - 7, by + 4)
    }
  }

  // --- 마우스 ---
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
    dragBeforeRef.current = snapshot()
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
        target = { ...hit.note }
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
    dragRef.current = { mode: 'create', lane, startTime: Math.max(0, applySnap(timeFromY(y), null)), startY: y, curY: y, curX: x }
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
      if (!mouseRef.current.shift) d.target.lane = laneFromX(x)
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

  const miniSeek = (e: React.MouseEvent) => {
    const { y } = pos(e, minimapRef.current)
    miniYRef.current = y
    const h = minimapRef.current?.clientHeight || CANVAS_H
    seekTo((1 - y / h) * (durationRef.current || 0))
  }

  // --- 저장 ---
  const save = async () => {
    if (!song) return
    const validNotes = notesRef.current.filter((n) => n.lane < keys)
    const map = [...validNotes].sort((a, b) => a.time - b.time || a.lane - b.lane).map((n) => [n.lane, n.time, n.endTime])
    const existing = getChart(song, keys, difficulty)
    const url = existing?.beatmapUrl || `/beatmap/${song.id}/${keys}k_${slug(difficulty)}.json`
    try {
      const res = await fetch('/__save-beatmap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: url, data: { map } }),
      })
      // 차트 upsert
      if (existing) {
        existing.level = level
        existing.beatmapUrl = url
      } else {
        song.charts.push({ keys, difficulty, level, beatmapUrl: url })
      }
      // 곡 메타/타이밍
      song.title = title
      const artistParts = artist.split(',').map((s) => s.trim()).filter(Boolean)
      song.artist = artistParts.length > 1 ? artistParts : artistParts[0] ?? ''
      song.cover = cover || undefined
      song.license = license || undefined
      song.previewStart = previewStart
      song.previewEnd = previewEnd > previewStart ? previewEnd : undefined
      song.bpm = bpm
      song.offset = offset
      song.firstBeatMs = firstBeat
      const ok2 = await saveSongs()
      setSaveMsg(res.ok && ok2 ? '저장됨 ✓' : '일부 저장 실패')
      setChartsVer((v) => v + 1)
    } catch {
      setSaveMsg('저장 실패 (dev 서버?)')
    }
  }

  const onCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setCover(String(reader.result))
    reader.readAsDataURL(f)
  }

  if (!song) return null

  const btn = 'px-2.5 py-1.5 rounded-md text-[12px] font-semibold bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] text-white/75 transition-colors cursor-pointer'
  const numInput = 'w-20 px-2 py-1 rounded-md bg-black/30 border border-white/[0.09] text-white/90 text-[12px] tabular-nums outline-none focus:border-white/30'
  const tbtn = 'h-7 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md text-[12px] font-medium text-white/65 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer'
  const toggle = (on: boolean) =>
    `h-7 px-2.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer ${on ? 'bg-white/[0.13] text-white' : 'text-white/45 hover:text-white/75 hover:bg-white/[0.06]'}`
  const accent = DIFFICULTY_COLORS[difficulty] ?? '#8a8c9c'
  const songCharts = chartsForKeys(song, keys)
  void chartsVer

  return (
    <main className="h-dvh w-full bg-[#0b0c11] text-white/85 flex flex-col">
      {/* 트랜스포트 / 툴바 */}
      <header className="h-11 shrink-0 flex items-center gap-1 px-2 border-b border-white/[0.07] bg-[#101218]">
        <button className={tbtn} onClick={() => navigate('/music-list', { replace: true })} title="목록으로">
          ←
        </button>
        <span className="px-1.5 text-[12px] font-semibold text-white/80 truncate max-w-[180px]">
          {title || song.title}
          <span className="text-white/35 font-normal"> · {artist || formatArtist(song.artist)}</span>
        </span>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <button className={tbtn} onClick={() => seekTo(0)} title="처음으로">
          ⏮
        </button>
        <button className={toggle(playing)} onClick={togglePlay} title="재생/정지 (Space)">
          {playing ? '⏸' : '▶'}
        </button>
        <span ref={timeLabelRef} className="ml-1 w-[84px] text-center font-mono text-[13px] tabular-nums text-cyan-300/90">
          0:00.00
        </span>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <span className="px-1 text-[10px] font-bold tracking-wider text-white/30">ZOOM</span>
        <button className={tbtn} onClick={() => setZoom((z) => +clamp(z - 0.05, 0.05, 2).toFixed(3))}>
          −
        </button>
        <span className="w-12 text-center font-mono text-[12px] tabular-nums text-white/70">{zoom.toFixed(2)}×</span>
        <button className={tbtn} onClick={() => setZoom((z) => +clamp(z + 0.05, 0.05, 2).toFixed(3))}>
          ＋
        </button>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <button className={toggle(snapOn)} onClick={() => setSnapOn(!snapOn)}>
          SNAP
        </button>
        <select
          className="h-7 rounded-md bg-black/30 border border-white/[0.09] px-1.5 text-[12px] font-mono text-white/80 outline-none"
          value={snapDiv}
          onChange={(e) => setSnapDiv(Number(e.target.value))}
        >
          <option value={1}>1/1</option>
          <option value={2}>1/2</option>
          <option value={4}>1/4</option>
          <option value={8}>1/8</option>
          <option value={16}>1/16</option>
        </select>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <button className={toggle(metro)} onClick={() => setMetro(!metro)}>
          메트로놈
        </button>
        <button className={toggle(noteSound)} onClick={() => setNoteSound(!noteSound)}>
          노트음
        </button>
        <button className={toggle(keyRec)} onClick={() => setKeyRec(!keyRec)}>
          키 녹음
        </button>

        <span className="flex-1" />

        <button
          className="h-7 px-4 rounded-md text-[12px] font-bold tracking-wide transition-all hover:brightness-110 active:scale-95 cursor-pointer"
          style={{ background: accent, color: '#0b0c11' }}
          onClick={save}
        >
          저장
        </button>
      </header>

      {/* 워크스페이스 */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 min-h-0 flex items-stretch justify-center gap-3 p-4">
          <canvas
            ref={waveRef}
            width={64}
            height={CANVAS_H}
            style={{ width: 64 }}
            className="h-full rounded-md border border-white/[0.07]"
            title="현재 보이는 구간 파형"
          />
          <canvas
            ref={canvasRef}
            width={PLAYER_W}
            height={CANVAS_H}
            style={{ width: PLAYER_W }}
            className="h-full rounded-md border border-white/[0.07] cursor-crosshair select-none"
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onLeave}
            onContextMenu={onContextMenu}
          />
          <canvas
            ref={minimapRef}
            width={MINIMAP_W}
            height={CANVAS_H}
            style={{ width: MINIMAP_W }}
            className="h-full rounded-md border border-white/[0.07] cursor-pointer select-none"
            onMouseDown={(e) => {
              miniDragRef.current = true
              miniSeek(e)
            }}
            onMouseMove={(e) => miniDragRef.current && miniSeek(e)}
            onMouseUp={() => (miniDragRef.current = false)}
            onMouseLeave={() => (miniDragRef.current = false)}
          />
        </div>

        {/* 인스펙터 */}
        <aside className="w-[300px] shrink-0 border-l border-white/[0.07] bg-[#0e0f15] overflow-y-auto text-[12px]">
          {/* CHART */}
          <div className="flex items-center gap-2 h-9 px-3.5 border-b border-white/[0.05]">
            <span className="h-3 w-[3px] rounded-full" style={{ background: accent }} />
            <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Chart</span>
            <span className="ml-auto font-mono text-[11px] text-white/30">{noteCount} notes</span>
          </div>
          <div className="px-3.5 py-3 flex flex-col gap-2.5 border-b border-white/[0.05]">
            <div className="flex gap-1.5">
              {KEY_MODES.map((k) => (
                <button
                  key={k}
                  onClick={() => loadChart(k, chartsForKeys(song, k)[0]?.difficulty ?? difficulty)}
                  className={`h-7 flex-1 rounded-md text-[12px] font-bold border transition-colors cursor-pointer ${k === keys ? 'bg-white/[0.13] text-white border-white/15' : 'bg-white/[0.03] text-white/40 border-white/[0.07] hover:text-white/70'}`}
                >
                  {k}K
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {songCharts.map((c) => {
                const col = DIFFICULTY_COLORS[c.difficulty] ?? '#ffffff'
                const active = c.difficulty === difficulty
                return (
                  <button
                    key={c.difficulty}
                    onClick={() => loadChart(keys, c.difficulty)}
                    style={active ? { color: col, borderColor: col, background: col + '22' } : undefined}
                    className={`px-2.5 h-7 rounded-md text-[11px] font-bold border cursor-pointer ${active ? '' : 'bg-white/[0.03] text-white/40 border-white/[0.07]'}`}
                  >
                    {c.difficulty}
                    {c.level ? ` ${c.level}` : ''}
                  </button>
                )
              })}
              {songCharts.length === 0 && <span className="text-white/25 text-[11px] py-1">이 키모드 차트 없음 — 새로 만들기</span>}
            </div>
            <label className="flex items-center justify-between gap-2">
              <span className="text-white/45">난이도</span>
              <select
                className="h-7 rounded-md bg-black/30 border border-white/[0.09] px-2 text-[12px] text-white/85 outline-none"
                value={difficulty}
                onChange={(e) => loadChart(keys, e.target.value)}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-white/45">레벨</span>
              <input className={numInput} type="number" value={level} onChange={(e) => setLevel(Number(e.target.value))} />
            </label>
          </div>

          {/* SONG */}
          <div className="flex items-center gap-2 h-9 px-3.5 border-b border-white/[0.05]">
            <span className="h-3 w-[3px] rounded-full bg-white/20" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Song</span>
          </div>
          <div className="px-3.5 py-3 flex flex-col gap-2.5 border-b border-white/[0.05]">
            <label className="flex items-center justify-between gap-2">
              <span className="text-white/45">제목</span>
              <input className={numInput + ' w-44'} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-white/45">작곡가</span>
              <input
                className={numInput + ' w-44'}
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="쉼표로 여러 명"
              />
            </label>
            <div className="flex items-center gap-3">
              {cover ? (
                <img src={cover} alt="cover" className="w-16 h-16 object-cover rounded-md border border-white/[0.1]" />
              ) : (
                <div className="w-16 h-16 rounded-md border border-dashed border-white/[0.15] grid place-items-center text-white/25 text-[11px]">없음</div>
              )}
              <div className="flex flex-col gap-1">
                <label className={btn + ' text-center'}>
                  커버 업로드
                  <input type="file" accept="image/*" className="hidden" onChange={onCoverFile} />
                </label>
                {cover && (
                  <button className={btn} onClick={() => setCover('')}>
                    제거
                  </button>
                )}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-white/45">라이선스 / 출처</span>
              <textarea
                className="w-full h-16 px-2 py-1.5 rounded-md bg-black/30 border border-white/[0.09] text-white/85 text-[11px] resize-none outline-none focus:border-white/30"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                placeholder="Music by … / NCS Release / 출처 URL"
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-white/45">프리뷰 구간</span>
              <div className="flex items-center gap-1.5">
                <span className="w-6 text-white/35">시작</span>
                <input className={numInput + ' flex-1 w-auto'} type="number" value={previewStart} onChange={(e) => setPreviewStart(Number(e.target.value))} />
                <button className={btn} onClick={() => setPreviewStart(Math.round(timeRef.current))}>
                  현재
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 text-white/35">끝</span>
                <input className={numInput + ' flex-1 w-auto'} type="number" value={previewEnd} onChange={(e) => setPreviewEnd(Number(e.target.value))} />
                <button className={btn} onClick={() => setPreviewEnd(Math.round(timeRef.current))}>
                  현재
                </button>
              </div>
            </div>
          </div>

          {/* TIMING */}
          <div className="flex items-center gap-2 h-9 px-3.5 border-b border-white/[0.05]">
            <span className="h-3 w-[3px] rounded-full bg-white/20" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Timing</span>
            <span className="ml-auto font-mono text-[11px] text-white/30">곡 공통</span>
          </div>
          <div className="px-3.5 py-3 flex flex-col gap-2.5 border-b border-white/[0.05]">
            <label className="flex items-center justify-between gap-2">
              <span className="text-white/45">BPM</span>
              <input className={numInput} type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-white/45">offset (ms)</span>
              <input className={numInput} type="number" value={offset} onChange={(e) => setOffset(Number(e.target.value))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-white/45">firstBeat (ms)</span>
              <input className={numInput} type="number" value={firstBeat} onChange={(e) => setFirstBeat(Number(e.target.value))} />
            </label>
            {saveMsg && <div className="text-emerald-400/80 text-[11px] font-mono">{saveMsg}</div>}
          </div>

          {/* SHORTCUTS */}
          <div className="flex items-center gap-2 h-9 px-3.5 border-b border-white/[0.05]">
            <span className="h-3 w-[3px] rounded-full bg-white/20" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Shortcuts</span>
          </div>
          <div className="px-3.5 py-3 flex flex-col gap-1 text-[11px] text-white/40 leading-relaxed">
            <p>· 클릭 탭 · 드래그 롱노트 · 우클릭 삭제</p>
            <p>· 노트 드래그 이동 · 끝 드래그 길이</p>
            <p>· Shift 라인고정 · Ctrl 복제 · Alt 정렬스냅</p>
            <p>· 휠 스크럽 · Ctrl+휠 줌 · Space 재생</p>
            <p>· Ctrl+Z 취소 · Shift+Ctrl+Z 재실행</p>
          </div>
        </aside>
      </div>

      {/* 상태바 */}
      <footer className="h-7 shrink-0 flex items-center gap-3 px-3 border-t border-white/[0.07] bg-[#101218] text-[11px] font-mono text-white/45">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ background: accent }} />
          {keys}K · {difficulty} · Lv{level}
        </span>
        <span className="text-white/15">•</span>
        <span>BPM {bpm || '—'}</span>
        <span className="text-white/15">•</span>
        <span>SNAP {snapOn ? `1/${snapDiv}` : 'off'}</span>
        <span className="text-white/15">•</span>
        <span>NOTES {noteCount}</span>
        <span className="text-white/15">•</span>
        <span>ZOOM {zoom.toFixed(2)}×</span>
        <span className="flex-1" />
        <span className={playing ? 'text-cyan-300/80' : ''}>{playing ? '▶ PLAYING' : '⏸ STOPPED'}</span>
      </footer>
    </main>
  )
}
