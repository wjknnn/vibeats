import { useEffect, useState } from 'react'
import { useAudioManager } from '@/audio/AudioManagerContext'
import { useCommonStore, type Page } from '@/store'
import { MainContainer } from '@/components/MainContainer'
import { PlayerBottom } from '@/components/PlayerBottom'
import { type ToneFFT } from '@/audio/AudioManager'

export default function HomePage() {
  const [bgmFFT, setBgmFFT] = useState<ToneFFT>()
  const [currIdx] = useState<number>(0)

  const { setPage } = useCommonStore()

  const audio = useAudioManager()

  const buttons: { name: string; page: Page }[] = [
    {
      name: '음악 선택',
      page: 'musicList',
    },
    {
      name: '음악 선택',
      page: 'musicList',
    },
    {
      name: '음악 선택',
      page: 'musicList',
    },
    {
      name: '음악 선택',
      page: 'musicList',
    },
  ]

  useEffect(() => {
    audio.createPool('fx_focus', '/audio/focus.m4a', undefined, { volume: -6 })
    audio
      .addPlayer('bgm', 'home', '/music/home_bgm.mp3', {
        loop: true,
        loopStart: 0,
        loopEnd: 182,
        fadeIn: 2,
        fadeOut: 2,
        volume: -6,
      })
      .then(() => {
        const node = audio.getPlayer('bgm_home')
        if (node) {
          node.player.autostart = true
          if (node.fft) setBgmFFT(node.fft)
        }
      })
  }, [])

  return (
    <MainContainer className='flex-col bg-white text-black'>
      <section className='flex-1 flex flex-col justify-center items-center'>
        <h1 className='text-[48px] font-black mb-10 perfect-gradient-text saturate-200 contrast-75'>
          VIBEATS
        </h1>
        <section className='w-full flex gap-10 perspective-near'>
          {buttons.map((v, i) => (
            <button
              key={i}
              className={`border border-zinc-200 min-w-[40dvw] h-[320px] rounded-[20px] bg-white/20 backdrop-blur-md ${
                currIdx < i ? '' : currIdx > i ? '' : ''
              }`}
              onClick={() => setPage(v.page)}
              onMouseEnter={() => audio.playFromPool('fx_focus')}
            >
              {v.name}
            </button>
          ))}
          {/* <SettingsDialog
            trigger={
              <button
                className={className}
                onMouseEnter={() => audio.playFromPool('fx_focus')}
              >
                설정
              </button>
            }
          /> */}
        </section>
      </section>
      <PlayerBottom fft={bgmFFT} />
    </MainContainer>
  )
}
