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
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useState } from "react"

/** What ops calls each column. The CSV header keeps the raw names. */
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

type Scope = "filtered" | "all"

export function ExportDialog({
  query,
  filteredCount,
  allCount,
}: {
  query: string
  filteredCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<Scope>("filtered")

  // Reopening resets the form, so the card last four goes back to off every
  // time rather than staying on from somebody's earlier export.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setSelected([...DEFAULT_EXPORT_COLUMNS])
      setScope("filtered")
    }
    setOpen(next)
  }

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : [...current, column],
    )

  // Emitted in the declared order, so the file does not depend on the order
  // the boxes happened to be clicked.
  const columns = EXPORT_COLUMNS.filter((column) => selected.includes(column))
  const nothingSelected = columns.length === 0
  const rowCount = scope === "all" ? allCount : filteredCount

  const params = new URLSearchParams(query)
  params.delete("page") // an export is every row, never one page of them
  params.set("columns", columns.join(","))
  params.set("scope", scope)
  const href = `/api/payments/export?${params.toString()}`

  const scopeOptions = [
    { value: "filtered", label: "Current filter", count: filteredCount },
    { value: "all", label: "All payments", count: allCount },
  ] as const

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
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
          <DrawerTitle>Export options</DrawerTitle>
          <DrawerDescription className="text-sm">
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <div key={column} className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id={`export-column-${column}`}
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className={cx(
                      "mt-0.5 size-4 shrink-0 rounded accent-blue-500",
                      "border-gray-300 dark:border-gray-700",
                      focusRing,
                    )}
                  />
                  <label
                    htmlFor={`export-column-${column}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {COLUMN_LABELS[column]}
                    {column === "last4" && (
                      <span className="block text-xs text-gray-500 dark:text-gray-500">
                        Leave off for files going to a merchant
                      </span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="flex flex-col gap-2.5">
              {scopeOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="export-scope"
                    id={`export-scope-${option.value}`}
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                    className={cx(
                      "size-4 shrink-0 accent-blue-500",
                      "border-gray-300 dark:border-gray-700",
                      focusRing,
                    )}
                  />
                  <label
                    htmlFor={`export-scope-${option.value}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {option.label}{" "}
                    <span className="tabular-nums text-gray-500 dark:text-gray-500">
                      ({option.count.toLocaleString()}{" "}
                      {option.count === 1 ? "payment" : "payments"})
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <p
            aria-live="polite"
            className="text-sm text-gray-500 dark:text-gray-500"
          >
            {nothingSelected
              ? "Select at least one column to download."
              : `${rowCount.toLocaleString()} ${
                  rowCount === 1 ? "row" : "rows"
                }, ${columns.length} ${
                  columns.length === 1 ? "column" : "columns"
                }.`}
          </p>
        </DrawerBody>

        <DrawerFooter>
          {/*
            The element swaps rather than the attribute. `disabled` on an
            anchor does nothing — it is not a valid attribute there, and
            `disabled:pointer-events-none` keys off a pseudo-class an anchor
            never matches — so the link would stay clickable. The pagination
            controls on this page do the same swap.
          */}
          {nothingSelected ? (
            <Button disabled className="gap-2">
              <Download
                className="-ml-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              Download
            </Button>
          ) : (
            <Button asChild className="gap-2">
              <a href={href} onClick={() => setOpen(false)}>
                <Download
                  className="-ml-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
