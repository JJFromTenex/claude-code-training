import { Board } from "./board"

export default function TetrisPage() {
  return (
    <section aria-label="Tetris">
      <div className="p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Tetris
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Ten columns, twenty rows. Focus the board and play with the arrow
          keys.
        </p>
        <Board />
      </div>
    </section>
  )
}
