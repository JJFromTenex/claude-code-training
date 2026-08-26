import Link from "next/link"

export default function CardNotFound() {
  return (
    <div className="p-4 text-center sm:p-6">
      <p className="font-medium text-gray-900 dark:text-gray-50">
        Card not found
      </p>
      <p className="mt-1 text-gray-500">
        It may have been mistyped, or this card existed in a dev server
        session that has since restarted.
      </p>
      <Link
        href="/cards"
        className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-500"
      >
        ← All cards
      </Link>
    </div>
  )
}
