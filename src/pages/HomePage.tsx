import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAudio } from '@/audio/AudioEngineContext'
import { MainContainer, PlayerBottom } from '@/components'

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

      if (!mounted) return

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

  const menuItems = [
    { name: '음악 선택', desc: 'Select Music', path: '/music-list' },
    { name: '설정', desc: 'Settings', path: '' },
  ]

  return (
    <MainContainer className='flex-col'>
      {/* 배경 */}
      <div className='absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(80,100,200,0.06)_0%,transparent_60%)]' />

      <section className='flex-1 flex flex-col justify-center items-center z-10'>
        <h1 className='text-[56px] font-black mb-2 perfect-gradient-text saturate-150'>
          VIBEATS
        </h1>
        <p className='text-white/20 text-[14px] tracking-[4px] font-light mb-16'>RHYTHM GAME</p>

        <nav className='flex flex-col gap-3 w-[320px]'>
          {menuItems.map((item, i) => (
            <button
              key={i}
              disabled={!item.path}
              className='group relative px-6 py-4 rounded-xl cursor-pointer transition-all duration-200
                bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.15]
                disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/[0.03] disabled:hover:border-white/[0.06]
                text-left'
              onClick={() => {
                if (!item.path) return
                audio.stop('bgm_home')
                navigate(item.path, { replace: true })
              }}
              onMouseEnter={() => audio.playFromPool('fx_focus')}
            >
              <span className='text-[18px] font-bold text-white/80 group-hover:text-white transition-colors'>
                {item.name}
              </span>
              <span className='block text-[12px] text-white/25 font-medium tracking-wider mt-0.5'>
                {item.desc}
              </span>
            </button>
          ))}
        </nav>
      </section>

      <PlayerBottom analyser={analyser} />
    </MainContainer>
  )
}
