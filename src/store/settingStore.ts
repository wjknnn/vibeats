import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SettingState = {
  speed: number
  setSpeed: (speed: number) => void
  keys: number
  setKeys: (keys: number) => void
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      speed: 1.0,
      setSpeed: (speed: number) => set({ speed }),
      keys: 4,
      setKeys: (keys: number) => set({ keys }),
    }),
    {
      name: 'setting',
    }
  )
)
