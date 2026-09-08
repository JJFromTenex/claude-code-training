"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
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
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

type Scope = "current" | "all"

interface ExportDialogProps {
  filterQuery: string
  currentCount: number
  allCount: number
}

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
  filterQuery,
  currentCount,
  allCount,
}: ExportDialogProps) {
  const [columns, setColumns] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<Scope>("current")

  const toggle = (column: ExportColumn) => {
    setColumns((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const orderedSelection = EXPORT_COLUMNS.filter((column) => columns.has(column))
  const rowCount = scope === "current" ? currentCount : allCount

  const params = new URLSearchParams(filterQuery)
  params.set("scope", scope)
  params.set("columns", orderedSelection.join(","))
  const downloadHref = `/api/payments/export?${params.toString()}`

  const canDownload = columns.size > 0

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
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>Export options</DrawerTitle>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Pick columns and scope. Card last four is off by default.
          </p>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => {
                const checked = columns.has(column)
                return (
                  <label
                    key={column}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:border-gray-800 dark:text-gray-50 dark:has-[:checked]:border-blue-500 dark:has-[:checked]:bg-blue-950"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(column)}
                      className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
                    />
                    <span>{COLUMN_LABELS[column]}</span>
                  </label>
                )
              })}
            </div>
            {!canDownload && (
              <p className="text-sm text-red-600 dark:text-red-500">
                Select at least one column to enable Download.
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:border-gray-800 dark:has-[:checked]:border-blue-500 dark:has-[:checked]:bg-blue-950">
                <input
                  type="radio"
                  name="scope"
                  value="current"
                  checked={scope === "current"}
                  onChange={() => setScope("current")}
                  className="mt-0.5 size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
                />
                <span className="flex-1">
                  <span className="block font-medium text-gray-900 dark:text-gray-50">
                    Current filter
                  </span>
                  <span className="block text-gray-500 dark:text-gray-500">
                    {currentCount.toLocaleString()} payments match your filters.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:border-gray-800 dark:has-[:checked]:border-blue-500 dark:has-[:checked]:bg-blue-950">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className="mt-0.5 size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
                />
                <span className="flex-1">
                  <span className="block font-medium text-gray-900 dark:text-gray-50">
                    All payments
                  </span>
                  <span className="block text-gray-500 dark:text-gray-500">
                    {allCount.toLocaleString()} payments total, filters ignored.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <p className="text-sm text-gray-500 dark:text-gray-500">
            Downloading {rowCount.toLocaleString()} payments as CSV.
          </p>
        </DrawerBody>
        <DrawerFooter>
          {canDownload ? (
            <Button asChild>
              <a href={downloadHref} download>
                Download CSV
              </a>
            </Button>
          ) : (
            <Button disabled>Download CSV</Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
