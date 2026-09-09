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
  created_at: "Created at (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

const control = cx(
  "size-4 shrink-0 rounded border-gray-300 text-blue-600 dark:border-gray-700 dark:bg-gray-950",
  focusRing,
)

/**
 * Chooses what the export contains. Nothing is serialized here: the dialog
 * only builds a URL, and the route behind it selects every matching row on
 * the server. Exporting from the browser would capture the visible page and
 * nothing else — the table is paginated.
 */
export function ExportDialog({
  query,
  filteredCount,
  allCount,
}: {
  /** The current filter, already in the URL. Forwarded verbatim. */
  query: string
  filteredCount: number
  allCount: number
}) {
  const [columns, setColumns] = useState<ReadonlySet<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<ExportScope>("filtered")

  const toggle = (column: ExportColumn, on: boolean) =>
    setColumns((current) => {
      const next = new Set(current)
      if (on) next.add(column)
      else next.delete(column)
      return next
    })

  const selected = EXPORT_COLUMNS.filter((column) => columns.has(column))
  const rowCount = scope === "all" ? allCount : filteredCount

  const params = new URLSearchParams(query)
  params.set("columns", selected.join(","))
  params.set("scope", scope)
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

      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose the columns and the rows. The file is built on the server
            from every matching payment, not just this page.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="columns"
                    value={column}
                    checked={columns.has(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className={control}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {selected.length === 0 && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Choose at least one column.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  value="filtered"
                  checked={scope === "filtered"}
                  onChange={() => setScope("filtered")}
                  className={cx(control, "rounded-full")}
                />
                Current filter
                <span className="text-gray-500">
                  · {filteredCount.toLocaleString()} rows
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className={cx(control, "rounded-full")}
                />
                All payments
                <span className="text-gray-500">
                  · {allCount.toLocaleString()} rows
                </span>
              </label>
            </div>
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          <Button
            className="w-full gap-2 sm:w-fit"
            disabled={selected.length === 0}
            asChild={selected.length > 0}
          >
            {selected.length > 0 ? (
              <a href={href}>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download {rowCount.toLocaleString()} rows
              </a>
            ) : (
              <span>Download</span>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
