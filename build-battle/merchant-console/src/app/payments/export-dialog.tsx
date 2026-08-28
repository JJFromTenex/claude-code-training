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
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  EXPORT_COLUMN_LABELS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const SCOPES: { value: ExportScope; label: string }[] = [
  { value: "filtered", label: "Current filter" },
  { value: "all", label: "All payments" },
]

export function PaymentsExportDialog({
  filteredCount,
  allCount,
  current,
}: {
  filteredCount: number
  allCount: number
  current: { status: string; merchantId: string; search: string }
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filtered")
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  const rowCount = scope === "all" ? allCount : filteredCount

  /** Kept in table order, so the file reads the same however the boxes were clicked. */
  const toggle = (column: ExportColumn) => {
    setSelected((previous) =>
      previous.includes(column)
        ? previous.filter((each) => each !== column)
        : EXPORT_COLUMNS.filter(
            (each) => previous.includes(each) || each === column,
          ),
    )
  }

  const href = () => {
    const next = new URLSearchParams()
    if (scope === "all") {
      next.set("scope", "all")
    } else {
      if (current.status && current.status !== "all") {
        next.set("status", current.status)
      }
      if (current.merchantId) next.set("merchantId", current.merchantId)
      if (current.search) next.set("search", current.search)
    }
    next.set("columns", selected.join(","))
    return `/api/payments/export?${next.toString()}`
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

      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            {SCOPES.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  id={`scope-${option.value}`}
                  name="scope"
                  className="size-4 shrink-0 accent-blue-500"
                  checked={scope === option.value}
                  onChange={() => setScope(option.value)}
                />
                <label
                  htmlFor={`scope-${option.value}`}
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  {option.label}
                </label>
              </div>
            ))}
            <p className="text-sm text-gray-500" aria-live="polite">
              {rowCount.toLocaleString()} payments will be exported
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {EXPORT_COLUMNS.map((column) => (
              <div key={column} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`column-${column}`}
                  className="size-4 shrink-0 accent-blue-500"
                  checked={selected.includes(column)}
                  onChange={() => toggle(column)}
                />
                <label
                  htmlFor={`column-${column}`}
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  {EXPORT_COLUMN_LABELS[column]}
                </label>
              </div>
            ))}
            {selected.length === 0 && (
              <p className="text-sm text-gray-500">
                Pick at least one column to download a file.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          <Button
            className="gap-2 py-1.5"
            disabled={selected.length === 0}
            asChild={selected.length > 0}
            onClick={() => setOpen(false)}
          >
            {selected.length > 0 ? (
              <a href={href()}>
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
