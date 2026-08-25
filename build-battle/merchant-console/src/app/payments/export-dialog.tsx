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
  card_brand: "Card Brand",
  last4: "Card Last 4",
  amount: "Amount",
  currency: "Currency",
}

const DEFAULT_COLUMNS = new Set<ExportColumn>(
  EXPORT_COLUMNS.filter((c) => c !== "last4"),
)

interface ExportDialogProps {
  query: string
  filterTotal: number
  allTotal: number
}

export function ExportDialog({ query, filterTotal, allTotal }: ExportDialogProps) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(DEFAULT_COLUMNS)
  const [scope, setScope] = useState<"filter" | "all">("filter")

  const toggle = (col: ExportColumn) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
  }

  const rowCount = scope === "filter" ? filterTotal : allTotal
  const hasColumns = selected.size > 0

  const exportHref = () => {
    const params = new URLSearchParams()
    if (scope === "filter") {
      new URLSearchParams(query).forEach((v, k) => params.set(k, v))
    }
    params.set("scope", scope)
    EXPORT_COLUMNS.filter((c) => selected.has(c)).forEach((c) =>
      params.append("columns", c),
    )
    return `/api/payments/export?${params.toString()}`
  }

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
          <DrawerDescription>Choose columns and scope before downloading.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="space-y-2">
              {(
                [
                  { value: "filter", label: "Current filter", count: filterTotal },
                  { value: "all", label: "All payments", count: allTotal },
                ] as const
              ).map(({ value, label, count }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="accent-blue-500"
                  />
                  {label}{" "}
                  <span className="text-gray-400 dark:text-gray-500">
                    ({count.toLocaleString()} rows)
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="space-y-2">
              {EXPORT_COLUMNS.map((col) => (
                <label
                  key={col}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(col)}
                    onChange={() => toggle(col)}
                    className="accent-blue-500"
                  />
                  {COLUMN_LABELS[col]}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-sm text-gray-500">
            {rowCount.toLocaleString()} rows will be exported
          </p>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          <Button variant="primary" disabled={!hasColumns} asChild={hasColumns}>
            {hasColumns ? (
              <a href={exportHref()}>Download</a>
            ) : (
              <span>Download</span>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
