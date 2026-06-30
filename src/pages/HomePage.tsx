import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAudio } from '@/audio/AudioEngineContext'
import { MainContainer, PlayerBottom } from '@/components'
import { SettingsDialog } from '@/components/dialog/SettingsDialog'

export default function HomePage() {
  const [analyser, setAnalyser] = useState<AnalyserNode>()
  const navigate = useNavigate()
  const audio = useAudio()

  useEffect(() => {
    let mounted = true

    const init = async () => {
      await audio.createPool('fx_focus', '/audio/focus.m4a', 5, -6)
      await audio.addPlayer('bgm', 'home', '/music/home_bgm.mp3', {
        loop: true,
        loopStart: 0,
        loopEnd: 182,
        fadeIn: 2,
        fadeOut: 2,
        volume: -6,
      })

      if (!mounted) {
        audio.removePlayer('bgm_home')
        return
      }

      audio.play('bgm_home')
      const node = audio.getAnalyser('bgm_home')
      if (node) setAnalyser(node)
    }

    init()

    return () => {
      mounted = false
      audio.removePlayer('bgm_home')
      audio.removePool('fx_focus')
    }
  }, [audio])

  const menuBtn =
    'group relative flex items-center justify-between w-full px-6 py-4 rounded-2xl cursor-pointer transition-all duration-200 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.14] text-left'

  return (
    <MainContainer className='flex-col'>
      {/* 앰비언트 배경 */}
      <div className='absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(90,160,255,0.07)_0%,transparent_60%)]' />
      <div className='absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-[radial-gradient(circle,rgba(180,140,255,0.06)_0%,transparent_70%)] blur-2xl' />

      <section className='flex-1 flex flex-col justify-center items-center z-10'>
        <h1 className='text-[76px] leading-none font-black perfect-gradient-text saturate-150 animate-appearBottom'>
          VIBEATS
        </h1>
        <p className='text-white/25 text-[13px] tracking-[0.5em] font-medium uppercase mt-3 mb-14'>Rhythm Game</p>

        <nav className='flex flex-col gap-3 w-[360px]'>
          <button
            className={menuBtn}
            onClick={() => {
              audio.stop('bgm_home')
              navigate('/music-list', { replace: true })
            }}
            onMouseEnter={() => audio.playFromPool('fx_focus')}
          >
            <span className='absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 group-hover:h-8 rounded-full bg-cyan-400 transition-all duration-200' />
            <span className='flex flex-col'>
              <span className='text-[18px] font-bold text-white/85 group-hover:text-white transition-colors'>음악 선택</span>
              <span className='text-[11px] text-white/25 font-medium tracking-[0.25em] uppercase mt-0.5'>Select Music</span>
            </span>
            <span className='text-white/20 group-hover:text-cyan-300 group-hover:translate-x-1 transition-all text-[18px]'>→</span>
          </button>

          <SettingsDialog
            trigger={
              <button className={menuBtn} onMouseEnter={() => audio.playFromPool('fx_focus')}>
                <span className='absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 group-hover:h-8 rounded-full bg-cyan-400 transition-all duration-200' />
                <span className='flex flex-col'>
                  <span className='text-[18px] font-bold text-white/85 group-hover:text-white transition-colors'>설정</span>
                  <span className='text-[11px] text-white/25 font-medium tracking-[0.25em] uppercase mt-0.5'>Settings</span>
                </span>
                <span className='text-white/20 group-hover:text-cyan-300 group-hover:translate-x-1 transition-all text-[18px]'>→</span>
              </button>
            }
          />
        </nav>
      </section>

      <PlayerBottom analyser={analyser} />
    </MainContainer>
  )
}
