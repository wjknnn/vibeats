import { useEffect, useRef } from 'react'

type Props = {
  analyser?: AnalyserNode
}

export function PlayerBottom({ analyser }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!analyser) return

    const dataArray = new Float32Array(analyser.frequencyBinCount)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)

      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      analyser.getFloatFrequencyData(dataArray)

      const width = canvas.width
      const height = canvas.height
      const barCount = dataArray.length
      const barWidth = width / barCount - 2

      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < barCount; i++) {
        const db = dataArray[i]
        const normalized = Math.max(0, Math.min(1, (db + 100) / 100))
        const barHeight = normalized * height

        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight)
        gradient.addColorStop(0, 'rgba(120,160,255,0.6)')
        gradient.addColorStop(1, 'rgba(180,140,255,0.1)')
        ctx.fillStyle = gradient
        ctx.fillRect(i * barWidth + i * 2, height - barHeight, barWidth, barHeight)
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [analyser])

  return (
    <div className='w-full flex gap-4 p-5 pb-12'>
      <div className='flex flex-col justify-end px-5'>
        <p className='font-semibold text-[18px] text-white/80 animate-appearBottom opacity-0 [animation-delay:500ms]'>
          VIBEATS
        </p>
        <p className='text-white/30 text-[14px] animate-appearBottom opacity-0 [animation-delay:1000ms]'>
          wjknnn
        </p>
      </div>
      <canvas ref={canvasRef} width={360} height={80} className='mb-1 opacity-60' />
    </div>
  )
}
