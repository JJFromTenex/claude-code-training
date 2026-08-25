"use client"

import { Button } from "@/components/Button"
import { Checkbox } from "@/components/Checkbox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useEffect, useState } from "react"

type Scope = "filtered" | "all"

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

/**
 * The dialog behind the Export button on /payments. Lets ops choose which
 * columns ship (card last-four off by default) and whether the file covers
 * the active filter or every payment, with the row count visible before
 * download. Everything here is a client-side convenience over the same
 * allowlisted query params the export route validates itself — nothing
 * here is trusted on the server side.
 */
export function ExportDialog({ filterQuery }: { filterQuery: string }) {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<Scope>("filtered")
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setCount(null)

    const params = new URLSearchParams(filterQuery)
    params.set("scope", scope)

    fetch(`/api/payments?${params.toString()}`)
      .then((response) => response.json())
      .then((data: { total: number }) => {
        if (!cancelled) setCount(data.total)
      })

    return () => {
      cancelled = true
    }
  }, [open, scope, filterQuery])

  const toggleColumn = (column: ExportColumn, checked: boolean) => {
    setColumns((current) => {
      const next = new Set(current)
      if (checked) next.add(column)
      else next.delete(column)
      return next
    })
  }

  const params = new URLSearchParams(filterQuery)
  params.set("scope", scope)
  params.set("columns", EXPORT_COLUMNS.filter((column) => columns.has(column)).join(","))
  const downloadHref = `/api/payments/export?${params.toString()}`

  const noColumnsSelected = columns.size === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>
            Choose what ships in the file, then download.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  htmlFor={`export-column-${column}`}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <Checkbox
                    id={`export-column-${column}`}
                    checked={columns.has(column)}
                    onCheckedChange={(checked) => toggleColumn(column, checked)}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-3 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="export-scope"
                  className="size-4 accent-blue-500"
                  checked={scope === "filtered"}
                  onChange={() => setScope("filtered")}
                />
                Current filter
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="export-scope"
                  className="size-4 accent-blue-500"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                />
                All payments
              </label>
            </div>
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <p className="text-sm text-gray-500" aria-live="polite">
            {count === null
              ? "Counting…"
              : `${count.toLocaleString()} payment${count === 1 ? "" : "s"}`}
          </p>
          <Button disabled={noColumnsSelected} asChild={!noColumnsSelected}>
            {noColumnsSelected ? (
              <span>Download</span>
            ) : (
              <a href={downloadHref}>Download</a>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
