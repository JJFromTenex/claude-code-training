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
import { Download } from "lucide-react"
import { useEffect, useId, useState } from "react"

/**
 * NWP-101: lets ops choose export columns and scope before downloading.
 * Built on the app's existing Drawer (the Radix dialog wrapper already used
 * elsewhere) rather than a new modal component.
 */

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Date",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last 4",
  amount: "Amount",
  currency: "Currency",
}

type Scope = "filter" | "all"

export function ExportDialog({ filterQuery }: { filterQuery: string }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("filter")
  const [columns, setColumns] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [counts, setCounts] = useState<{ filter: number | null; all: number | null }>({
    filter: null,
    all: null,
  })
  const idPrefix = useId()

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadCount(query: string): Promise<number | null> {
      try {
        const res = await fetch(`/api/payments?${query}`)
        if (!res.ok) return null
        const data: { total: number } = await res.json()
        return data.total
      } catch {
        return null
      }
    }

    Promise.all([loadCount(filterQuery), loadCount("status=all")]).then(
      ([filter, all]) => {
        if (!cancelled) setCounts({ filter, all })
      },
    )
    return () => {
      cancelled = true
    }
  }, [open, filterQuery])

  const toggleColumn = (column: ExportColumn) => {
    setColumns((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const orderedColumns = EXPORT_COLUMNS.filter((c) => columns.has(c))
  const canDownload = orderedColumns.length > 0

  const exportParams = new URLSearchParams()
  exportParams.set("scope", scope)
  exportParams.set("columns", orderedColumns.join(","))
  if (scope === "filter" && filterQuery) {
    for (const [key, value] of new URLSearchParams(filterQuery)) {
      exportParams.set(key, value)
    }
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
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes into the file before you download it.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name={`${idPrefix}-scope`}
                checked={scope === "filter"}
                onChange={() => setScope("filter")}
                className="size-4 accent-blue-600"
              />
              Current filter
              <span className="text-gray-500">
                {counts.filter === null ? "…" : `(${counts.filter.toLocaleString()})`}
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name={`${idPrefix}-scope`}
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 accent-blue-600"
              />
              All payments
              <span className="text-gray-500">
                {counts.all === null ? "…" : `(${counts.all.toLocaleString()})`}
              </span>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                htmlFor={`${idPrefix}-${column}`}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id={`${idPrefix}-${column}`}
                  type="checkbox"
                  checked={columns.has(column)}
                  onChange={() => toggleColumn(column)}
                  className="size-4 rounded accent-blue-600"
                />
                {COLUMN_LABELS[column]}
                {column === "last4" && (
                  <span className="text-xs text-gray-500">off by default</span>
                )}
              </label>
            ))}
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          {canDownload ? (
            <Button variant="primary" asChild>
              <a href={`/api/payments/export?${exportParams.toString()}`}>Download</a>
            </Button>
          ) : (
            <Button variant="primary" disabled>
              Download
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
