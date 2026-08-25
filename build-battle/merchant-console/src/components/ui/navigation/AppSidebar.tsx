"use client"
import { Divider } from "@/components/Divider"
import { Input } from "@/components/Input"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarLink,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarSubLink,
} from "@/components/Sidebar"
import { cx, focusRing } from "@/lib/utils"
import { RiArrowDownSFill } from "@remixicon/react"
import { Banknote, CreditCard, House, ShieldAlert, WalletCards } from "lucide-react"
import * as React from "react"
import { Logo } from "../../../../public/Logo"
import { UserProfile } from "./UserProfile"
import { siteConfig } from "@/app/siteConfig"
import { usePathname } from "next/navigation"

const navigation = [
  {
    name: "Overview",
    href: siteConfig.baseLinks.overview,
    icon: House,
    notifications: false as const,
  },
  {
    name: "Payments",
    href: siteConfig.baseLinks.payments,
    icon: CreditCard,
    notifications: false as const,
  },
  {
    name: "Disputes",
    href: siteConfig.baseLinks.disputes,
    icon: ShieldAlert,
    notifications: false as const,
  },
  {
    name: "Payouts",
    href: siteConfig.baseLinks.payouts,
    icon: Banknote,
    notifications: false as const,
  },
  {
    name: "Cards",
    href: siteConfig.baseLinks.cards,
    icon: WalletCards,
    notifications: false as const,
  },
] as const

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  return (
    <Sidebar {...props} className="bg-gray-50 dark:bg-gray-925">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-white p-1.5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
            <Logo className="size-6 text-blue-500 dark:text-blue-500" />
          </span>
          <div>
            <span className="block text-sm font-semibold text-gray-900 dark:text-gray-50">
              Northwind Payments
            </span>
            <span className="block text-xs text-gray-900 dark:text-gray-50">
              Merchant Console
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <Input
              type="search"
              placeholder="Search payments..."
              className="[&>input]:sm:py-1.5"
            />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="pt-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarLink
                    href={item.href}
                    isActive={pathname.startsWith(item.href)}
                    icon={item.icon}
                    notifications={item.notifications}
                  >
                    {item.name}
                  </SidebarLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="border-t border-gray-200 dark:border-gray-800" />
        <UserProfile />
      </SidebarFooter>
    </Sidebar>
  )
}
