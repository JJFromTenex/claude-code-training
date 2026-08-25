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
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useEffect, useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at (UTC)",
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
  filterQuery,
  currentCount,
}: {
  filterQuery: string
  currentCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("current")
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [allCount, setAllCount] = useState<number | null>(null)
  const [countFailed, setCountFailed] = useState(false)

  // The current-filter count is the one the table already rendered, so it is
  // passed in rather than derived a second time. Only "all" needs asking.
  const count = scope === "current" ? currentCount : allCount

  useEffect(() => {
    if (!open || scope !== "all" || allCount !== null) return

    const controller = new AbortController()
    setCountFailed(false)

    fetch("/api/payments", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("count request failed")
        return response.json()
      })
      .then((data) => setAllCount(data.total))
      .catch((error) => {
        if (error.name !== "AbortError") setCountFailed(true)
      })

    return () => controller.abort()
  }, [open, scope, allCount])

  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : EXPORT_COLUMNS.filter(
            (name) => name === column || current.includes(name),
          ),
    )

  const downloadQuery = new URLSearchParams(
    scope === "all" ? "" : filterQuery,
  )
  downloadQuery.set("scope", scope)
  downloadQuery.set("columns", columns.join(","))

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
          <DrawerDescription>
            Choose what goes in the file before you download it.
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
                  ["current", "Current filter"],
                  ["all", "All payments"],
                ] as const
              ).map(([value, label]) => (
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
                    className="size-4 border-gray-300 text-blue-600 dark:border-gray-700"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p
              aria-live="polite"
              className="mt-2 text-sm text-gray-500 dark:text-gray-500"
            >
              {count !== null
                ? `${count.toLocaleString()} ${count === 1 ? "payment" : "payments"} will be exported`
                : countFailed
                  ? "Could not load the row count. The download still works."
                  : "Counting rows…"}
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={columns.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded border-gray-300 text-blue-600 dark:border-gray-700"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {columns.length === 0 && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <Button
            className="gap-2"
            disabled={columns.length === 0}
            asChild={columns.length > 0}
            onClick={() => setOpen(false)}
          >
            {columns.length > 0 ? (
              <a href={`/api/payments/export?${downloadQuery.toString()}`}>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download
              </a>
            ) : (
              <span>Download</span>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
