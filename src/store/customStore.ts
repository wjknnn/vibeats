import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NoteSkin, PlayerSkin } from '@/types/custom'

type CustomState = {
  noteSkin: NoteSkin
  playerSkin: PlayerSkin
  setNoteSkin: (noteSkin: NoteSkin) => void
  setPlayerSkin: (playerSkin: PlayerSkin) => void
}

export const useCustomStore = create<CustomState>()(
  persist(
    (set) => ({
      noteSkin: 'default',
      playerSkin: 'default',
      setNoteSkin: (noteSkin: NoteSkin) => set({ noteSkin }),
      setPlayerSkin: (playerSkin: PlayerSkin) => set({ playerSkin }),
    }),
    { name: 'custom' }
  )
)
