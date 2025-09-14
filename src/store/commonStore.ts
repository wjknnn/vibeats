import { create } from 'zustand'

type Page = 'intro' | 'home' | 'game' | 'result' | 'musicList'

type CommonState = {
  page: Page
  setPage: (page: Page) => void
  selectedMusicId: number | null
  setSelectedMusicId: (id: number | null) => void
}

export const useCommonStore = create<CommonState>((set) => ({
  page: 'game',
  setPage: (page: Page) => set({ page }),
  selectedMusicId: null,
  setSelectedMusicId: (id: number | null) => set({ selectedMusicId: id }),
}))
