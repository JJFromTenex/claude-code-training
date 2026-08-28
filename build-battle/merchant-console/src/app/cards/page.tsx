import { listCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { CardsTable } from "./cards-table"
import { IssueCardDialog } from "./issue-dialog"

/**
 * The store is mutable and lives in memory, so this page must be rendered per
 * request. Without this it is treated as static, and a card issued through the
 * dialog never appears in the list.
 */
export const dynamic = "force-dynamic"

export default function CardsPage() {
  const cards = listCards().map((card) => ({
    ...card,
    merchantName: merchantById(card.merchantId)?.name ?? card.merchantId,
  }))

  const options = merchants.map((merchant) => ({
    id: merchant.id,
    name: merchant.name,
    currency: merchant.currency,
  }))

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="text-sm text-gray-500">
            Single merchant cards, issued from the console.
          </p>
        </div>
        <IssueCardDialog merchants={options} />
      </div>

      {cards.length === 0 ? (
        <div className="border-t border-gray-200 px-4 py-16 text-center sm:px-6 dark:border-gray-800">
          <p className="font-medium text-gray-900 dark:text-gray-50">
            No cards issued yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Issue one for a vendor subscription, ad spend, or a contractor tool.
            It gets a spend limit the moment it exists.
          </p>
        </div>
      ) : (
        <CardsTable cards={cards} />
      )}
    </section>
  )
}
