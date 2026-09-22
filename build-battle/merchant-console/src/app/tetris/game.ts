/**
 * Tetris rules, kept free of React and the DOM so they run under the repo's
 * node-environment vitest setup. Every function returns new arrays; nothing
 * here mutates its input.
 *
 * A cell holds the piece's own index (1..7) rather than a flag, so the board
 * doubles as a colour map once a piece locks. 0 is empty.
 */

export const COLS = 10
export const ROWS = 20

export const SHAPES: number[][][] = [
  // I
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  // J
  [
    [2, 0, 0],
    [2, 2, 2],
    [0, 0, 0],
  ],
  // L
  [
    [0, 0, 3],
    [3, 3, 3],
    [0, 0, 0],
  ],
  // O
  [
    [4, 4],
    [4, 4],
  ],
  // S
  [
    [0, 5, 5],
    [5, 5, 0],
    [0, 0, 0],
  ],
  // T
  [
    [0, 6, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  // Z
  [
    [7, 7, 0],
    [0, 7, 7],
    [0, 0, 0],
  ],
]

export function emptyBoard(): number[][] {
  return Array.from({ length: ROWS }, () => Array<number>(COLS).fill(0))
}

/** Clockwise quarter turn: transpose, then reverse each new row. */
export function rotate(shape: number[][]): number[][] {
  return shape[0].map((_, col) => shape.map((row) => row[col]).reverse())
}

/**
 * A negative y is not a collision — the piece is still partly above the top of
 * the board, which is where it spawns from.
 */
export function collides(
  board: number[][],
  shape: number[][],
  x: number,
  y: number,
): boolean {
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue
      const boardX = x + col
      const boardY = y + row
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true
      if (boardY >= 0 && board[boardY][boardX]) return true
    }
  }
  return false
}

export function merge(
  board: number[][],
  shape: number[][],
  x: number,
  y: number,
): number[][] {
  const next = board.map((row) => [...row])
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue
      const boardX = x + col
      const boardY = y + row
      if (boardY < 0 || boardY >= next.length) continue
      if (boardX < 0 || boardX >= COLS) continue
      next[boardY][boardX] = shape[row][col]
    }
  }
  return next
}

export function clearLines(board: number[][]): number[][] {
  const kept = board.filter((row) => row.some((cell) => cell === 0))
  const cleared = board.length - kept.length
  return [
    ...Array.from({ length: cleared }, () => Array<number>(COLS).fill(0)),
    ...kept.map((row) => [...row]),
  ]
}

export function randomShape(): number[][] {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]
  return shape.map((row) => [...row])
}
