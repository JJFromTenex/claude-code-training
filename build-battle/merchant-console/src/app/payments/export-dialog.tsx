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
import { ExportColumn } from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Export options for the payments table (NWP-101).
 *
 * Ops picks the columns and the scope, sees how many rows they are about to
 * download, and only then gets a link. The choices are carried as query
 * parameters to `GET /api/payments/export`, which validates them again — this
 * dialog is where the choice is made, not where it is enforced.
 *
 * Row counts arrive as props because the page that renders this is a server
 * component that already queried both. Nothing is fetched from here.
 */

/** Human labels for the column names the API expects. */
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

type Scope = "filter" | "all"

export function PaymentsExportDialog({
  columns,
  defaultColumns,
  filteredCount,
  totalCount,
  query,
  hasFilters,
}: {
  /** Every column that may be exported, in the order the API declares them. */
  columns: readonly ExportColumn[]
  /** The columns ticked when the dialog opens. Excludes the card last four. */
  defaultColumns: readonly ExportColumn[]
  /** Rows matching the filters currently on screen. */
  filteredCount: number
  /** Rows in the table regardless of filters. */
  totalCount: number
  /** The active filter query string, forwarded so scope "filter" means it. */
  query: string
  /** Whether any filter is actually active, so the copy can say so honestly. */
  hasFilters: boolean
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ExportColumn[]>([...defaultColumns])
  const [scope, setScope] = useState<Scope>("filter")

  /**
   * Every open starts from the defaults, including the card last four being
   * off. Left sticky, a merchant export ticked once stays ticked for the next
   * one — which is the near-miss this ticket exists to prevent. Opting in is
   * cheap; noticing that you did not mean to is not.
   */
  const onOpenChange = (next: boolean) => {
    if (next) {
      setSelected([...defaultColumns])
      setScope("filter")
    }
    setOpen(next)
  }

  const toggle = (column: ExportColumn) => {
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : // Keep the declared order rather than click order, so the file
          // reads the same way the table does.
          columns.filter((name) => name === column || current.includes(name)),
    )
  }

  const rowCount = scope === "all" ? totalCount : filteredCount
  const isEmpty = selected.length === 0

  // Scope "all" deliberately drops the filters; "filter" carries them through.
  const params = new URLSearchParams(scope === "all" ? "" : query)
  params.set("columns", selected.join(","))
  params.set("scope", scope)
  // Paging belongs to the table, never to the file.
  params.delete("page")
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <label
                htmlFor="export-scope-filter"
                className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="radio"
                  id="export-scope-filter"
                  name="export-scope"
                  value="filter"
                  checked={scope === "filter"}
                  onChange={() => setScope("filter")}
                  className={cx(
                    "size-4 shrink-0 border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-900",
                    focusRing,
                  )}
                />
                {hasFilters ? "Current filter" : "Current view"}
                <span className="text-gray-500 dark:text-gray-500">
                  · {filteredCount.toLocaleString()}{" "}
                  {filteredCount === 1 ? "payment" : "payments"}
                </span>
              </label>

              <label
                htmlFor="export-scope-all"
                className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="radio"
                  id="export-scope-all"
                  name="export-scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className={cx(
                    "size-4 shrink-0 border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-900",
                    focusRing,
                  )}
                />
                All payments
                <span className="text-gray-500 dark:text-gray-500">
                  · {totalCount.toLocaleString()} payments
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column}
                  htmlFor={`export-column-${column}`}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    id={`export-column-${column}`}
                    name="columns"
                    value={column}
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className={cx(
                      "size-4 shrink-0 rounded border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-900",
                      focusRing,
                    )}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <p
            className="text-sm text-gray-500 sm:mr-auto dark:text-gray-500"
            role="status"
          >
            {isEmpty ? (
              <span className="text-red-600 dark:text-red-500">
                Select at least one column
              </span>
            ) : (
              <>
                {rowCount.toLocaleString()} {rowCount === 1 ? "row" : "rows"} ·{" "}
                {selected.length}{" "}
                {selected.length === 1 ? "column" : "columns"}
              </>
            )}
          </p>

          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>

          {/*
            An anchor so the browser handles the download and the dialog stays
            put. With nothing selected there is no file to link to, so the
            control becomes a disabled button rather than a dead link.
          */}
          {isEmpty ? (
            <Button variant="primary" className="py-1.5" disabled>
              Download CSV
            </Button>
          ) : (
            <Button variant="primary" className="gap-2 py-1.5" asChild>
              <a href={href} download>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download CSV
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
