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
import { useEffect, useState } from "react"

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

const SCOPE_LABELS: Record<ExportScope, string> = {
  current: "Current filter",
  all: "All payments",
}

type RowCount =
  | { state: "loading" }
  | { state: "ready"; total: number }
  | { state: "error" }

const inputStyles = cx(
  "size-4 shrink-0 rounded border-gray-300 accent-blue-500 dark:border-gray-700",
  focusRing,
)

/**
 * Options for the payments export: which columns, and which rows.
 *
 * `query` is the current filter as a query string, without `page`. The row
 * count comes from GET /api/payments, which already returns the full
 * filtered total; the file itself comes from GET /api/payments/export, so
 * nothing here builds CSV or sees more than one page.
 */
export function ExportDialog({ query }: { query: string }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("current")
  const [selected, setSelected] = useState<readonly ExportColumn[]>(
    DEFAULT_EXPORT_COLUMNS,
  )
  const [count, setCount] = useState<RowCount>({ state: "loading" })

  const filterQuery = scope === "current" ? query : ""

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setCount({ state: "loading" })
    fetch(`/api/payments?${filterQuery}`)
      .then((response) => {
        if (!response.ok) throw new Error(response.statusText)
        return response.json() as Promise<{ total: number }>
      })
      .then(({ total }) => {
        if (!cancelled) setCount({ state: "ready", total })
      })
      .catch(() => {
        if (!cancelled) setCount({ state: "error" })
      })
    return () => {
      cancelled = true
    }
  }, [open, filterQuery])

  const columns = EXPORT_COLUMNS.filter((column) => selected.includes(column))
  const params = new URLSearchParams(filterQuery)
  params.set("scope", scope)
  params.set("columns", columns.join(","))
  const href = `/api/payments/export?${params.toString()}`

  const toggle = (column: ExportColumn, checked: boolean) =>
    setSelected((current) =>
      checked
        ? [...current, column]
        : current.filter((item) => item !== column),
    )

  return (
    <Drawer open={open} onOpenChange={setOpen}>
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
          <DrawerDescription className="text-sm">
            Choose the rows and columns for the CSV. Card last four is off
            unless you turn it on.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <div className="mt-2 space-y-2">
              {(Object.keys(SCOPE_LABELS) as ExportScope[]).map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={option}
                    checked={scope === option}
                    onChange={() => setScope(option)}
                    className={cx(inputStyles, "rounded-full")}
                  />
                  {SCOPE_LABELS[option]}
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500" role="status">
              {count.state === "loading" && "Counting rows…"}
              {count.state === "ready" &&
                `${count.total.toLocaleString()} ${count.total === 1 ? "row" : "rows"}`}
              {count.state === "error" &&
                "Could not count the rows. You can still download."}
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="columns"
                    value={column}
                    checked={selected.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className={inputStyles}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {columns.length === 0 && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column to download.
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
          {columns.length === 0 ? (
            <Button className="w-full sm:w-fit" disabled>
              Download
            </Button>
          ) : (
            <Button className="w-full gap-2 sm:w-fit" asChild>
              <a href={href} download onClick={() => setOpen(false)}>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
