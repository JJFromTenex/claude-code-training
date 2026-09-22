import Link from "next/link"

/** Shown for /cards/<id> when no card has that id. Written, not default. */
export default function CardNotFound() {
  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">
        No card with that id
      </h1>
      <p className="mt-2 max-w-prose text-sm text-gray-500">
        Cards live in memory until the dev server restarts, so a link from
        before a restart will land here. Check the list for the card you
        expected, or issue it again.
      </p>
    </div>
  )
}
