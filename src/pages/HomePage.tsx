import { useEffect, useState } from 'react'
import { useAudioManager } from '@/audio/AudioManagerContext'
import { useCommonStore, type Page } from '@/store'
import { MainContainer } from '@/components/MainContainer'
import { PlayerBottom } from '@/components/PlayerBottom'
import { type ToneFFT } from '@/audio/AudioManager'
import { SettingsDialog } from '@/components/dialog/SettingsDialog'

export default function HomePage() {
  const [bgmFFT, setBgmFFT] = useState<ToneFFT>()

  const { setPage } = useCommonStore()

  const audio = useAudioManager()

  const buttons: { name: string; page?: Page }[] = [
    {
      name: '음악 선택',
      page: 'musicList',
    },
    {
      name: '설정',
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

  const className =
    'border p-4 rounded-lg border-zinc-200 w-[400px] hover:bg-zinc-100 transition-colors cursor-pointer'

  return (
    <MainContainer className='flex-col bg-white text-black'>
      <section className='flex-1 flex flex-col justify-center items-center'>
        <h1 className='text-[48px] font-black mb-10 perfect-gradient-text saturate-200 contrast-75'>
          VIBEATS
        </h1>
        <section className='w-full flex flex-col gap-5'>
          {buttons.map((v, i) =>
            v.page ? (
              <button
                key={i}
                onClick={() => v.page && setPage(v.page)}
                onMouseEnter={() => audio.playFromPool('fx_focus')}
                className={className}
              >
                {v.name}
              </button>
            ) : (
              <SettingsDialog
                key={i}
                trigger={
                  <button
                    key={i}
                    onMouseEnter={() => audio.playFromPool('fx_focus')}
                    className={className}
                  >
                    설정
                  </button>
                }
              />
            )
          )}
        </section>
      </section>
      <PlayerBottom fft={bgmFFT} />
    </MainContainer>
  )
}
