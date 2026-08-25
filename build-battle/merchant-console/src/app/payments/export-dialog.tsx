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
import { useMemo, useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
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

export function ExportDialog({
  query,
  currentCount,
  allCount,
}: {
  /** The active filter query string, e.g. "status=disputed&merchantId=mch_01". */
  query: string
  currentCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<ExportColumn[]>([...DEFAULT_EXPORT_COLUMNS])
  const [scope, setScope] = useState<ExportScope>("current")

  const toggleColumn = (column: ExportColumn) => {
    setColumns((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column],
    )
  }

  const href = useMemo(() => {
    const params = new URLSearchParams(query)
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    return `/api/payments/export?${params.toString()}`
  }, [query, scope, columns])

  const count = scope === "current" ? currentCount : allCount
  const canDownload = columns.length > 0

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
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose which columns and how many rows to include.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {EXPORT_COLUMNS.map((column) => {
                const id = `export-column-${column}`
                return (
                  <label
                    key={column}
                    htmlFor={id}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <input
                      id={id}
                      type="checkbox"
                      className="size-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:focus:ring-blue-700/30"
                      checked={columns.includes(column)}
                      onChange={() => toggleColumn(column)}
                    />
                    {COLUMN_LABELS[column]}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-3 flex flex-col gap-2">
              <label
                htmlFor="export-scope-current"
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id="export-scope-current"
                  type="radio"
                  name="export-scope"
                  className="size-4 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:focus:ring-blue-700/30"
                  checked={scope === "current"}
                  onChange={() => setScope("current")}
                />
                Current filter
              </label>
              <label
                htmlFor="export-scope-all"
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id="export-scope-all"
                  type="radio"
                  name="export-scope"
                  className="size-4 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:focus:ring-blue-700/30"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                />
                All payments
              </label>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              {count.toLocaleString()} {count === 1 ? "payment" : "payments"} will be
              exported.
            </p>
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          <Button
            asChild={canDownload}
            disabled={!canDownload}
            onClick={() => canDownload && setOpen(false)}
          >
            {canDownload ? <a href={href}>Download</a> : <span>Download</span>}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
