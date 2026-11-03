"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useEffect, useState } from "react"

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

type Counts = { filtered: number; all: number }

/**
 * Options for the payments export (NWP-101). The dialog only builds the URL;
 * the route handler validates columns and scope and runs the query builder,
 * and the row counts come from GET /api/payments so they match the file.
 */
export function ExportDialog({ query }: { query: string }) {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filtered")
  const [counts, setCounts] = useState<Counts | null>(null)
  const [countFailed, setCountFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const total = (search: string) =>
      fetch(`/api/payments?${search}`, { signal: controller.signal }).then(
        (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return response.json() as Promise<{ total: number }>
        },
      )

    setCounts(null)
    setCountFailed(false)
    Promise.all([total(query), total("")])
      .then(([filtered, all]) =>
        setCounts({ filtered: filtered.total, all: all.total }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setCountFailed(true)
      })
    return () => controller.abort()
  }, [open, query])

  const toggle = (column: ExportColumn, checked: boolean) =>
    setColumns((current) =>
      EXPORT_COLUMNS.filter((c) =>
        c === column ? checked : current.includes(c),
      ),
    )

  const params = new URLSearchParams(scope === "filtered" ? query : "")
  params.set("scope", scope)
  params.set("columns", columns.join(","))
  const href = `/api/payments/export?${params.toString()}`
  const canDownload = columns.length > 0

  const rowCount = counts?.[scope]

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
            Choose what goes in the CSV. Card last four is off by default
            because these files often go to merchants.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Scope
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {(
              [
                ["filtered", "Current filter"],
                ["all", "All payments"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="radio"
                  name="export-scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className="size-4 accent-blue-500"
                />
                {label}
                <span className="tabular-nums text-gray-500">
                  {counts ? `${counts[value].toLocaleString()} rows` : ""}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Columns
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  name="export-columns"
                  value={column}
                  checked={columns.includes(column)}
                  onChange={(event) => toggle(column, event.target.checked)}
                  className="size-4 rounded accent-blue-500"
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </div>
        </fieldset>

        <p
          className="mt-6 text-sm text-gray-500"
          role="status"
          aria-live="polite"
        >
          {!canDownload
            ? "Choose at least one column to export."
            : countFailed
              ? "Couldn't load the row count. The download still includes every matching payment."
              : rowCount === undefined
                ? "Counting rows…"
                : `${rowCount.toLocaleString()} ${rowCount === 1 ? "payment" : "payments"} will be exported.`}
        </p>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          {canDownload ? (
            <Button asChild className="gap-2">
              <a href={href} onClick={() => setOpen(false)}>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download CSV
              </a>
            </Button>
          ) : (
            <Button disabled className="gap-2">
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download CSV
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
