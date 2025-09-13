import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SettingState = {
  speed: number
  setSpeed: (speed: number) => void
  keys: number
  setKeys: (keys: number) => void
  musicVolume: number
  setMusicVolume: (volume: number) => void
  effectVolume: number
  setEffectVolume: (volume: number) => void
  songVolume: number
  setSongVolume: (volume: number) => void
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      speed: 1.0,
      setSpeed: (speed: number) => set({ speed }),
      keys: 4,
      setKeys: (keys: number) => set({ keys }),
      musicVolume: -10,
      setMusicVolume: (volume: number) => set({ musicVolume: volume }),
      effectVolume: -10,
      setEffectVolume: (volume: number) => set({ effectVolume: volume }),
      songVolume: -10,
      setSongVolume: (volume: number) => set({ songVolume: volume }),
    }),
    {
      name: 'setting',
    }
  )
)
