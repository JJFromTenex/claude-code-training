"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Export options for the payments table (NWP-101).
 *
 * The download stays a plain link, so the browser handles the file and the row
 * set is built on the server. Disabling Download on an empty selection is a
 * courtesy — the route rejects it too.
 */

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

type Scope = "filtered" | "all"

export function PaymentsExportDialog({
  columns,
  defaultColumns,
  filteredTotal,
  grandTotal,
  query,
  hasFilters,
}: {
  columns: readonly string[]
  defaultColumns: readonly string[]
  filteredTotal: number
  grandTotal: number
  query: string
  hasFilters: boolean
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("filtered")
  const [selected, setSelected] = useState<readonly string[]>(defaultColumns)

  const rowCount = scope === "all" ? grandTotal : filteredTotal
  // Canonical order, so the file reads the same way however the boxes were ticked.
  const ordered = columns.filter((column) => selected.includes(column))

  const toggle = (column: string) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : [...current, column],
    )

  const href = () => {
    const params = new URLSearchParams(query)
    params.set("columns", ordered.join(","))
    if (scope === "all") params.set("scope", "all")
    else params.delete("scope")
    return `/api/payments/export?${params.toString()}`
  }

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
          <DrawerDescription className="text-sm">
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <div className="mt-2 space-y-2">
              <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  value="filtered"
                  checked={scope === "filtered"}
                  onChange={() => setScope("filtered")}
                  className="mt-0.5 size-4 shrink-0 accent-blue-500"
                />
                <span>
                  Current filter
                  {!hasFilters && (
                    <span className="text-gray-500"> (no filter active)</span>
                  )}
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className="mt-0.5 size-4 shrink-0 accent-blue-500"
                />
                <span>All payments</span>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4 shrink-0 accent-blue-500"
                  />
                  <span>{COLUMN_LABELS[column] ?? column}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p
            aria-live="polite"
            className="border-t border-gray-200 pt-4 text-sm text-gray-500 dark:border-gray-900"
          >
            {ordered.length === 0 ? (
              <>Select at least one column to export.</>
            ) : (
              <>
                {rowCount.toLocaleString()}{" "}
                {rowCount === 1 ? "row" : "rows"} ·{" "}
                {ordered.length} of {columns.length} columns
              </>
            )}
          </p>
        </DrawerBody>

        <DrawerFooter>
          {ordered.length === 0 ? (
            <Button disabled>Download CSV</Button>
          ) : (
            <Button asChild>
              <a href={href()} onClick={() => setOpen(false)}>
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
