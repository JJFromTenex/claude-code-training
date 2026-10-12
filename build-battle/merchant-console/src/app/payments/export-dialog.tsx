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
import { Skeleton } from "@/components/Skeleton"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
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

type Count =
  | { state: "loading" }
  | { state: "ready"; total: number }
  | { state: "error" }

/**
 * Export options for /payments. The CSV is built on the server from the full
 * result set; this only chooses what to ask for. The row count comes from
 * GET /api/payments with the same query the export will receive.
 */
export function ExportDialog({ query }: { query: string }) {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("current")
  const [count, setCount] = useState<Count>({ state: "loading" })

  const scopedQuery = scope === "all" ? "" : query

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setCount({ state: "loading" })
    fetch(`/api/payments?${scopedQuery}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<{ total: number }>
      })
      .then(({ total }) => setCount({ state: "ready", total }))
      .catch(() => {
        if (!controller.signal.aborted) setCount({ state: "error" })
      })
    return () => controller.abort()
  }, [open, scopedQuery])

  const toggle = (column: ExportColumn, checked: boolean) =>
    setColumns((current) =>
      EXPORT_COLUMNS.filter((c) =>
        c === column ? checked : current.includes(c),
      ),
    )

  const params = new URLSearchParams(scopedQuery)
  params.set("scope", scope)
  params.set("columns", columns.join(","))
  const href = `/api/payments/export?${params.toString()}`
  const nothingSelected = columns.length === 0

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
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose the columns and which payments go into the CSV.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {(
                [
                  ["current", "Current filter"],
                  ["all", "All payments"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 accent-blue-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div
              className="mt-3 text-sm text-gray-500"
              aria-live="polite"
              aria-atomic="true"
            >
              {count.state === "loading" && (
                <>
                  <span className="sr-only">Counting payments…</span>
                  <Skeleton
                    aria-hidden="true"
                    className="h-4 w-40 bg-gray-200 dark:bg-gray-800"
                  />
                </>
              )}
              {count.state === "ready" &&
                `${count.total.toLocaleString()} ${
                  count.total === 1 ? "payment" : "payments"
                } will be exported.`}
              {count.state === "error" && (
                <span className="text-red-600 dark:text-red-500">
                  Could not count payments. The export will still work.
                </span>
              )}
            </div>
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
                    name="export-columns"
                    value={column}
                    checked={columns.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className="size-4 rounded accent-blue-600"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2">
          {nothingSelected && (
            <p
              id="export-no-columns"
              className="text-sm text-gray-500 sm:mr-auto"
            >
              Select at least one column.
            </p>
          )}
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {nothingSelected ? (
            <Button
              disabled
              aria-describedby="export-no-columns"
              className="w-full sm:w-fit"
            >
              Download CSV
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-fit">
              <a href={href} download onClick={() => setOpen(false)}>
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
