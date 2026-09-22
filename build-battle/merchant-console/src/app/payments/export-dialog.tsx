"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
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

export function PaymentsExportDialog({
  query,
  filteredTotal,
}: {
  query: string
  filteredTotal: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filter")
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [allTotal, setAllTotal] = useState<number | null>(null)
  const [countFailed, setCountFailed] = useState(false)

  // The current filter's count is already known from the page. The unfiltered
  // count is not, so it comes from the same route the table is built on.
  useEffect(() => {
    if (scope !== "all" || allTotal !== null || countFailed) return
    let cancelled = false
    fetch("/api/payments?page=1")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => {
        if (!cancelled) setAllTotal(body.total)
      })
      .catch(() => {
        if (!cancelled) setCountFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [scope, allTotal, countFailed])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setScope("filter")
      setColumns([...DEFAULT_EXPORT_COLUMNS])
    }
  }

  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((each) => each !== column)
        : // Keep the canonical order rather than the click order.
          EXPORT_COLUMNS.filter(
            (each) => each === column || current.includes(each),
          ),
    )

  const rowCount = scope === "all" ? allTotal : filteredTotal
  const href = () => {
    const params = new URLSearchParams(query)
    params.set("columns", columns.join(","))
    params.set("scope", scope)
    return `/api/payments/export?${params.toString()}`
  }

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

      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
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
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                  <span className="text-gray-900 dark:text-gray-50">
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {countFailed
                ? "Row count unavailable."
                : rowCount === null
                  ? "Counting rows…"
                  : `${rowCount.toLocaleString()} ${
                      rowCount === 1 ? "payment" : "payments"
                    } will be exported.`}
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 space-y-2">
              {EXPORT_COLUMNS.map((column) => (
                <label key={column} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columns.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                  <span className="text-gray-900 dark:text-gray-50">
                    {COLUMN_LABELS[column]}
                  </span>
                </label>
              ))}
            </div>
            {columns.length === 0 && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Choose at least one column.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {columns.length === 0 ? (
            <Button disabled>Download</Button>
          ) : (
            <Button asChild onClick={() => setOpen(false)}>
              <a href={href()}>Download</a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
