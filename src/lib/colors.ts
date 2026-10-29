/** Freely selectable to-do colours. Green is reserved for completed appointments/events. */
export const TODO_COLORS = [
  { key: 'red', label: 'Rot', value: '#ff3b4f' },
  { key: 'orange', label: 'Orange', value: '#ff9a2f' },
  { key: 'yellow', label: 'Gelb', value: '#f2d84a' },
  { key: 'pink', label: 'Rosa', value: '#ff7ac6' },
  { key: 'purple', label: 'Lila', value: '#a46bff' },
  { key: 'darkblue', label: 'Dunkelblau', value: '#3d5bff' },
  { key: 'lightblue', label: 'Hellblau', value: '#4dc3ff' },
  { key: 'white', label: 'Weiß', value: '#d9dbf0' },
] as const

export const DONE_GREEN = '#2fe07a'

export const colorValue = (key?: string) => TODO_COLORS.find((c) => c.key === key)?.value ?? TODO_COLORS[6].value
