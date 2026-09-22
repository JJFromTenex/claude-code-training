import { listCards } from "@/data/cardQueries"
import { merchants } from "@/data/merchants"
import { CardsTable } from "./cards-table"

export default async function CardsPage() {
  const cards = listCards()

  return (
    <section aria-label="Cards">
      <div className="px-4 py-6 sm:p-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Cards
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Issue and manage virtual cards for merchants.
        </p>
      </div>

      <CardsTable initialCards={cards} merchants={merchants} />
    </section>
  )
}
