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
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { Currency } from "@/data/types"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

interface Issued {
  id: string
  nickname: string
  number: string
}

const groupsOfFour = (number: string) =>
  (number.match(/.{1,4}/g) ?? [number]).join(" ")

export function IssueCardDrawer({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [spendLimit, setSpendLimit] = useState("")
  const [currency, setCurrency] = useState<Currency | "">("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<{ message: string; field?: string } | null>(
    null,
  )
  const [issued, setIssued] = useState<Issued | null>(null)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setSpendLimit("")
    setCurrency("")
    setError(null)
    setSubmitting(false)
    // The full number lives only as long as the success screen is on screen.
    setIssued(null)
  }

  const close = (next: boolean) => {
    setOpen(next)
    if (!next) {
      const sawSuccess = issued !== null
      reset()
      // Pull the new row into the server-rendered list without a reload.
      if (sawSuccess) router.refresh()
    }
  }

  /** A card settles in its merchant's currency, so picking one sets the other. */
  const chooseMerchant = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
    if (error?.field === "merchantId" || error?.field === "currency") setError(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // The limit goes over as typed. The server converts it to minor units.
        body: JSON.stringify({ nickname, merchantId, spendLimit, currency }),
      })
      const body = await response.json()

      if (!response.ok) {
        setError({ message: body.message, field: body.field })
        return
      }

      setIssued({
        id: body.card.id,
        nickname: body.card.nickname,
        number: body.number,
      })
    } catch {
      setError({ message: "Could not reach the server. Try again." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={close}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue a card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now —
                once you close this, the card shows its last four and nothing
                else.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody>
              <p className="text-sm text-gray-500">{issued.nickname}</p>
              <p className="mt-2 font-mono text-2xl tracking-wider text-gray-900 dark:text-gray-50">
                {groupsOfFour(issued.number)}
              </p>
              <Button
                variant="secondary"
                className="mt-4 py-1.5"
                onClick={() => navigator.clipboard?.writeText(issued.number)}
              >
                Copy number
              </Button>
            </DrawerBody>

            <DrawerFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, always virtual, and it needs a limit from the
                moment it exists.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend — search"
                  hasError={error?.field === "nickname"}
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={chooseMerchant}>
                  <SelectTrigger id="card-merchant" className="mt-2 w-full">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    name="spendLimit"
                    inputMode="decimal"
                    value={spendLimit}
                    onChange={(event) => setSpendLimit(event.target.value)}
                    placeholder="2500.00"
                    hasError={error?.field === "spendLimit"}
                    className="mt-2"
                  />
                </div>

                <div className="w-32">
                  <label
                    htmlFor="card-currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(next) => setCurrency(next as Currency)}
                  >
                    <SelectTrigger id="card-currency" className="mt-2 w-full">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {(["USD", "EUR", "GBP"] as const).map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-500"
                >
                  {error.message}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => close(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
