"use client"

import { useRouter, useSearchParams } from "next/navigation"

export function CancelledToggle({
  includeCancelled,
  cancelledCount,
}: {
  includeCancelled: boolean
  cancelledCount: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <label
      htmlFor="include-cancelled"
      className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"
    >
      <input
        id="include-cancelled"
        type="checkbox"
        checked={includeCancelled}
        onChange={(event) => {
          const next = new URLSearchParams(searchParams.toString())
          if (event.target.checked) next.set("includeCancelled", "1")
          else next.delete("includeCancelled")
          const query = next.toString()
          router.push(query ? `/cards?${query}` : "/cards")
        }}
        className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
      />
      Show cancelled
      {cancelledCount > 0 && (
        <span className="text-gray-500">({cancelledCount})</span>
      )}
    </label>
  )
}
