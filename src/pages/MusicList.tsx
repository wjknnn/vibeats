import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useAudio } from '@/audio/AudioEngineContext'
import { useCommonStore } from '@/store'
import { SONGS, KEY_MODES, chartsForKeys, DIFFICULTY_COLORS, formatArtist } from '@/data/songs'

export default function MusicListPage() {
  const [selected, setSelected] = useState(0)
  const [keysIdx, setKeysIdx] = useState(0) // KEY_MODES 인덱스
  const [diffIdx, setDiffIdx] = useState(0)
  const navigate = useNavigate()
  const audio = useAudio()
  const { setSelectedMusicId, setSelectedKeys, setSelectedDifficulty } = useCommonStore()
  const previewTimerRef = useRef<number>(0)
  const currentPreviewId = useRef<string | null>(null)
  const bgRef = useRef<HTMLImageElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const vizRef = useRef<HTMLCanvasElement>(null)
  const accentRef = useRef('#6b6e80')

  // 최신 상태 참조용 (window 리스너 stale 방지)
  const selRef = useRef(0)
  const keysIdxRef = useRef(0)
  const diffIdxRef = useRef(0)
  useEffect(() => void (selRef.current = selected), [selected])
  useEffect(() => void (keysIdxRef.current = keysIdx), [keysIdx])
  useEffect(() => void (diffIdxRef.current = diffIdx), [diffIdx])

  const stopPreview = () => {
    if (currentPreviewId.current) {
      audio.stop(currentPreviewId.current)
      audio.removePlayer(currentPreviewId.current)
      currentPreviewId.current = null
    }
    clearTimeout(previewTimerRef.current)
  }

  const resolveChart = () => {
    const song = SONGS[selRef.current]
    const keys = KEY_MODES[keysIdxRef.current]
    const diffs = chartsForKeys(song, keys)
    const chart = diffs[Math.min(diffIdxRef.current, Math.max(0, diffs.length - 1))]
    return { song, keys, chart }
  }

  const playGame = useCallback(() => {
    const { song, keys, chart } = resolveChart()
    if (!song || !chart) return
    setSelectedMusicId(song.id)
    setSelectedKeys(keys)
    setSelectedDifficulty(chart.difficulty)
    stopPreview()
    navigate('/game', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, setSelectedMusicId, setSelectedKeys, setSelectedDifficulty])

  const editChart = () => {
    const { song, keys, chart } = resolveChart()
    setSelectedMusicId(song.id)
    setSelectedKeys(keys)
    setSelectedDifficulty(chart?.difficulty ?? '')
    stopPreview()
    navigate('/editor')
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        setKeysIdx((i) => (i + 1) % KEY_MODES.length)
        setDiffIdx(0)
      } else if (e.key === 'ArrowUp') {
        setSelected((p) => (p === 0 ? SONGS.length - 1 : p - 1))
        setDiffIdx(0)
      } else if (e.key === 'ArrowDown') {
        setSelected((p) => (p === SONGS.length - 1 ? 0 : p + 1))
        setDiffIdx(0)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const diffs = chartsForKeys(SONGS[selRef.current], KEY_MODES[keysIdxRef.current])
        if (!diffs.length) return
        const d = e.key === 'ArrowLeft' ? -1 : 1
        setDiffIdx((p) => (p + d + diffs.length) % diffs.length)
      } else if (e.key === 'Enter') {
        playGame()
      } else if (e.key === 'Escape') {
        navigate('/home', { replace: true })
      }
    }
    const handleWheel = (e: WheelEvent) => {
      setSelected((p) => (e.deltaY < 0 ? (p === 0 ? SONGS.length - 1 : p - 1) : p === SONGS.length - 1 ? 0 : p + 1))
      setDiffIdx(0)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [playGame, navigate])

  // 곡 프리뷰 (곡 변경 시 이전 프리뷰는 페이드아웃 → 비주얼라이저도 따라감)
  useEffect(() => {
    const song = SONGS[selected]
    if (!song) return
    const id = `bgm_preview_${song.id}`
    let cancelled = false
    previewTimerRef.current = window.setTimeout(async () => {
      await audio.addPlayer('bgm', `preview_${song.id}`, song.musicUrl, { volume: song.volume })
      if (cancelled) {
        audio.removePlayer(id)
        return
      }
      currentPreviewId.current = id
      const startSec = song.previewStart / 1000
      const endSec = (song.previewEnd && song.previewEnd > song.previewStart ? song.previewEnd : song.previewStart + 12000) / 1000
      audio.playHighlight(id, startSec, endSec, 0.8)
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(previewTimerRef.current)
      // 이 곡의 프리뷰가 재생 중이면 페이드아웃(즉시 정지 X). currentPreviewId는 유지 → 비주얼라이저가 페이드를 따라감.
      if (currentPreviewId.current === id) audio.fadeOutPreview(id)
    }
  }, [selected, audio])

  // 프리뷰 오디오의 저역 에너지에 맞춰 배경/글로우가 비트를 타게 (analyser 기반, 리렌더 없음)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const freq = new Uint8Array(1024)
    let level = 0
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const id = currentPreviewId.current
      const analyser = id ? audio.getAnalyser(id) : undefined
      let energy = 0
      if (analyser) {
        analyser.getByteFrequencyData(freq)
        const n = Math.max(1, Math.floor(analyser.frequencyBinCount * 0.08)) // 저역(베이스)
        let sum = 0
        for (let i = 0; i < n; i++) sum += freq[i]
        energy = sum / n / 255
      }
      // 어택은 빠르게, 릴리즈는 느리게 → 펀치감
      level += (energy - level) * (energy > level ? 0.45 : 0.08)
      const bg = bgRef.current
      if (bg) {
        bg.style.transform = `scale(${1.25 + level * 0.06})`
        bg.style.opacity = String(0.2 + level * 0.16)
      }
      const glow = glowRef.current
      if (glow) {
        glow.style.transform = `scale(${1 + level * 0.14})`
        glow.style.opacity = String(0.13 + level * 0.22)
      }

      // 세로 스펙트럼 (중앙=저역, 위아래=고역 대칭, 오른쪽으로 뻗음)
      const viz = vizRef.current
      const vctx = viz?.getContext('2d')
      if (viz && vctx) {
        const W = Math.max(1, viz.clientWidth)
        const H = Math.max(1, viz.clientHeight)
        if (viz.width !== W) viz.width = W
        if (viz.height !== H) viz.height = H
        vctx.clearRect(0, 0, W, H)
        if (analyser) {
          const col = accentRef.current
          const rows = 60
          const half = rows / 2
          const gap = H / rows
          const maxLen = W * 0.92
          vctx.lineCap = 'round'
          vctx.lineWidth = Math.max(2, gap * 0.5)
          for (let j = 0; j < rows; j++) {
            const k = Math.abs(j - half)
            const bin = 2 + Math.floor((k / half) * analyser.frequencyBinCount * 0.5)
            const amp = (freq[bin] ?? 0) / 255
            // 가장자리로 갈수록 길이 감소(중앙 1 → 끝 0.3), 폭을 넘지 않게 클램프
            const taper = 0.3 + 0.7 * Math.cos((k / half) * (Math.PI / 2))
            const len = Math.min(W - vctx.lineWidth, 4 + amp * amp * maxLen * taper)
            const y = (j + 0.5) * gap
            vctx.beginPath()
            vctx.moveTo(0, y)
            vctx.lineTo(len, y)
            vctx.strokeStyle = col
            vctx.globalAlpha = 0.2 + amp * 0.55
            vctx.stroke()
          }
          vctx.globalAlpha = 1
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [audio])

  const selectedSong = SONGS[selected]
  const keys = KEY_MODES[keysIdx]
  const diffs = chartsForKeys(selectedSong, keys)
  const chartIdx = Math.min(diffIdx, Math.max(0, diffs.length - 1))
  const chart = diffs[chartIdx]

  const accent = chart ? DIFFICULTY_COLORS[chart.difficulty] ?? '#8a8c9c' : '#6b6e80'
  accentRef.current = accent

  return (
    <main className='relative w-full h-dvh overflow-hidden bg-[#07070e] text-white'>
      {/* 앰비언트 배경: 선택 곡 커버 블러 + 스크림 + 난이도색 글로우 */}
      <div className='absolute inset-0 pointer-events-none'>
        {selectedSong.cover && (
          <img
            ref={bgRef}
            key={selectedSong.id}
            src={selectedSong.cover}
            alt=''
            className='absolute inset-0 w-full h-full object-cover scale-125 blur-[90px] opacity-25 will-change-transform'
          />
        )}
        <div className='absolute inset-0 bg-gradient-to-b from-[#07070e]/55 via-[#07070e]/85 to-[#07070e]' />
        <div
          ref={glowRef}
          className='absolute -left-40 top-1/4 w-[560px] h-[560px] rounded-full blur-[150px] opacity-[0.16] transition-colors duration-500 will-change-transform'
          style={{ background: accent }}
        />
        {/* 세로 스펙트럼 (왼쪽 가운데, 오른쪽으로 주파수가 뻗음, 콘텐츠 뒤) */}
        <canvas
          ref={vizRef}
          className='absolute left-0 top-1/2 -translate-y-1/2 h-[55%] w-[280px] opacity-50'
        />
      </div>

      <div className='relative z-10 h-dvh flex flex-col px-10 py-8'>
        {/* 헤더 */}
        <header className='flex items-center justify-between'>
          <div className='flex items-baseline gap-3'>
            <span className='text-[14px] font-black tracking-[0.35em] text-white/85'>VIBEATS</span>
            <span className='text-[11px] tracking-[0.3em] uppercase text-white/30'>Select Music</span>
          </div>
          <span className='text-[12px] tabular-nums text-white/35'>
            {String(selected + 1).padStart(2, '0')}
            <span className='text-white/15'> / {String(SONGS.length).padStart(2, '0')}</span>
          </span>
        </header>

        {/* 본문 */}
        <div className='flex-1 flex items-center gap-12 w-full max-w-[1120px] mx-auto min-h-0'>
          {/* 선택 곡 상세 (곡 변경 시 위치 고정 — 내용만 교체) */}
          <section className='flex-1 min-w-0 flex flex-col justify-center gap-8'>
            <div className='flex items-center gap-6'>
              {selectedSong.cover ? (
                <img
                  src={selectedSong.cover}
                  alt={selectedSong.title}
                  className='w-40 h-40 rounded-2xl object-cover shrink-0'
                  style={{ boxShadow: `0 26px 70px -26px ${accent}cc` }}
                />
              ) : (
                <div
                  className='w-40 h-40 rounded-2xl shrink-0 grid place-items-center text-5xl text-white/15'
                  style={{ background: `linear-gradient(145deg, ${accent}26, transparent)` }}
                >
                  ♪
                </div>
              )}
              <div className='min-w-0'>
                <p className='text-[12px] font-semibold tracking-[0.25em] uppercase text-white/35 mb-2'>
                  {formatArtist(selectedSong.artist)}
                </p>
                <h2 className='text-[44px] leading-[1.04] font-black text-white truncate'>{selectedSong.title}</h2>
              </div>
            </div>

            {/* 키 모드 + 난이도 선택 */}
            <div className='flex flex-col gap-3'>
              <div className='flex items-center gap-4'>
                <span className='w-12 text-[11px] font-semibold tracking-[0.2em] uppercase text-white/30'>Keys</span>
                <div className='flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]'>
                  {KEY_MODES.map((k, i) => (
                    <button
                      key={k}
                      onClick={() => {
                        setKeysIdx(i)
                        setDiffIdx(0)
                      }}
                      className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${
                        i === keysIdx ? 'bg-white/[0.13] text-white' : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      {k}K
                    </button>
                  ))}
                </div>
              </div>

              <div className='flex items-center gap-4 min-h-[40px]'>
                <span className='w-12 text-[11px] font-semibold tracking-[0.2em] uppercase text-white/30'>Diff</span>
                {diffs.length === 0 ? (
                  <span className='text-[13px] text-white/25'>이 키모드 차트 없음</span>
                ) : (
                  <div className='flex gap-1.5'>
                    {diffs.map((c, i) => {
                      const col = DIFFICULTY_COLORS[c.difficulty] ?? '#ffffff'
                      const active = i === chartIdx
                      return (
                        <button
                          key={c.difficulty}
                          onClick={() => setDiffIdx(i)}
                          style={active ? { color: col, borderColor: col, background: col + '1f' } : undefined}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-bold tracking-wide border transition-all cursor-pointer ${
                            active ? '' : 'border-white/[0.07] text-white/35 hover:text-white/60'
                          }`}
                        >
                          {c.difficulty}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 레벨(시그니처) + 플레이 */}
            <div className='flex items-end justify-between gap-6'>
              <div className='flex items-end gap-3 min-w-[220px]'>
                <span className='pb-2.5 text-[12px] font-bold tracking-[0.25em] uppercase' style={{ color: accent }}>
                  {chart ? chart.difficulty : 'No Chart'}
                </span>
                <div className='flex items-baseline gap-1.5'>
                  <span className='text-[13px] font-bold tracking-widest text-white/30'>LV</span>
                  <span
                    className='text-[72px] leading-none font-black tabular-nums'
                    style={{ color: accent, textShadow: `0 0 44px ${accent}55` }}
                  >
                    {chart?.level ?? '–'}
                  </span>
                </div>
              </div>

              <div className='flex flex-col items-stretch gap-2 pb-2'>
                <button
                  onClick={playGame}
                  disabled={!chart}
                  style={chart ? { background: accent, color: '#0a0a12' } : undefined}
                  className='px-9 py-3 rounded-xl text-[15px] font-black tracking-wider transition-all cursor-pointer
                    hover:brightness-110 active:scale-95
                    disabled:bg-white/[0.06] disabled:text-white/30 disabled:cursor-not-allowed disabled:active:scale-100'
                >
                  PLAY
                </button>
                {import.meta.env.DEV && (
                  <button
                    onClick={editChart}
                    className='px-9 py-1.5 rounded-lg text-[12px] font-bold tracking-wide text-amber-300/60
                      border border-amber-300/20 hover:text-amber-300 hover:border-amber-300/40 transition-all cursor-pointer'
                  >
                    {chart ? 'EDIT' : 'ADD'} <span className='text-[10px] opacity-60'>dev</span>
                  </button>
                )}
              </div>
            </div>

            {/* 라이선스: 고정 높이 슬롯 — 유무가 레이아웃을 흔들지 않게 */}
            <div className='h-10 overflow-hidden'>
              {selectedSong.license && (
                <p className='max-w-[440px] text-[11px] text-white/25 leading-relaxed whitespace-pre-line line-clamp-2'>
                  {selectedSong.license}
                </p>
              )}
            </div>
          </section>

          {/* 곡 리스트 */}
          <aside className='w-[340px] shrink-0 flex flex-col justify-center gap-1.5 max-h-full overflow-y-auto overflow-x-hidden py-4 pr-2'>
            {SONGS.map((item, index) => {
              const active = index === selected
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (selected === index) playGame()
                    else {
                      setSelected(index)
                      setDiffIdx(0)
                    }
                  }}
                  // 크기·패딩 고정. 강조는 reflow 없는 transform scale + 색으로만.
                  className={`group relative flex items-center gap-3.5 rounded-2xl text-left px-4 py-3 origin-left transition-all duration-300 cursor-pointer ${
                    active ? 'bg-white/[0.07] scale-[1.02]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <span
                    className='absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[58%] rounded-full transition-opacity duration-300'
                    style={{ background: accent, opacity: active ? 1 : 0 }}
                  />
                  {item.cover ? (
                    <img
                      src={item.cover}
                      alt=''
                      className={`w-11 h-11 rounded-lg object-cover shrink-0 transition-opacity duration-300 ${
                        active ? 'opacity-100' : 'opacity-60'
                      }`}
                    />
                  ) : (
                    <div className='w-11 h-11 rounded-lg shrink-0 grid place-items-center bg-white/[0.04] text-white/20'>
                      ♪
                    </div>
                  )}
                  <div className='min-w-0 flex-1'>
                    <h3
                      className={`text-[15px] font-bold truncate transition-colors ${
                        active ? 'text-white' : 'text-white/50 group-hover:text-white/75'
                      }`}
                    >
                      {item.title}
                    </h3>
                    <p className={`text-[12px] truncate transition-colors ${active ? 'text-white/40' : 'text-white/25'}`}>
                      {formatArtist(item.artist)}
                    </p>
                  </div>
                </button>
              )
            })}
          </aside>
        </div>

        {/* 키 안내 */}
        <footer className='flex items-center justify-center gap-5 text-[11px] tracking-wide'>
          {[
            ['↑↓', '곡'],
            ['Tab', '키모드'],
            ['←→', '난이도'],
            ['Enter', '시작'],
            ['Esc', '뒤로'],
          ].map(([k, t]) => (
            <span key={t} className='flex items-center gap-1.5'>
              <kbd className='px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] font-semibold text-white/55'>
                {k}
              </kbd>
              <span className='text-white/35'>{t}</span>
            </span>
          ))}
        </footer>
      </div>
    </main>
  )
}
