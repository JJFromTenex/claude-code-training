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
import type { ExportColumn } from "@/lib/csv"
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

const checkboxStyles =
  "size-4 shrink-0 rounded border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:border-gray-700 dark:bg-gray-900"

/**
 * Export options for the payments table.
 *
 * The dialog only assembles a URL. Every column is filtered and every row is
 * gathered on the server, so what ops sees here cannot narrow the file to the
 * page the table is showing.
 */
export function PaymentsExportDialog({
  query,
  allColumns,
  defaultColumns,
  filteredCount,
  totalCount,
}: {
  query: string
  allColumns: readonly ExportColumn[]
  defaultColumns: readonly ExportColumn[]
  filteredCount: number
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<"filter" | "all">("filter")
  const [selected, setSelected] = useState<ExportColumn[]>([...defaultColumns])

  const chosen = allColumns.filter((column) => selected.includes(column))
  const rowCount = scope === "all" ? totalCount : filteredCount

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : [...current, column],
    )

  const href = () => {
    const params = new URLSearchParams(query)
    params.delete("page")
    params.set("columns", chosen.join(","))
    if (scope === "all") params.set("scope", "all")
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
          <DrawerDescription>
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="filter"
                checked={scope === "filter"}
                onChange={() => setScope("filter")}
                className={checkboxStyles}
              />
              Current filter
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className={checkboxStyles}
              />
              All payments
            </label>
            <p className="text-sm text-gray-500" aria-live="polite">
              {rowCount.toLocaleString()}{" "}
              {rowCount === 1 ? "payment" : "payments"} will be exported.
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {allColumns.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(column)}
                  onChange={() => toggle(column)}
                  className={checkboxStyles}
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
            {chosen.length === 0 && (
              <p className="text-sm text-red-600 dark:text-red-500">
                Choose at least one column to download a file.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          {chosen.length === 0 ? (
            <Button variant="primary" className="gap-2" disabled>
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download
            </Button>
          ) : (
            <Button variant="primary" className="gap-2" asChild>
              <a href={href()} onClick={() => setOpen(false)}>
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
