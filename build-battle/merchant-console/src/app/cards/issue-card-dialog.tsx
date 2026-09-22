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
import { CURRENCIES } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Issuing a card.
 *
 * The number comes back from `POST /api/cards` once and is held in local state
 * only while the success panel is open. Closing the drawer clears it, so
 * reopening cannot show a number issued earlier. Nothing here generates or
 * validates a number — that is the server's job.
 */
export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{
    number: string
    nickname: string
  } | null>(null)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [spendLimit, setSpendLimit] = useState("")
  const [currency, setCurrency] = useState<string>("USD")

  /** Wipes the form and, critically, the revealed number. */
  function reset() {
    setNickname("")
    setMerchantId("")
    setSpendLimit("")
    setCurrency("USD")
    setError(null)
    setIssued(null)
    setSubmitting(false)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    // The limit is sent as the string ops typed. The server converts it to
    // minor units exactly once; doing arithmetic here would be a second path.
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname, merchantId, spendLimit, currency }),
    })
    const data = await response.json()
    setSubmitting(false)

    if (!response.ok) {
      setError(data.error ?? "Could not issue the card.")
      return
    }

    setIssued({ number: data.number, nickname: data.card.nickname })
    // Re-renders the server component behind the drawer, so the new row is
    // there when the success panel closes.
    router.refresh()
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full py-1.5 sm:w-fit">Issue card</Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <p className="text-sm text-gray-500">{issued.nickname}</p>
              <p className="mt-2 font-mono text-lg tabular-nums text-gray-900 dark:text-gray-50">
                {issued.number}
              </p>
              <p className="mt-4 text-sm text-gray-500">
                After you close this, the card shows as{" "}
                <span className="font-mono">•••• {issued.number.slice(-4)}</span>{" "}
                everywhere in the console.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                The card number is generated on the server and shown once.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <div>
                <label
                  htmlFor="nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend — Meta"
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="merchantId"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="merchantId" className="mt-2">
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
                    htmlFor="spendLimit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="spendLimit"
                    name="spendLimit"
                    inputMode="decimal"
                    value={spendLimit}
                    onChange={(event) => setSpendLimit(event.target.value)}
                    placeholder="250.00"
                    className="mt-2"
                  />
                </div>
                <div className="w-28">
                  <label
                    htmlFor="currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
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
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
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
