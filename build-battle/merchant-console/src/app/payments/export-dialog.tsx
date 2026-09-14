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
import type { ExportColumn, ExportScope } from "@/lib/csv"
import { Download } from "lucide-react"
import { useMemo, useState } from "react"

/**
 * Export options for the payments table (NWP-101).
 *
 * Presentational on purpose: the server page hands over the column list, the
 * defaults, and both row counts, so nothing here fetches and the client bundle
 * never pulls in the store or the serializer. The URL it builds is the same
 * one the old Export link used, plus `columns` and `scope`; the route
 * re-validates both, so the checkboxes are a convenience, not the enforcement.
 */

// Typed against ExportColumn so adding a column to csv.ts fails here until it has a label.
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

const checkboxStyles = [
  // base
  "size-4 shrink-0 rounded border accent-blue-500",
  // border color
  "border-gray-300 dark:border-gray-700",
  // focus
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
].join(" ")

export function ExportDialog({
  query,
  columns,
  defaultColumns,
  sensitiveColumns,
  filterTotal,
  allTotal,
}: {
  /** The table's own query string; the export carries it verbatim, minus `page`. */
  query: string
  columns: readonly ExportColumn[]
  defaultColumns: readonly ExportColumn[]
  sensitiveColumns: readonly ExportColumn[]
  filterTotal: number
  allTotal: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filter")
  const [selected, setSelected] = useState<ReadonlySet<ExportColumn>>(
    () => new Set(defaultColumns),
  )

  // Every open starts from the defaults. The near-miss in the ticket was an
  // unedited file, so a previously ticked last-four must not carry over.
  const onOpenChange = (next: boolean) => {
    if (next) {
      setScope("filter")
      setSelected(new Set(defaultColumns))
    }
    setOpen(next)
  }

  const toggle = (column: ExportColumn, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(column)
      else next.delete(column)
      return next
    })
  }

  const rowCount = scope === "all" ? allTotal : filterTotal
  const chosen = useMemo(
    () => columns.filter((column) => selected.has(column)),
    [columns, selected],
  )
  const href = useMemo(() => {
    const params = new URLSearchParams(query)
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", chosen.join(","))
    return `/api/payments/export?${params.toString()}`
  }, [query, scope, chosen])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent aria-describedby="export-description">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription id="export-description" className="text-sm">
            Choose what goes in the CSV. Card details are off unless you turn
            them on.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="filter"
                checked={scope === "filter"}
                onChange={() => setScope("filter")}
                className={checkboxStyles}
              />
              Current filter
              <span className="tabular-nums text-gray-500">
                · {filterTotal.toLocaleString()} rows
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className={checkboxStyles}
              />
              All payments
              <span className="tabular-nums text-gray-500">
                · {allTotal.toLocaleString()} rows
              </span>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {columns.map((column) => {
              const sensitive = sensitiveColumns.includes(column)
              return (
                <label
                  key={column}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="columns"
                    value={column}
                    checked={selected.has(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className={checkboxStyles}
                  />
                  {COLUMN_LABELS[column]}
                  {sensitive && (
                    <span className="text-xs text-amber-700 dark:text-amber-500">
                      Merchant-sensitive · off by default
                    </span>
                  )}
                </label>
              )
            })}
            {chosen.length === 0 && (
              <p className="mt-1 text-sm text-gray-500" role="status">
                Choose at least one column to enable Download.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {chosen.length === 0 ? (
            // A real button, not a link: anchors cannot be disabled and stay
            // keyboard-followable, which is how an empty file would ship.
            <Button variant="primary" className="py-1.5" disabled>
              Download
            </Button>
          ) : (
            <Button variant="primary" className="py-1.5" asChild>
              <a href={href} onClick={() => setOpen(false)}>
                Download {rowCount.toLocaleString()} rows
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
