import type { NoteSkin, NoteSkinConfig } from '@/types/custom'

export const NOTE_SKIN: Record<NoteSkin, NoteSkinConfig> = {
  default: {
    height: 24,
    borderRadius: 4,
    1: {
      startColor: 'rgb(135, 206, 235)',
      centerColor: 'rgb(100, 149, 237)',
      endColor: 'rgb(64, 123, 255)',
      borderColor: 'rgb(100, 149, 237)',
      borderWidth: 1,
      gradientDeg: 180,
    },
    0: {
      startColor: 'rgb(221, 215, 236)',
      centerColor: 'rgb(180, 173, 202)',
      endColor: 'rgb(221, 215, 236)',
      borderColor: 'rgb(180, 173, 202)',
      borderWidth: 1,
      gradientDeg: 180,
    },
    keys: {
      4: [0, 1, 1, 0],
      5: [0, 1, 0, 1, 0],
      6: [0, 1, 0, 0, 1, 0],
    },
  },
} as const
