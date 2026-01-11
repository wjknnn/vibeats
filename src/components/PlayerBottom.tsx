import { useEffect, useRef } from 'react'
import * as Tone from 'tone'

type Props = {
  fft?: Tone.FFT
}

export function PlayerBottom({ fft }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!fft) return

    const draw = () => {
      requestAnimationFrame(draw)

      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const data = fft.getValue() as Float32Array

      const width = canvas.width
      const height = canvas.height
      const barCount = data.length
      const barWidth = width / barCount - 2

      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < barCount; i++) {
        const db = data[i]

        // dB (-100 ~ 0) → 0 ~ 1 (있는 그대로 정규화)
        const normalized = (db + 100) / 100

        // 클램프만 수행 (시각 안정성)
        const clamped = Math.max(0, Math.min(1, normalized))

        const barHeight = clamped * height

        ctx.fillStyle = '#000000'
        ctx.fillRect(
          i * barWidth + i * 2, // 왼쪽 = 저음
          height - barHeight, // 아래 기준으로 위로
          barWidth,
          barHeight
        )
      }
    }

    draw()
  }, [fft])

  return (
    <div className='w-full flex gap-4 p-5 pb-12'>
      <div className='flex flex-col justify-end px-5'>
        <p className='font-semibold text-[18px] animate-appearBottom opacity-0 delay-500'>
          VIBEATS
        </p>
        <p className='text-zinc-500 animate-appearBottom opacity-0 delay-1000'>
          wjknnn
        </p>
      </div>
      <canvas ref={canvasRef} width={360} height={80} className='mb-1' />
    </div>
  )
}
