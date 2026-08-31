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
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * NWP-101: the payments export options dialog.
 *
 * The column values below mirror EXPORT_COLUMNS in src/lib/csv.ts. They are a
 * convenience for building the request only — the server validates whatever we
 * send against its own allowlist, so an unknown value here is rejected there.
 */
const COLUMNS: { value: string; label: string }[] = [
  { value: "id", label: "Payment ID" },
  { value: "created_at", label: "Created" },
  { value: "merchant", label: "Merchant" },
  { value: "description", label: "Description" },
  { value: "status", label: "Status" },
  { value: "method", label: "Method" },
  { value: "card_brand", label: "Card brand" },
  { value: "last4", label: "Card last four" },
  { value: "amount", label: "Amount" },
  { value: "currency", label: "Currency" },
]

/** Card last-four is off by default — see NWP-101. Everything else on. */
const DEFAULT_SELECTED = COLUMNS.map((c) => c.value).filter((v) => v !== "last4")

type Scope = "current" | "all"

export function ExportDialog({
  params,
  currentCount,
  allCount,
}: {
  /** The active payments filter, as query params. */
  params: Record<string, string>
  currentCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTED)
  const [scope, setScope] = useState<Scope>("current")

  const rowCount = scope === "all" ? allCount : currentCount

  const toggle = (value: string, checked: boolean) =>
    setSelected((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value),
    )

  // Send columns in canonical order so the file matches the server contract.
  const orderedColumns = COLUMNS.map((c) => c.value).filter((v) =>
    selected.includes(v),
  )
  const nothingSelected = orderedColumns.length === 0

  const query = new URLSearchParams(params)
  query.set("scope", scope)
  query.set("columns", orderedColumns.join(","))
  const href = `/api/payments/export?${query.toString()}`

  return (
    <Dialog>
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
            Choose the columns and the range. Card last four is off by default.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {COLUMNS.map((column) => {
                const id = `export-col-${column.value}`
                return (
                  <label
                    key={column.value}
                    htmlFor={id}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <Checkbox
                      id={id}
                      checked={selected.includes(column.value)}
                      onChange={(e) => toggle(column.value, e.target.checked)}
                    />
                    {column.label}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Range
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="current"
                checked={scope === "current"}
                onChange={() => setScope("current")}
                className="size-4 accent-blue-500"
              />
              Current filter
              <span className="text-gray-500">
                · {currentCount.toLocaleString()} payments
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 accent-blue-500"
              />
              All payments
              <span className="text-gray-500">
                · {allCount.toLocaleString()} payments
              </span>
            </label>
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <p className="mr-auto self-center text-sm text-gray-500">
            {nothingSelected
              ? "Select at least one column"
              : `${rowCount.toLocaleString()} rows · ${orderedColumns.length} columns`}
          </p>
          {nothingSelected ? (
            <Button disabled className="gap-2">
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download
            </Button>
          ) : (
            <Button asChild className="gap-2">
              <a href={href} download>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
