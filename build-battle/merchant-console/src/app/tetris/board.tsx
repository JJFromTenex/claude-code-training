"use client"

import { cx, focusRing } from "@/lib/utils"
import { useEffect, useState } from "react"
import {
  COLS,
  clearLines,
  collides,
  emptyBoard,
  merge,
  randomShape,
  rotate,
} from "./game"

/**
 * Full class strings, never interpolated — the Tailwind compiler only keeps
 * classes it can see written out. The index matches the piece index stored in
 * a board cell; 0 is the empty cell, dark enough to read as a board.
 */
const CELL_COLORS: Record<number, string> = {
  0: "bg-gray-800 dark:bg-gray-900",
  1: "bg-cyan-500",
  2: "bg-blue-500",
  3: "bg-orange-500",
  4: "bg-amber-400",
  5: "bg-green-500",
  6: "bg-purple-500",
  7: "bg-red-500",
}

const TICK_MS = 600

type Piece = { shape: number[][]; x: number; y: number }
type Game = { board: number[][]; piece: Piece | null; over: boolean }

function spawn(): Piece {
  const shape = randomShape()
  return { shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 }
}

function newGame(): Game {
  return { board: emptyBoard(), piece: spawn(), over: false }
}

/**
 * One gravity step, and the only place a piece locks: if it cannot fall it is
 * merged, full rows clear, and the next piece spawns. A spawn that already
 * collides means the stack reached the top.
 */
function drop(game: Game): Game {
  const { board, piece } = game
  if (game.over || !piece) return game

  if (!collides(board, piece.shape, piece.x, piece.y + 1)) {
    return { ...game, piece: { ...piece, y: piece.y + 1 } }
  }

  const settled = clearLines(merge(board, piece.shape, piece.x, piece.y))
  const next = spawn()
  if (collides(settled, next.shape, next.x, next.y)) {
    return { board: settled, piece: null, over: true }
  }
  return { board: settled, piece: next, over: false }
}

function shift(game: Game, dx: number): Game {
  const { board, piece } = game
  if (game.over || !piece) return game
  if (collides(board, piece.shape, piece.x + dx, piece.y)) return game
  return { ...game, piece: { ...piece, x: piece.x + dx } }
}

function turn(game: Game): Game {
  const { board, piece } = game
  if (game.over || !piece) return game
  const rotated = rotate(piece.shape)
  if (collides(board, rotated, piece.x, piece.y)) return game
  return { ...game, piece: { ...piece, shape: rotated } }
}

/** The settled board with the falling piece painted on top. */
function display(game: Game): number[][] {
  const cells = game.board.map((row) => [...row])
  const piece = game.piece
  if (!piece) return cells

  for (let row = 0; row < piece.shape.length; row++) {
    for (let col = 0; col < piece.shape[row].length; col++) {
      const value = piece.shape[row][col]
      if (!value) continue
      const y = piece.y + row
      const x = piece.x + col
      if (y < 0 || y >= cells.length || x < 0 || x >= COLS) continue
      cells[y][x] = value
    }
  }
  return cells
}

export function Board() {
  // The first piece is random, so it is chosen on the client after mount.
  // Picking it during render would disagree with the server-rendered markup.
  const [game, setGame] = useState<Game>(() => ({
    board: emptyBoard(),
    piece: null,
    over: false,
  }))

  useEffect(() => {
    setGame(newGame())
  }, [])

  useEffect(() => {
    if (game.over) return
    const timer = setInterval(() => setGame(drop), TICK_MS)
    return () => clearInterval(timer)
  }, [game.over])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault()
        setGame((current) => shift(current, -1))
        break
      case "ArrowRight":
        event.preventDefault()
        setGame((current) => shift(current, 1))
        break
      case "ArrowDown":
        event.preventDefault()
        setGame(drop)
        break
      case "ArrowUp":
        event.preventDefault()
        setGame(turn)
        break
      case " ":
        // Nothing to do, but the page must not scroll under the board.
        event.preventDefault()
        break
      case "r":
      case "R":
        setGame(newGame())
        break
    }
  }

  const cells = display(game)

  return (
    <div className="mt-6">
      <div
        tabIndex={0}
        autoFocus
        role="application"
        aria-label="Tetris board. Arrow keys to move and rotate, R to restart."
        onKeyDown={handleKeyDown}
        className={cx(
          "relative grid w-fit grid-cols-10 gap-px rounded-md bg-gray-950 p-px",
          focusRing,
        )}
      >
        {cells.map((row, y) =>
          row.map((value, x) => (
            <div
              key={`${y}-${x}`}
              className={cx("size-5 rounded-[2px]", CELL_COLORS[value])}
            />
          )),
        )}

        {game.over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-md bg-gray-950/85">
            <p className="text-sm font-semibold text-gray-50">Game over</p>
            <p className="text-xs text-gray-400">Press R to restart</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-500">
        Left and right arrows move, up rotates, down soft-drops, R restarts.
        Click the board if it stops responding to the keyboard.
      </p>
    </div>
  )
}
