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
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Export options for the payments table.
 *
 * This component never sees a payment. It collects choices, builds a query
 * string, and lets the export route do the work — building the file here would
 * export the current page, which is the bug rather than the feature.
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

export function ExportDialog({
  query,
  columns,
  defaultColumns,
  counts,
}: {
  query: string
  columns: string[]
  defaultColumns: string[]
  counts: { filter: number; all: number }
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(defaultColumns)
  const [scope, setScope] = useState<"filter" | "all">("filter")

  // Ordered by the allowlist, not by the order boxes were ticked, so the file
  // reads the same way every time.
  const chosen = columns.filter((column) => selected.includes(column))
  const rowCount = scope === "all" ? counts.all : counts.filter

  const toggle = (column: string) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : [...current, column],
    )

  const href = () => {
    const params = new URLSearchParams(query)
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", chosen.join(","))
    return `/api/payments/export?${params.toString()}`
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        // Reopening starts from the defaults, so the card last four is never
        // carried into the next export by accident.
        if (next) {
          setSelected(defaultColumns)
          setScope("filter")
        }
        setOpen(next)
      }}
    >
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
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <p className="text-sm text-gray-500">
              The card last four is left out unless you ask for it.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`column-${column}`}
                    name="columns"
                    value={column}
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                  <label
                    htmlFor={`column-${column}`}
                    className="text-sm text-gray-900 dark:text-gray-50"
                  >
                    {COLUMN_LABELS[column] ?? column}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filter", "Current filter", counts.filter],
                  ["all", "All payments", counts.all],
                ] as const
              ).map(([value, label, count]) => (
                <div key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`scope-${value}`}
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                  <label
                    htmlFor={`scope-${value}`}
                    className="text-sm text-gray-900 dark:text-gray-50"
                  >
                    {label}{" "}
                    <span className="text-gray-500">
                      ({count.toLocaleString()} payments)
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <p className="text-sm text-gray-500" aria-live="polite">
            {chosen.length === 0
              ? "Select at least one column to download."
              : `${rowCount.toLocaleString()} payments · ${chosen.length} ${
                  chosen.length === 1 ? "column" : "columns"
                }`}
          </p>
        </DrawerBody>

        <DrawerFooter className="gap-2">
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {chosen.length === 0 ? (
            <Button className="gap-2 py-1.5" disabled>
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download
            </Button>
          ) : (
            <Button className="gap-2 py-1.5" asChild onClick={() => setOpen(false)}>
              <a href={href()} download>
                <Download
                  className="-ml-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
