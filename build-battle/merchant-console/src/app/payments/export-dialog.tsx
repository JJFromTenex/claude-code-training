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

const checkboxStyles =
  "size-4 shrink-0 rounded border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"

export function PaymentsExportDialog({
  query,
  filteredTotal,
  allTotal,
}: {
  query: string
  filteredTotal: number
  allTotal: number
}) {
  const [scope, setScope] = useState<ExportScope>("filtered")
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  const rowCount = scope === "all" ? allTotal : filteredTotal
  const nothingSelected = columns.length === 0

  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : // Keep catalogue order so the file reads the way this list does.
          EXPORT_COLUMNS.filter(
            (name) => name === column || current.includes(name),
          ),
    )

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", columns.join(","))
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
          <DrawerDescription className="text-sm">
            Card last four is left out unless you ask for it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filtered", "Current filter", filteredTotal],
                  ["all", "All payments", allTotal],
                ] as const
              ).map(([value, label, count]) => (
                <label
                  key={value}
                  htmlFor={`scope-${value}`}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    id={`scope-${value}`}
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className={checkboxStyles}
                  />
                  {label}
                  <span className="text-gray-500 dark:text-gray-500">
                    {count.toLocaleString()}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  htmlFor={`column-${column}`}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    id={`column-${column}`}
                    checked={columns.includes(column)}
                    onChange={() => toggle(column)}
                    className={checkboxStyles}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {nothingSelected && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-500">
                Pick at least one column to export.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {nothingSelected ? (
            <Button className="gap-2 py-1.5" disabled>
              Download
            </Button>
          ) : (
            <Button className="gap-2 py-1.5" asChild>
              <a href={href}>
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
