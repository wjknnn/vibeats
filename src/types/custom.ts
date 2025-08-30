export type NoteSkin = 'default'
export type PlayerSkin = 'default'

type NoteStyle = {
  startColor: string
  centerColor?: string
  endColor?: string
  borderColor?: string
  borderWidth?: number
  gradientDeg?: number
}

export type NoteSkinConfig = {
  height: number
  borderRadius?: number
  1: NoteStyle
  0: NoteStyle
  keys: { [key: number]: (1 | 0)[] }
}
