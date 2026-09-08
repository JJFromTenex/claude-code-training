"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

const controlStyles = cx(
  "size-4 shrink-0 accent-blue-500 border-gray-300 dark:border-gray-700",
  focusRing,
)

const rowLabel = (count: number) =>
  `${count.toLocaleString()} ${count === 1 ? "row" : "rows"}`

/**
 * Options for the payments export. Column and scope choices are only
 * convenience here; the route handler validates them again on the way in.
 */
export function ExportDrawer({
  query,
  currentCount,
  allCount,
}: {
  /** The page's active filters, as a query string. */
  query: string
  currentCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("current")

  // Selection keeps EXPORT_COLUMNS order, which is the order in the file.
  const toggle = (column: ExportColumn, checked: boolean) =>
    setSelected(
      EXPORT_COLUMNS.filter((c) =>
        c === column ? checked : selected.includes(c),
      ),
    )

  const rowCount = scope === "all" ? allCount : currentCount

  const params = new URLSearchParams(query)
  params.delete("page")
  params.set("scope", scope)
  params.set("columns", selected.join(","))
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes in the file. Card last four stays out unless you
            turn it on.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-50">
              <input
                type="radio"
                name="scope"
                value="current"
                checked={scope === "current"}
                onChange={() => setScope("current")}
                className={controlStyles}
              />
              Current filter
              <span className="text-gray-500">· {rowLabel(currentCount)}</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-50">
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className={controlStyles}
              />
              All payments
              <span className="text-gray-500">· {rowLabel(allCount)}</span>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-50"
              >
                <input
                  type="checkbox"
                  name="columns"
                  value={column}
                  checked={selected.includes(column)}
                  onChange={(event) => toggle(column, event.target.checked)}
                  className={controlStyles}
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
            {selected.length === 0 && (
              <p className="mt-1 text-sm text-gray-500" role="status">
                Choose at least one column to enable Download.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {selected.length > 0 ? (
            <Button className="w-full gap-2 sm:w-fit" asChild>
              <DrawerClose asChild>
                <a href={href} download>
                  <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                  Download {rowLabel(rowCount)}
                </a>
              </DrawerClose>
            </Button>
          ) : (
            <Button className="w-full gap-2 sm:w-fit" disabled>
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
