"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useState } from "react"
// Type only: the value side of @/lib/csv reaches into the store, and none of
// that belongs in a client bundle. The column lists arrive as props.
import type { ExportColumn, ExportScope } from "@/lib/csv"

const LABELS: Record<string, string> = {
  id: "Payment ID",
  created_at: "Created at",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

export function PaymentsExportDialog({
  query,
  columns,
  defaultColumns,
  filteredCount,
  allCount,
}: {
  query: string
  columns: ExportColumn[]
  defaultColumns: ExportColumn[]
  filteredCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<ExportColumn[]>(defaultColumns)
  const [scope, setScope] = useState<ExportScope>("filtered")

  const toggle = (column: ExportColumn) => {
    // Rebuild from the canonical order rather than appending, so the header
    // does not depend on the order the boxes were clicked.
    setSelected((current) =>
      columns.filter((candidate) =>
        candidate === column
          ? !current.includes(column)
          : current.includes(candidate),
      ),
    )
  }

  const rowCount = scope === "all" ? allCount : filteredCount

  // "All payments" deliberately drops the narrowing filters; the route does
  // the same thing server-side, so the link and the file agree.
  const params = new URLSearchParams(scope === "all" ? "" : query)
  params.delete("page")
  params.set("scope", scope)
  params.set("columns", selected.join(","))
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Dialog>
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
          <DialogDescription>
            Choose what goes in the file before you download it.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(["filtered", "all"] as const).map((option) => (
                <div key={option} className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`export-scope-${option}`}
                    name="export-scope"
                    value={option}
                    checked={scope === option}
                    onChange={() => setScope(option)}
                    className={cx("accent-blue-500", focusRing)}
                  />
                  <label
                    htmlFor={`export-scope-${option}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {option === "filtered" ? "Current filter" : "All payments"}
                    <span className="text-gray-500">
                      {" · "}
                      {(option === "filtered"
                        ? filteredCount
                        : allCount
                      ).toLocaleString()}{" "}
                      payments
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`export-col-${column}`}
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className={cx("accent-blue-500", focusRing)}
                  />
                  <label
                    htmlFor={`export-col-${column}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {LABELS[column] ?? column}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <p className="mt-2 text-sm text-gray-500 sm:mr-auto sm:mt-0 sm:self-center">
            {selected.length === 0
              ? "Select at least one column."
              : `${rowCount.toLocaleString()} payments · ${selected.length} columns`}
          </p>
          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>
          {selected.length === 0 ? (
            <Button className="py-1.5" disabled>
              Download
            </Button>
          ) : (
            <Button className="py-1.5" asChild>
              <a href={href} download>
                Download
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
