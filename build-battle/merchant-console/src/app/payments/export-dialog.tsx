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

const LABELS: Record<ExportColumn, string> = {
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
  allTotal,
}: {
  /** The active filter params, already serialized by the page. */
  query: string
  filteredTotal: number
  allTotal: number
}) {
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<"filtered" | "all">("filtered")

  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : // Keep the canonical order rather than click order.
          EXPORT_COLUMNS.filter((c) => c === column || current.includes(c)),
    )

  const href = () => {
    const params = new URLSearchParams(scope === "all" ? "" : query)
    params.set("columns", columns.join(","))
    params.set("scope", scope)
    return `/api/payments/export?${params.toString()}`
  }

  const rowCount = scope === "all" ? allTotal : filteredTotal

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
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filtered", "Current filter", filteredTotal],
                  ["all", "All payments", allTotal],
                ] as const
              ).map(([value, label, total]) => (
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
                    className="size-4 accent-blue-500"
                  />
                  {label}
                  <span className="text-gray-500">
                    ({total.toLocaleString()} rows)
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 space-y-2">
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
                    className="size-4 rounded accent-blue-500"
                  />
                  {LABELS[column]}
                </label>
              ))}
            </div>
            {columns.length === 0 && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column to export.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <p className="mr-auto self-center text-sm text-gray-500">
            {rowCount.toLocaleString()} rows · {columns.length} columns
          </p>
          {columns.length === 0 ? (
            <Button disabled>Download</Button>
          ) : (
            <Button asChild>
              <a href={href()} download>
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
