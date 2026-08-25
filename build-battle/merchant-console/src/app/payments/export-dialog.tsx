"use client"

import { Button } from "@/components/Button"
import { Checkbox } from "@/components/Checkbox"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { RadioGroup, RadioGroupItem } from "@/components/RadioGroup"
import { ExportScope } from "@/data/types"
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

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

/**
 * Export options for the payments table (NWP-101).
 *
 * The file is built by `GET /api/payments/export`, not here: the table is
 * paginated, so anything assembled in the browser would export the current
 * page and call it the whole set. This component only decides the query
 * string. The server re-validates every column name it is given.
 */
export function ExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  /** The filters currently applied to the table, as a query string. */
  query: string
  filteredCount: number
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filter")

  /**
   * Reset on open, so the card last four is off by default every time the
   * dialog is opened rather than only the first time. Ops reaching for Export
   * twice in a row should not inherit the previous file's column set.
   */
  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setColumns([...DEFAULT_EXPORT_COLUMNS])
      setScope("filter")
    }
  }

  const rowCount = scope === "all" ? totalCount : filteredCount
  const nothingSelected = columns.length === 0

  const toggle = (column: ExportColumn, checked: boolean) => {
    setColumns((current) =>
      checked
        ? // Keep allowlist order rather than click order, so the file's columns
          // do not depend on which box ops ticked first.
          EXPORT_COLUMNS.filter(
            (name) => name === column || current.includes(name),
          )
        : current.filter((name) => name !== column),
    )
  }

  const href = () => {
    const params = new URLSearchParams(query)
    params.delete("columns")
    params.delete("page")
    columns.forEach((column) => params.append("columns", column))
    params.set("scope", scope)
    return `/api/payments/export?${params.toString()}`
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
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
          <p className="text-sm text-gray-500">
            Choose what goes in the file before you download it.
          </p>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <RadioGroup
              value={scope}
              onValueChange={(next) => setScope(next as ExportScope)}
              className="mt-3"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="filter" id="scope-filter" />
                <label
                  htmlFor="scope-filter"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Current filter
                  <span className="ml-1 text-gray-500">
                    ({filteredCount.toLocaleString()} payments)
                  </span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="all" id="scope-all" />
                <label
                  htmlFor="scope-all"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  All payments
                  <span className="ml-1 text-gray-500">
                    ({totalCount.toLocaleString()} payments)
                  </span>
                </label>
              </div>
            </RadioGroup>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <div key={column} className="flex items-center gap-3">
                  <Checkbox
                    id={`column-${column}`}
                    checked={columns.includes(column)}
                    onCheckedChange={(checked) =>
                      toggle(column, checked === true)
                    }
                  />
                  <label
                    htmlFor={`column-${column}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {COLUMN_LABELS[column]}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <p
            className="flex-1 self-center text-sm text-gray-500"
            aria-live="polite"
          >
            {nothingSelected
              ? "Select at least one column."
              : `${rowCount.toLocaleString()} rows · ${columns.length} columns`}
          </p>
          <Button
            variant="primary"
            className="gap-2"
            disabled={nothingSelected}
            asChild={!nothingSelected}
          >
            {nothingSelected ? (
              <span>Download</span>
            ) : (
              <a href={href()} download>
                <Download
                  className="-ml-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                Download
              </a>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
