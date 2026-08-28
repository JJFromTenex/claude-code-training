"use client"

import { Button } from "@/components/Button"
import { Checkbox } from "@/components/Checkbox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  type ExportColumn,
  type ExportScope,
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

export function ExportDialog({
  query,
  filteredCount,
  allCount,
}: {
  query: string
  filteredCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("current")
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )

  // Derived from EXPORT_COLUMNS so the header order is the canonical one no
  // matter what order the boxes were ticked in.
  const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const rowCount = scope === "all" ? allCount : filteredCount
  const canDownload = columns.length > 0

  const params = new URLSearchParams(query)
  params.delete("page")
  params.set("scope", scope)
  params.set("columns", columns.join(","))
  const href = `/api/payments/export?${params.toString()}`

  const toggle = (column: ExportColumn) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

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

        <DialogBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <div className="mt-2 flex flex-col gap-1">
              {(
                [
                  ["current", "Current filter"],
                  ["all", "All payments"],
                ] as [ExportScope, string][]
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 py-1 text-sm text-gray-900 dark:text-gray-50"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className={cx(
                      "size-4 shrink-0 cursor-pointer accent-blue-500",
                      focusRing,
                    )}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {rowCount.toLocaleString()}{" "}
              {rowCount === 1 ? "payment" : "payments"} will be exported.
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <Checkbox
                  key={column}
                  label={COLUMN_LABELS[column]}
                  hint={column === "last4" ? "Off by default" : undefined}
                  checked={selected.has(column)}
                  onChange={() => toggle(column)}
                />
              ))}
            </div>
            {!canDownload && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Pick at least one column.
              </p>
            )}
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {/* disabled does nothing on a Slot-rendered anchor, so the element
              itself is swapped out — the same pattern the pager uses. */}
          <Button disabled={!canDownload} asChild={canDownload}>
            {canDownload ? (
              <a href={href} onClick={() => setOpen(false)}>
                Download
              </a>
            ) : (
              <span>Download</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
