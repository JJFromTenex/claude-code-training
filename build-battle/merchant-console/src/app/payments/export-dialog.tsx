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

/**
 * Export options for the payments table (NWP-101).
 *
 * The checkboxes and the disabled Download are a convenience — the route
 * validates the column names again before anything is written to a file. Row
 * counts arrive as props because the page has already queried for them; this
 * dialog does not fetch.
 */

const LABELS: Record<ExportColumn, string> = {
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

export function PaymentsExportDialog({
  query,
  filteredCount,
  allCount,
}: {
  /** The filters the table is showing, as a query string. */
  query: string
  filteredCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<Scope>("filtered")

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : // Keep the allowlist's order, so the file reads the same way twice.
          EXPORT_COLUMNS.filter(
            (name) => current.includes(name) || name === column,
          ),
    )

  const rowCount = scope === "all" ? allCount : filteredCount
  const canDownload = selected.length > 0

  const params = new URLSearchParams(scope === "all" ? "" : query)
  params.set("columns", selected.join(","))
  if (scope === "all") params.set("scope", "all")
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Drawer>
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
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription className="text-sm">
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            {(
              [
                ["filtered", "Current filter", filteredCount],
                ["all", "All payments", allCount],
              ] as const
            ).map(([value, label, count]) => (
              <label
                key={value}
                htmlFor={`scope-${value}`}
                className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-50"
              >
                <input
                  type="radio"
                  id={`scope-${value}`}
                  name="scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className={cx(
                    "size-4 shrink-0 accent-blue-500",
                    focusRing,
                  )}
                />
                <span>{label}</span>
                <span className="ml-auto tabular-nums text-gray-500">
                  {count.toLocaleString()}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                htmlFor={`column-${column}`}
                className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-50"
              >
                <input
                  type="checkbox"
                  id={`column-${column}`}
                  name="columns"
                  value={column}
                  checked={selected.includes(column)}
                  onChange={() => toggle(column)}
                  className={cx(
                    "size-4 shrink-0 rounded accent-blue-500",
                    focusRing,
                  )}
                />
                <span>{LABELS[column]}</span>
                {column === "last4" && (
                  <span className="ml-auto text-xs text-gray-500">
                    Off by default
                  </span>
                )}
              </label>
            ))}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <p
            className="mr-auto self-center text-sm text-gray-500"
            aria-live="polite"
          >
            {canDownload
              ? `${rowCount.toLocaleString()} ${
                  rowCount === 1 ? "payment" : "payments"
                }, ${selected.length} ${
                  selected.length === 1 ? "column" : "columns"
                }`
              : "Pick at least one column."}
          </p>
          <Button
            variant="primary"
            className="gap-2"
            disabled={!canDownload}
            asChild={canDownload}
          >
            {canDownload ? (
              <a href={href} download>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download
              </a>
            ) : (
              <span>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download
              </span>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
