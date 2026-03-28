import { useNavigate } from 'react-router'
import { useAudio } from '@/audio/AudioEngineContext'
import { MainContainer } from '@/components'

export default function IntroPage() {
  const navigate = useNavigate()
  const audio = useAudio()

  const handleStart = async () => {
    await audio.resume()
    navigate('/home', { replace: true })
  }

  return (
    <MainContainer>
      {/* 배경 그라데이션 */}
      <div className='absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(100,80,180,0.08)_0%,transparent_70%)]' />

      <div className='intro-appear relative flex justify-center z-10'>
        <p className='absolute -top-14 text-[28px] font-extralight tracking-[6px] text-white/40 opacity-0 animate-appearBottom [animation-delay:3s]'>
          Welcome to
        </p>
        <h1 className='intro-scale-up text-[72px] font-black tracking-[16px] perfect-gradient-text'>
          VIBEATS
        </h1>
        <button
          onClick={handleStart}
          className='absolute -bottom-[90px] opacity-0 animate-appearBottom [animation-delay:3.2s] cursor-pointer
            px-8 py-3 rounded-full text-[16px] font-semibold tracking-wider
            bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] hover:border-white/[0.2]
            text-white/70 hover:text-white transition-all duration-300
            backdrop-blur-sm'
        >
          Get Started
        </button>
      </div>

      <div className='intro-slider bg-gradient-to-r from-transparent via-white to-transparent h-px absolute left-[100%] opacity-40' />
    </MainContainer>
  )
}
