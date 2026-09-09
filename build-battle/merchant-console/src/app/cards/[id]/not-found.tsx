import Link from "next/link"

export default function CardNotFound() {
  return (
    <section aria-label="Card not found" className="px-4 py-16 sm:px-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
        No card with that id
      </h1>
      <p className="mt-1 max-w-prose text-gray-500">
        Cards live in memory, so one issued before the last dev-server restart
        is gone rather than hidden. Nothing was deleted.
      </p>
      <Link
        href="/cards"
        className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-500"
      >
        Back to all cards
      </Link>
    </section>
  )
}
