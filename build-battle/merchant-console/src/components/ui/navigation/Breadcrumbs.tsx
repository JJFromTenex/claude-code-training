"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const LABELS: Record<string, string> = {
  overview: "Overview",
  payments: "Payments",
  disputes: "Disputes",
  payouts: "Payouts",
  cards: "Cards",
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  const crumbs = segments.map((segment, index) => ({
    label: LABELS[segment] ?? segment,
    href: `/${segments.slice(0, index + 1).join("/")}`,
    last: index === segments.length - 1,
  }))

  return (
    <nav aria-label="Breadcrumb" className="ml-2">
      <ol role="list" className="flex items-center space-x-3 text-sm">
        <li className="flex">
          <Link
            href="/overview"
            className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 hover:dark:text-gray-300"
          >
            Northwind
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center space-x-3">
            <ChevronRight
              className="size-4 shrink-0 text-gray-600 dark:text-gray-400"
              aria-hidden="true"
            />
            <Link
              href={crumb.href}
              aria-current={crumb.last ? "page" : undefined}
              className={
                crumb.last
                  ? "text-gray-900 dark:text-gray-50"
                  : "text-gray-500 transition hover:text-gray-700 dark:text-gray-400 hover:dark:text-gray-300"
              }
            >
              {crumb.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}
