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

/**
 * Export options for the payments table (NWP-101). The server re-validates
 * everything chosen here; these controls are a convenience, not enforcement.
 */
export function ExportDialog({ filterQuery }: { filterQuery: string }) {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filter")
  const [count, setCount] = useState<number | null>(null)
  const [countError, setCountError] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setCount(null)
    setCountError(false)
    // Same query builder as the export, so the count matches the file.
    fetch(`/api/payments?${scope === "all" ? "" : filterQuery}`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json()
      })
      .then((data: { total: number }) => {
        if (!cancelled) setCount(data.total)
      })
      .catch(() => {
        if (!cancelled) setCountError(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, scope, filterQuery])

  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : [...current, column],
    )

  const download = () => {
    const params = new URLSearchParams(scope === "all" ? "" : filterQuery)
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    window.location.assign(`/api/payments/export?${params.toString()}`)
    setOpen(false)
  }

  const nothingChosen = columns.length === 0

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
            Choose what goes in the CSV. Card last four is off by default.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filter", "Current filter"],
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
                    className="size-4 accent-blue-500"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p
              className="mt-2 text-sm text-gray-500"
              role="status"
              aria-live="polite"
            >
              {countError
                ? "Couldn't count rows. The export will still include every match."
                : count === null
                  ? "Counting rows…"
                  : `${count.toLocaleString()} ${count === 1 ? "row" : "rows"} will be exported`}
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={columns.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4 accent-blue-500"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {nothingChosen && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Choose at least one column to export.
              </p>
            )}
          </fieldset>
        </DrawerBody>
        <DrawerFooter className="gap-2">
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          <Button onClick={download} disabled={nothingChosen}>
            Download CSV
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
