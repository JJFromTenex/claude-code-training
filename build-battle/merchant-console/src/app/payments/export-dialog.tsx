"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useMemo, useState } from "react"

// Mirrors src/lib/csv.ts's EXPORT_COLUMNS. Kept as a prop rather than an
// import from csv.ts, which pulls in @/data/merchants — no reason to risk
// dragging that into the client bundle for a label list.
const COLUMN_LABELS: Record<string, string> = {
  id: "Payment ID",
  created_at: "Date",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

export function ExportDialog({
  columns,
  defaultColumns,
  baseQuery,
  filteredTotal,
  allTotal,
}: {
  columns: readonly string[]
  defaultColumns: readonly string[]
  baseQuery: string
  filteredTotal: number
  allTotal: number
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultColumns),
  )
  const [scope, setScope] = useState<"filtered" | "all">("filtered")

  const href = useMemo(() => {
    const params = new URLSearchParams(baseQuery)
    params.delete("columns")
    for (const column of selected) params.append("columns", column)
    params.set("scope", scope)
    return `/api/payments/export?${params.toString()}`
  }, [baseQuery, selected, scope])

  const toggleColumn = (column: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const rowCount = scope === "all" ? allTotal : filteredTotal
  const canDownload = selected.size > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Choose the columns and the rows to include.
        </DialogDescription>
        <DialogBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 flex flex-col gap-1.5">
              {columns.map((column) => (
                <label
                  key={column}
                  htmlFor={`export-column-${column}`}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    id={`export-column-${column}`}
                    checked={selected.has(column)}
                    onChange={() => toggleColumn(column)}
                    aria-describedby={
                      column === "last4" ? "export-column-last4-hint" : undefined
                    }
                    className={cx(
                      "size-4 rounded border-gray-300 text-blue-600 accent-blue-600 dark:border-gray-700",
                      focusRing,
                    )}
                  />
                  {COLUMN_LABELS[column] ?? column}
                </label>
              ))}
            </div>
            <p
              id="export-column-last4-hint"
              className="mt-1.5 text-xs text-gray-500 dark:text-gray-500"
            >
              Card last four. Leave this off unless the merchant has asked
              for it.
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <div className="mt-2 flex flex-col gap-1.5">
              <label
                htmlFor="export-scope-filtered"
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="radio"
                  id="export-scope-filtered"
                  name="export-scope"
                  checked={scope === "filtered"}
                  onChange={() => setScope("filtered")}
                  className={cx(
                    "size-4 border-gray-300 text-blue-600 accent-blue-600 dark:border-gray-700",
                    focusRing,
                  )}
                />
                Current filter — {filteredTotal.toLocaleString()} payments
              </label>
              <label
                htmlFor="export-scope-all"
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="radio"
                  id="export-scope-all"
                  name="export-scope"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className={cx(
                    "size-4 border-gray-300 text-blue-600 accent-blue-600 dark:border-gray-700",
                    focusRing,
                  )}
                />
                All payments — {allTotal.toLocaleString()} payments
              </label>
            </div>
          </fieldset>

          <p aria-live="polite" className="text-sm text-gray-500 dark:text-gray-500">
            {canDownload
              ? `Downloading ${rowCount.toLocaleString()} payments · ${selected.size} column${selected.size === 1 ? "" : "s"}`
              : ""}
          </p>
        </DialogBody>
        <DialogFooter>
          {canDownload ? (
            <Button asChild>
              <a href={href} onClick={() => setOpen(false)}>
                Download
              </a>
            </Button>
          ) : (
            <Button disabled aria-describedby="export-download-hint">
              <span>Download</span>
            </Button>
          )}
        </DialogFooter>
        <p
          id="export-download-hint"
          role="status"
          className={cx(
            "text-sm text-red-600 dark:text-red-500",
            canDownload && "sr-only",
          )}
        >
          {canDownload ? "" : "Select at least one column to download."}
        </p>
      </DialogContent>
    </Dialog>
  )
}
