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
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import * as React from "react"

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

type Scope = "filtered" | "all"

/**
 * Export options for the payments table. The server re-validates everything
 * chosen here; this dialog is a convenience, not the enforcement. Row counts
 * come from GET /api/payments — the same query builder the export uses.
 */
export function ExportDialog({ query }: { query: string }) {
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = React.useState<Scope>("filtered")
  const [counts, setCounts] = React.useState<{
    filtered: number | null
    all: number | null
  }>({ filtered: null, all: null })
  const [countError, setCountError] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setCountError(false)
    const total = async (search: string) => {
      const response = await fetch(`/api/payments${search}`)
      if (!response.ok) throw new Error()
      return (await response.json()).total as number
    }
    Promise.all([total(query ? `?${query}` : ""), total("")])
      .then(([filtered, all]) => {
        if (!cancelled) setCounts({ filtered, all })
      })
      .catch(() => {
        if (!cancelled) setCountError(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, query])

  const toggle = (column: ExportColumn) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const none = selected.size === 0
  const rowCount = scope === "all" ? counts.all : counts.filtered

  const download = () => {
    const params = new URLSearchParams(query)
    params.set("scope", scope)
    params.set(
      "columns",
      EXPORT_COLUMNS.filter((column) => selected.has(column)).join(","),
    )
    window.location.assign(`/api/payments/export?${params.toString()}`)
    setOpen(false)
  }

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
            Choose what goes in the file. Card last four stays out unless you
            put it in.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filtered", "Current filter", counts.filtered],
                  ["all", "All payments", counts.all],
                ] as const
              ).map(([value, label, count]) => (
                <label
                  key={value}
                  className="flex items-center gap-2.5 text-sm text-gray-900 dark:text-gray-50"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                  />
                  {label}
                  <span className="tabular-nums text-gray-500">
                    {count === null
                      ? countError
                        ? ""
                        : "counting…"
                      : `${count.toLocaleString()} rows`}
                  </span>
                </label>
              ))}
            </div>
            {countError && (
              <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-500">
                Could not fetch row counts. The export itself will still work.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2.5 text-sm text-gray-900 dark:text-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Files sent to merchants should not include the card last four —
              it is off by default.
            </p>
            {none && (
              <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-500">
                Pick at least one column to export.
              </p>
            )}
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" type="button">
              Cancel
            </Button>
          </DrawerClose>
          <Button onClick={download} disabled={none} className="gap-2">
            <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
            Download
            {rowCount !== null && !none && (
              <span className="tabular-nums">
                ({rowCount.toLocaleString()})
              </span>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
