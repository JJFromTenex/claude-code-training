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
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

const control =
  "size-4 shrink-0 border-gray-300 text-blue-500 accent-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700"

export function PaymentsExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  query: string
  filteredCount: number
  totalCount: number
}) {
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<"current" | "all">("current")

  // Adding a column re-derives from EXPORT_COLUMNS, so the file keeps its
  // canonical order however the boxes were clicked.
  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((chosen) => chosen !== column)
        : EXPORT_COLUMNS.filter(
            (candidate) => candidate === column || current.includes(candidate),
          ),
    )

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", columns.join(","))

  const rowCount = scope === "all" ? totalCount : filteredCount
  const nothingSelected = columns.length === 0

  const scopes = [
    { value: "current", label: "Current filter", count: filteredCount },
    { value: "all", label: "All payments", count: totalCount },
  ] as const

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

      <DrawerContent className="sm:max-w-lg">
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
            <div className="mt-3 space-y-3">
              {scopes.map((option) => (
                <div key={option.value} className="flex items-center gap-x-3">
                  <input
                    type="radio"
                    id={`scope-${option.value}`}
                    name="export-scope"
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                    className={control}
                  />
                  <label
                    htmlFor={`scope-${option.value}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {option.label}
                    <span className="ml-1.5 tabular-nums text-gray-500 dark:text-gray-500">
                      {option.count.toLocaleString()} payments
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <div key={column} className="flex items-center gap-x-3">
                  <input
                    type="checkbox"
                    id={`column-${column}`}
                    checked={columns.includes(column)}
                    onChange={() => toggle(column)}
                    className={control}
                  />
                  <label
                    htmlFor={`column-${column}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {COLUMN_LABELS[column]}
                  </label>
                </div>
              ))}
            </div>
            {nothingSelected && (
              <p
                role="status"
                className="mt-3 text-sm text-red-600 dark:text-red-500"
              >
                Choose at least one column to export.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {nothingSelected ? (
            <Button disabled className="w-full gap-2 sm:w-fit">
              Download
            </Button>
          ) : (
            <Button asChild className="w-full gap-2 sm:w-fit">
              <a href={`/api/payments/export?${params.toString()}`} download>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download {rowCount.toLocaleString()}{" "}
                {rowCount === 1 ? "payment" : "payments"}
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
