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
import { Skeleton } from "@/components/Skeleton"
import { EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useEffect, useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at",
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

type CurrentFilters = { status: string; merchantId: string; search: string }

function scopedFilterParams(scope: Scope, filters: CurrentFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (scope === "all") return params
  if (filters.status && filters.status !== "all") params.set("status", filters.status)
  if (filters.merchantId) params.set("merchantId", filters.merchantId)
  if (filters.search) params.set("search", filters.search)
  return params
}

export function ExportDialog({ filters }: { filters: CurrentFilters }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("current")
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    new Set(EXPORT_COLUMNS.filter((c) => c !== "last4")),
  )
  const [count, setCount] = useState<number | null>(null)
  const [countError, setCountError] = useState(false)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setCount(null)
    setCountError(false)

    fetch(`/api/payments?${scopedFilterParams(scope, filters).toString()}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setCount(data.total))
      .catch((error) => {
        if (error.name !== "AbortError") setCountError(true)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope, filters.status, filters.merchantId, filters.search])

  const toggleColumn = (column: ExportColumn) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const orderedSelected = EXPORT_COLUMNS.filter((c) => selected.has(c))

  const exportUrl = (() => {
    const params = scopedFilterParams(scope, filters)
    params.set("columns", orderedSelected.join(","))
    params.set("scope", scope)
    return `/api/payments/export?${params.toString()}`
  })()

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
            Choose which columns to include and how much of the table to export.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                htmlFor={`export-column-${column}`}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id={`export-column-${column}`}
                  type="checkbox"
                  checked={selected.has(column)}
                  onChange={() => toggleColumn(column)}
                  className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label
              htmlFor="export-scope-current"
              className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <input
                id="export-scope-current"
                type="radio"
                name="export-scope"
                checked={scope === "current"}
                onChange={() => setScope("current")}
                className="size-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
              />
              Current filter
            </label>
            <label
              htmlFor="export-scope-all"
              className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <input
                id="export-scope-all"
                type="radio"
                name="export-scope"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
              />
              All payments
            </label>
          </fieldset>

          <div aria-live="polite" className="text-sm text-gray-500">
            {countError ? (
              "Row count unavailable"
            ) : count === null ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              `${count.toLocaleString()} payments`
            )}
          </div>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {orderedSelected.length === 0 ? (
            <Button disabled>Download</Button>
          ) : (
            <Button asChild>
              <a href={exportUrl}>Download</a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
