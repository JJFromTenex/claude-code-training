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
import { EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
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

const DEFAULT_COLUMNS = EXPORT_COLUMNS.filter((column) => column !== "last4")

type Scope = "current" | "all"

export function ExportDialog({
  filterQuery,
  currentCount,
  allCount,
}: {
  /** The payments page's own filter query string, minus scope/columns. */
  filterQuery: string
  currentCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_COLUMNS),
  )
  const [scope, setScope] = useState<Scope>("current")

  const toggle = (column: ExportColumn) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const orderedColumns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const count = scope === "current" ? currentCount : allCount

  const params = new URLSearchParams(filterQuery)
  params.set("scope", scope)
  params.set("columns", orderedColumns.join(","))
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Drawer>
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
          <DrawerDescription>Choose what ships in the file.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="export-scope"
                  className="size-4 accent-blue-500"
                  checked={scope === "current"}
                  onChange={() => setScope("current")}
                />
                Current filter ({currentCount.toLocaleString()} payments)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="export-scope"
                  className="size-4 accent-blue-500"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                />
                All payments ({allCount.toLocaleString()} payments)
              </label>
            </div>
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
                    className="size-4 rounded accent-blue-500"
                    checked={selected.has(column)}
                    onChange={() => toggle(column)}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-sm text-gray-500">
            {count.toLocaleString()} payments will be exported.
          </p>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          <Button
            variant="primary"
            disabled={selected.size === 0}
            asChild={selected.size > 0}
          >
            {selected.size > 0 ? (
              <a href={href}>Download</a>
            ) : (
              <span>Download</span>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
