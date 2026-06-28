import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useAudio } from '@/audio/AudioEngineContext'
import { useCommonStore } from '@/store'
import { MainContainer } from '@/components'
import { SONGS } from '@/data/songs'

export default function MusicListPage() {
  const [selected, setSelected] = useState(0)
  const navigate = useNavigate()
  const audio = useAudio()
  const { setSelectedMusicId } = useCommonStore()
  const previewTimerRef = useRef<number>(0)
  const currentPreviewId = useRef<string | null>(null)

  const playGame = useCallback(() => {
    const song = SONGS[selected]
    if (!song || !song.beatmapUrl) return
    setSelectedMusicId(song.id)
    stopPreview()
    navigate('/game', { replace: true })
  }, [selected, navigate, setSelectedMusicId])

  const stopPreview = () => {
    if (currentPreviewId.current) {
      audio.stop(currentPreviewId.current)
      audio.removePlayer(currentPreviewId.current)
      currentPreviewId.current = null
    }
    clearTimeout(previewTimerRef.current)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        setSelected((prev) => (prev === 0 ? SONGS.length - 1 : prev - 1))
      } else if (e.key === 'ArrowDown') {
        setSelected((prev) => (prev === SONGS.length - 1 ? 0 : prev + 1))
      } else if (e.key === 'Enter') {
        playGame()
      } else if (e.key === 'Escape') {
        navigate('/home', { replace: true })
      }
    }

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        setSelected((prev) => (prev === 0 ? SONGS.length - 1 : prev - 1))
      } else {
        setSelected((prev) => (prev === SONGS.length - 1 ? 0 : prev + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [playGame, navigate])

  useEffect(() => {
    stopPreview()

    const song = SONGS[selected]
    if (!song) return

    const id = `bgm_preview_${song.id}`
    // 비동기 로드 중에 페이지를 떠나면(ESC/곡 변경) 뒤늦게 재생되는 것을 막는 가드
    let cancelled = false

    previewTimerRef.current = window.setTimeout(async () => {
      await audio.addPlayer('bgm', `preview_${song.id}`, song.musicUrl, {
        loop: true,
        loopStart: song.previewStart / 1000,
        fadeIn: 0.5,
        fadeOut: 2,
        volume: song.volume,
      })
      // 로드가 끝났을 때 이미 cleanup 됐다면: 재생하지 말고 방금 추가한 플레이어를 정리
      if (cancelled) {
        audio.removePlayer(id)
        return
      }
      currentPreviewId.current = id
      audio.play(id, song.previewStart / 1000)
    }, 500)

    return () => {
      cancelled = true
      stopPreview()
    }
  }, [selected, audio])

  const selectedSong = SONGS[selected]

  return (
    <MainContainer className='flex-col'>
      <div className='absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(120,80,200,0.06)_0%,transparent_60%)]' />

      <div className='flex w-full max-w-[960px] h-full z-10'>
        {/* 왼쪽: 선택된 곡 정보 */}
        <section className='flex-1 flex flex-col justify-center items-center px-12'>
          <div key={selectedSong.id} className='animate-appearBottom'>
            <p className='text-white/25 text-[13px] font-medium tracking-[3px] uppercase mb-2'>
              {selectedSong.artist}
            </p>
            <h2 className='text-[40px] font-black text-white/90 leading-tight'>
              {selectedSong.title}
            </h2>
            <div className='mt-6 flex gap-3'>
              <button
                onClick={playGame}
                className='px-6 py-2.5 rounded-lg text-[14px] font-bold tracking-wider
                  bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] hover:border-white/[0.2]
                  text-white/70 hover:text-white transition-all cursor-pointer'
              >
                PLAY
              </button>
              {import.meta.env.DEV && selectedSong.beatmapUrl && (
                <button
                  onClick={() => {
                    setSelectedMusicId(selectedSong.id)
                    stopPreview()
                    navigate('/editor')
                  }}
                  className='px-6 py-2.5 rounded-lg text-[14px] font-bold tracking-wider
                    bg-transparent hover:bg-white/[0.06] border border-amber-400/30 hover:border-amber-400/60
                    text-amber-300/70 hover:text-amber-300 transition-all cursor-pointer'
                >
                  EDIT (dev)
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 오른쪽: 곡 리스트 */}
        <section className='w-[400px] flex flex-col justify-center gap-1.5 py-8'>
          {SONGS.map((item, index) => (
            <div
              key={item.id}
              onClick={() => {
                setSelected(index)
                if (selected === index) playGame()
              }}
              className={`group px-5 py-3.5 rounded-xl cursor-pointer transition-all duration-200 ${
                selected === index
                  ? 'bg-white/[0.08] border border-white/[0.15]'
                  : 'bg-transparent border border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]'
              }`}
            >
              <h3 className={`text-[17px] font-bold transition-colors ${
                selected === index ? 'text-white' : 'text-white/50 group-hover:text-white/70'
              }`}>
                {item.title}
              </h3>
              <p className={`text-[13px] font-medium mt-0.5 transition-colors ${
                selected === index ? 'text-white/40' : 'text-white/20'
              }`}>
                {item.artist}
              </p>
            </div>
          ))}
        </section>
      </div>

      {/* 하단 안내 */}
      <div className='absolute bottom-6 text-[12px] text-white/15 tracking-wider'>
        ↑↓ Navigate &nbsp;&nbsp; Enter Play &nbsp;&nbsp; Esc Back
      </div>
    </MainContainer>
  )
}
