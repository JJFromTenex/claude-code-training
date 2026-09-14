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
  type ExportScope,
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

const checkboxClass =
  "size-4 shrink-0 accent-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"

export function PaymentsExportDialog({
  query,
  filteredCount,
  allCount,
}: {
  query: string
  filteredCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filtered")

  // Emit in EXPORT_COLUMNS order so the file matches the list on screen,
  // however the boxes were ticked.
  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : EXPORT_COLUMNS.filter((c) => c === column || current.includes(c)),
    )

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", selected.join(","))
  const href = `/api/payments/export?${params.toString()}`

  const rowCount = scope === "all" ? allCount : filteredCount
  const canDownload = selected.length > 0

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
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="filtered"
                checked={scope === "filtered"}
                onChange={() => setScope("filtered")}
                className={checkboxClass}
              />
              Current filter
              <span className="text-gray-500">
                — {filteredCount.toLocaleString()} payments
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className={checkboxClass}
              />
              All payments
              <span className="text-gray-500">
                — {allCount.toLocaleString()} payments
              </span>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  name="columns"
                  value={column}
                  checked={selected.includes(column)}
                  onChange={() => toggle(column)}
                  className={checkboxClass}
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
            {!canDownload && (
              <p className="text-sm text-red-600 dark:text-red-500">
                Select at least one column to download.
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
          <Button
            className="gap-2 py-1.5"
            disabled={!canDownload}
            asChild={canDownload}
          >
            {canDownload ? (
              <a href={href} download>
                Download {rowCount.toLocaleString()} rows
              </a>
            ) : (
              <span>Download {rowCount.toLocaleString()} rows</span>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
