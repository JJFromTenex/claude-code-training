"use client"

import { Button } from "@/components/Button"
import { Checkbox } from "@/components/Checkbox"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created date",
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

export function ExportDialog({
  currentFilters,
  currentCount,
  allCount,
}: {
  currentFilters: { status?: string; merchantId?: string; search?: string }
  currentCount: number
  allCount: number
}) {
  const [scope, setScope] = useState<Scope>("current")
  const [columns, setColumns] = useState<Set<ExportColumn>>(
    new Set(DEFAULT_EXPORT_COLUMNS),
  )

  const toggleColumn = (column: ExportColumn, checked: boolean) => {
    setColumns((current) => {
      const next = new Set(current)
      if (checked) next.add(column)
      else next.delete(column)
      return next
    })
  }

  const selectedColumns = EXPORT_COLUMNS.filter((column) =>
    columns.has(column),
  )

  const exportUrl = (() => {
    const params = new URLSearchParams()
    params.set("scope", scope)
    params.set("columns", selectedColumns.join(","))
    if (scope === "current") {
      if (currentFilters.status) params.set("status", currentFilters.status)
      if (currentFilters.merchantId)
        params.set("merchantId", currentFilters.merchantId)
      if (currentFilters.search) params.set("search", currentFilters.search)
    }
    return `/api/payments/export?${params.toString()}`
  })()

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
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="export-scope"
              className="text-sm font-medium text-gray-900 dark:text-gray-50"
            >
              Scope
            </label>
            <Select value={scope} onValueChange={(value) => setScope(value as Scope)}>
              <SelectTrigger id="export-scope" className="py-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">
                  Current filter ({currentCount.toLocaleString()})
                </SelectItem>
                <SelectItem value="all">
                  All payments ({allCount.toLocaleString()})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </span>
            <ul className="flex flex-col gap-2">
              {EXPORT_COLUMNS.map((column) => {
                const inputId = `export-column-${column}`
                return (
                  <li key={column} className="flex items-center gap-2">
                    <Checkbox
                      id={inputId}
                      checked={columns.has(column)}
                      onCheckedChange={(checked) =>
                        toggleColumn(column, checked === true)
                      }
                    />
                    <label
                      htmlFor={inputId}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      {COLUMN_LABELS[column]}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        </DrawerBody>
        <DrawerFooter>
          {selectedColumns.length === 0 ? (
            <Button disabled className="w-full sm:w-fit">
              Download
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-fit">
              <a href={exportUrl}>Download</a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
