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
  type ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Payment method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

type ExportScope = "filtered" | "all"

export function ExportDialog({ query }: { query: string }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filtered")
  const [selectedColumns, setSelectedColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [countError, setCountError] = useState(false)

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    const countQuery = scope === "all" ? "" : query

    setRowCount(null)
    setCountError(false)

    fetch(`/api/payments?${countQuery}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Payment count request failed")

        const data: unknown = await response.json()
        if (
          typeof data !== "object" ||
          data === null ||
          !("total" in data) ||
          typeof data.total !== "number"
        ) {
          throw new Error("Payment count response was invalid")
        }

        setRowCount(data.total)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setCountError(true)
      })

    return () => controller.abort()
  }, [open, query, scope])

  const downloadHref = useMemo(() => {
    const params = new URLSearchParams(scope === "filtered" ? query : "")
    params.set("scope", scope)
    params.set(
      "columns",
      EXPORT_COLUMNS.filter((column) => selectedColumns.includes(column)).join(","),
    )
    return `/api/payments/export?${params.toString()}`
  }, [query, scope, selectedColumns])

  const toggleColumn = (column: ExportColumn) => {
    setSelectedColumns((current) =>
      current.includes(column)
        ? current.filter((selected) => selected !== column)
        : [...current, column],
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="secondary"
          className="w-full gap-2 py-1.5 sm:w-fit"
        >
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
          <DrawerDescription>
            Choose which payments and columns to include in the CSV file.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-3 space-y-3">
              {(
                [
                  ["filtered", "Current filter"],
                  ["all", "All payments"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div aria-live="polite" className="text-sm">
            {countError ? (
              <p className="text-red-600 dark:text-red-500">
                Could not count payments. Try again.
              </p>
            ) : rowCount === null ? (
              <p className="text-gray-500">Counting…</p>
            ) : (
              <p className="text-gray-700 dark:text-gray-300">
                {rowCount.toLocaleString()} {rowCount === 1 ? "payment" : "payments"} will be
                exported.
              </p>
            )}
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex cursor-pointer items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column)}
                    onChange={() => toggleColumn(column)}
                    className="size-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          {selectedColumns.length === 0 && (
            <p className="text-sm text-red-600 dark:text-red-500">
              Select at least one column
            </p>
          )}
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {selectedColumns.length === 0 ? (
            <Button disabled>Download CSV</Button>
          ) : (
            <Button asChild>
              <a href={downloadHref}>Download CSV</a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
