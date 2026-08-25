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
  EXPORT_COLUMN_LABELS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Filters worth carrying into the export. `page` is deliberately absent: the
 * export covers the whole result set, never the page the table is showing.
 */
const FILTER_PARAMS = ["status", "merchantId", "search", "from", "to"] as const
const ORDER_PARAMS = ["sort", "direction"] as const

export function ExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  /** The table's current filter query string. */
  query: string
  filteredCount: number
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filtered")
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  // Every open starts from the defaults. Carrying a ticked card last four
  // over from a previous export is how an unscrubbed file reaches a merchant.
  const onOpenChange = (next: boolean) => {
    if (next) {
      setScope("filtered")
      setSelected([...DEFAULT_EXPORT_COLUMNS])
    }
    setOpen(next)
  }

  const rowCount = scope === "all" ? totalCount : filteredCount
  const canDownload = selected.length > 0

  const toggle = (column: ExportColumn, checked: boolean) => {
    setSelected((current) =>
      checked
        ? EXPORT_COLUMNS.filter((c) => c === column || current.includes(c))
        : current.filter((c) => c !== column),
    )
  }

  // Only the params this scope actually honors reach the URL, so the link
  // says what the file will contain. The server validates all of it again.
  const href = () => {
    const current = new URLSearchParams(query)
    const params = new URLSearchParams()
    const carry =
      scope === "all" ? ORDER_PARAMS : [...FILTER_PARAMS, ...ORDER_PARAMS]
    for (const key of carry) {
      const value = current.get(key)
      if (value) params.set(key, value)
    }
    params.set("scope", scope)
    params.set("columns", selected.join(","))
    return `/api/payments/export?${params.toString()}`
  }

  const rows = (count: number) =>
    `${count.toLocaleString()} ${count === 1 ? "payment" : "payments"}`

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button
          variant="secondary"
          className="w-full gap-2 py-1.5 sm:w-fit"
        >
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
            Pick the columns and the rows. The card last four is left out
            unless you ask for it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <div className="mt-2 space-y-2">
              <ScopeOption
                value="filtered"
                checked={scope === "filtered"}
                onChange={setScope}
                label="Current filter"
                count={rows(filteredCount)}
              />
              <ScopeOption
                value="all"
                checked={scope === "all"}
                onChange={setScope}
                label="All payments"
                count={rows(totalCount)}
              />
            </div>
          </fieldset>

          <fieldset>
            <div className="flex items-baseline justify-between gap-2">
              <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
                Columns
              </legend>
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setSelected([...EXPORT_COLUMNS])}
                  className={cx(
                    "rounded text-blue-600 hover:underline dark:text-blue-500",
                    focusRing,
                  )}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className={cx(
                    "rounded text-blue-600 hover:underline dark:text-blue-500",
                    focusRing,
                  )}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  htmlFor={`export-column-${column}`}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    id={`export-column-${column}`}
                    name="columns"
                    value={column}
                    checked={selected.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className={cx(
                      "size-4 shrink-0 rounded border-gray-300 accent-blue-500 dark:border-gray-700",
                      focusRing,
                    )}
                  />
                  {EXPORT_COLUMN_LABELS[column]}
                  {column === "last4" && (
                    <span className="text-xs text-gray-500">
                      sensitive
                    </span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2 sm:justify-between">
          <p
            aria-live="polite"
            className="text-sm text-gray-500 max-sm:mt-2"
          >
            {canDownload
              ? `${rows(rowCount)} · ${selected.length} ${
                  selected.length === 1 ? "column" : "columns"
                }`
              : "Pick at least one column to download."}
          </p>
          <div className="flex gap-2 max-sm:w-full">
            <DrawerClose asChild>
              <Button variant="secondary" className="py-1.5 max-sm:flex-1">
                Cancel
              </Button>
            </DrawerClose>
            <Button
              className="gap-2 py-1.5 max-sm:flex-1"
              disabled={!canDownload}
              asChild={canDownload}
            >
              {canDownload ? (
                <a href={href()} onClick={() => setOpen(false)}>
                  <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                  Download CSV
                </a>
              ) : (
                <span>
                  <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                  Download CSV
                </span>
              )}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function ScopeOption({
  value,
  checked,
  onChange,
  label,
  count,
}: {
  value: ExportScope
  checked: boolean
  onChange: (scope: ExportScope) => void
  label: string
  count: string
}) {
  return (
    <label
      htmlFor={`export-scope-${value}`}
      className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
    >
      <input
        type="radio"
        id={`export-scope-${value}`}
        name="export-scope"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className={cx(
          "size-4 shrink-0 border-gray-300 accent-blue-500 dark:border-gray-700",
          focusRing,
        )}
      />
      {label}
      <span className="text-gray-500">{count}</span>
    </label>
  )
}
