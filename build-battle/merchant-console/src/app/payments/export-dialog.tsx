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
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
} from "@/lib/csv"
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

type Scope = "current" | "all"

export function PaymentsExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  /** The active filter query string, so the export matches what is on screen. */
  query: string
  filteredCount: number
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("current")
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  const rowCount = scope === "current" ? filteredCount : totalCount
  const nothingSelected = selected.length === 0

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : EXPORT_COLUMNS.filter(
            (name) => name === column || current.includes(name),
          ),
    )

  // Scope "all" deliberately drops the filters rather than sending them along.
  const params =
    scope === "all" ? new URLSearchParams() : new URLSearchParams(query)
  params.delete("page")
  params.set("scope", scope)
  params.set("columns", selected.join(","))
  const href = `/api/payments/export?${params.toString()}`

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

      <DrawerContent className="sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription className="mt-1 text-sm">
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["current", "Current filter", filteredCount],
                  ["all", "All payments", totalCount],
                ] as const
              ).map(([value, label, count]) => (
                <label
                  key={value}
                  htmlFor={`scope-${value}`}
                  className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    id={`scope-${value}`}
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                  <span>{label}</span>
                  <span className="text-gray-500 tabular-nums dark:text-gray-500">
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
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  htmlFor={`column-${column}`}
                  className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    id={`column-${column}`}
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                  <span>{COLUMN_LABELS[column]}</span>
                </label>
              ))}
            </div>
            {nothingSelected && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-500">
                Select at least one column to export.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <p className="mt-2 flex-1 text-sm text-gray-500 sm:mt-0 sm:self-center dark:text-gray-500">
            {rowCount.toLocaleString()} {rowCount === 1 ? "payment" : "payments"}
            {" · "}
            {selected.length} {selected.length === 1 ? "column" : "columns"}
          </p>
          <Button
            variant="primary"
            className="py-1.5"
            disabled={nothingSelected}
            asChild={!nothingSelected}
          >
            {nothingSelected ? (
              <span>Download CSV</span>
            ) : (
              <a href={href} onClick={() => setOpen(false)}>
                Download CSV
              </a>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
