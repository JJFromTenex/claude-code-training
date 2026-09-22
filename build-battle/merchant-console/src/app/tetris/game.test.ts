import { describe, expect, it } from "vitest"
import {
  COLS,
  ROWS,
  SHAPES,
  clearLines,
  collides,
  emptyBoard,
  merge,
  rotate,
} from "./game"

/**
 * The board is the only place a piece's identity survives, so these cases
 * check the geometry and the colour index together: a rotation that loses a
 * cell and a merge that writes a flat 1 both look fine on screen for one
 * frame and are wrong forever after.
 */

const I_PIECE = SHAPES[0]

/** A row with every column filled, so clearLines has something to clear. */
function fullRow(value: number): number[] {
  return Array<number>(COLS).fill(value)
}

describe("rotate", () => {
  it("turns a horizontal I-piece vertical", () => {
    const vertical = rotate(I_PIECE)
    expect(vertical).toEqual([
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ])
  })

  it("returns to the starting orientation after four turns", () => {
    expect(rotate(rotate(rotate(rotate(I_PIECE))))).toEqual(I_PIECE)
  })

  it("leaves the shape it was given alone", () => {
    const before = JSON.stringify(I_PIECE)
    rotate(I_PIECE)
    expect(JSON.stringify(I_PIECE)).toBe(before)
  })
})

describe("collides", () => {
  const O_PIECE = SHAPES[3]

  it("is false on open space", () => {
    expect(collides(emptyBoard(), O_PIECE, 4, 4)).toBe(false)
  })

  it("is true past the left wall", () => {
    expect(collides(emptyBoard(), O_PIECE, -1, 4)).toBe(true)
  })

  it("is true past the right wall", () => {
    expect(collides(emptyBoard(), O_PIECE, COLS - 1, 4)).toBe(true)
  })

  it("is true past the floor", () => {
    expect(collides(emptyBoard(), O_PIECE, 4, ROWS - 1)).toBe(true)
  })

  it("is true on an occupied cell", () => {
    const board = emptyBoard()
    board[5][4] = 3
    expect(collides(board, O_PIECE, 4, 4)).toBe(true)
    expect(collides(board, O_PIECE, 0, 4)).toBe(false)
  })

  it("allows a piece still partly above the top of the board", () => {
    expect(collides(emptyBoard(), O_PIECE, 4, -1)).toBe(false)
  })
})

describe("merge", () => {
  it("writes the piece's own index into the board so colours survive locking", () => {
    const tPiece = SHAPES[5]
    const merged = merge(emptyBoard(), tPiece, 0, 0)
    expect(merged[0].slice(0, 3)).toEqual([0, 6, 0])
    expect(merged[1].slice(0, 3)).toEqual([6, 6, 6])
  })

  it("leaves the board it was given alone", () => {
    const board = emptyBoard()
    merge(board, SHAPES[3], 0, 0)
    expect(board[0][0]).toBe(0)
  })
})

describe("clearLines", () => {
  it("removes one full row and keeps the board ROWS tall", () => {
    const board = emptyBoard()
    board[ROWS - 1] = fullRow(2)
    const cleared = clearLines(board)
    expect(cleared).toHaveLength(ROWS)
    expect(cleared.every((row) => row.every((cell) => cell === 0))).toBe(true)
  })

  it("removes two full rows at once and drops the stack onto the floor", () => {
    const board = emptyBoard()
    board[ROWS - 3] = [5, ...Array<number>(COLS - 1).fill(0)]
    board[ROWS - 2] = fullRow(2)
    board[ROWS - 1] = fullRow(3)
    const cleared = clearLines(board)
    expect(cleared).toHaveLength(ROWS)
    expect(cleared[ROWS - 1]).toEqual([5, ...Array<number>(COLS - 1).fill(0)])
    expect(cleared[ROWS - 2].every((cell) => cell === 0)).toBe(true)
  })

  it("leaves a partially filled row alone", () => {
    const board = emptyBoard()
    const partial = fullRow(4)
    partial[0] = 0
    board[ROWS - 1] = partial
    const cleared = clearLines(board)
    expect(cleared[ROWS - 1]).toEqual(partial)
  })
})
