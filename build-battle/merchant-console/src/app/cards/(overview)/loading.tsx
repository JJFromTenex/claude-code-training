import { Skeleton } from "@/components/Skeleton"

/** Shown while the cards route resolves on the server. */
export default function CardsLoading() {
  return (
    <section aria-label="Loading cards" aria-busy="true">
      <div className="flex flex-col justify-between gap-4 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>

      <div className="flex gap-2 px-4 pb-4 sm:px-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-7 w-20" />
        ))}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-gray-100 px-4 py-4 sm:px-6 dark:border-gray-900"
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </section>
  )
}
