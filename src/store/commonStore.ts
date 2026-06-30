import { create } from 'zustand'

type CommonState = {
  selectedMusicId: number | null
  setSelectedMusicId: (id: number | null) => void
  selectedKeys: number
  setSelectedKeys: (keys: number) => void
  selectedDifficulty: string
  setSelectedDifficulty: (d: string) => void
}

export const useCommonStore = create<CommonState>((set) => ({
  selectedMusicId: null,
  setSelectedMusicId: (id: number | null) => set({ selectedMusicId: id }),
  selectedKeys: 4,
  setSelectedKeys: (keys: number) => set({ selectedKeys: keys }),
  selectedDifficulty: '',
  setSelectedDifficulty: (d: string) => set({ selectedDifficulty: d }),
}))
