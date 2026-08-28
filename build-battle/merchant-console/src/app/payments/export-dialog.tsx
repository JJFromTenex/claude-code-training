"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogBody,
  DialogClose,
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

type Counts = { filtered: number | null; all: number | null; failed: boolean }

/**
 * Options for the payments export. The server decides what a valid column
 * is; this only keeps ops from asking for a file it would reject.
 */
export function ExportDialog({ query }: { query: string }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("filtered")
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [counts, setCounts] = useState<Counts>({
    filtered: null,
    all: null,
    failed: false,
  })

  // The row count comes from the list route rather than a second count path.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const total = async (search: string) => {
      const response = await fetch(`/api/payments?${search}`)
      if (!response.ok) throw new Error("count request failed")
      const body = await response.json()
      return body.total as number
    }

    Promise.all([total(query), total("")])
      .then(([filtered, all]) => {
        if (!cancelled) setCounts({ filtered, all, failed: false })
      })
      .catch(() => {
        if (!cancelled)
          setCounts({ filtered: null, all: null, failed: true })
      })

    return () => {
      cancelled = true
    }
  }, [open, query])

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : // Keep the canonical order so the file reads the way ops expects.
          EXPORT_COLUMNS.filter(
            (name) => name === column || current.includes(name),
          ),
    )

  const rowCount = scope === "all" ? counts.all : counts.filtered
  const countLabel = counts.failed
    ? "Row count unavailable"
    : rowCount === null
      ? "Counting rows…"
      : `${rowCount.toLocaleString()} ${rowCount === 1 ? "row" : "rows"}`

  const params = new URLSearchParams(scope === "all" ? "" : query)
  params.set("scope", scope)
  params.set("columns", selected.join(","))
  const href = `/api/payments/export?${params.toString()}`

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
            Choose what goes in the file before you download it.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            {(
              [
                ["filtered", "Current filter", counts.filtered],
                ["all", "All payments", counts.all],
              ] as [Scope, string, number | null][]
            ).map(([value, label, count]) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="radio"
                  name="scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className="size-4 accent-blue-500"
                />
                <span>{label}</span>
                <span className="text-gray-500 tabular-nums">
                  {counts.failed
                    ? "—"
                    : count === null
                      ? "…"
                      : count.toLocaleString()}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
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
                    className="size-4 rounded accent-blue-500"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {selected.length === 0 && (
              <p className="text-sm text-red-600 dark:text-red-500">
                Select at least one column to download a file.
              </p>
            )}
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <p className="mr-auto self-center text-sm text-gray-500 tabular-nums">
            {countLabel}
          </p>
          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>
          <Button
            className="py-1.5"
            disabled={selected.length === 0}
            asChild={selected.length > 0}
            onClick={() => setOpen(false)}
          >
            {selected.length > 0 ? (
              <a href={href} download>
                Download
              </a>
            ) : (
              <span>Download</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
