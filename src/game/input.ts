import { laneForKey } from './config'

export type InputHandlers = {
  onLaneDown: (lane: number) => void
  onLaneUp: (lane: number) => void
  /** speed 조절(+/-) 등 게임 외 키. 선택. */
  onSpeed?: (delta: number) => void
}

/**
 * 네이티브 keydown/keyup 리스너를 붙인다. React 합성 이벤트를 거치지 않으므로
 * 핸들러 안에서 즉시 Conductor 시각을 읽어 판정할 수 있다(지연 최소화).
 * 반환된 함수를 호출하면 detach 된다.
 */
export function attachInput(keys: number, handlers: InputHandlers): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return // 키 리피트 무시 (홀드 판정 오염 방지)

    if (handlers.onSpeed) {
      if (e.key === '=' || e.key === '+') return handlers.onSpeed(0.1)
      if (e.key === '-' || e.key === '_') return handlers.onSpeed(-0.1)
    }

    const lane = laneForKey(keys, e.key)
    if (lane === -1) return
    e.preventDefault()
    handlers.onLaneDown(lane)
  }

  const onKeyUp = (e: KeyboardEvent) => {
    const lane = laneForKey(keys, e.key)
    if (lane === -1) return
    handlers.onLaneUp(lane)
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }
}
