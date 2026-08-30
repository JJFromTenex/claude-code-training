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
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { CardCategory, Currency } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

const CATEGORIES: { value: CardCategory; label: string }[] = [
  { value: "ads", label: "Ads" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "contractor_tools", label: "Contractor tools" },
  { value: "travel", label: "Travel" },
  { value: "office", label: "Office" },
]

/** Groups a full card number into 4s for the one-time reveal screen. */
function groupInFours(number: string): string {
  return number.match(/.{1,4}/g)?.join(" ") ?? number
}

export function IssueCardDrawer({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [requestId, setRequestId] = useState("")

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limitInput, setLimitInput] = useState("")
  const [category, setCategory] = useState<CardCategory | "">("")

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<string | null>(null)
  const [fullNumber, setFullNumber] = useState<string | null>(null)

  const selectedMerchant = merchants.find((m) => m.id === merchantId) ?? null

  function resetForm() {
    setNickname("")
    setMerchantId("")
    setLimitInput("")
    setCategory("")
    setError(null)
    setLimitError(null)
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      // A fresh requestId per open — reused across retries of the same
      // submission, regenerated only after success (i.e. on the next open)
      // or here, when the drawer reopens.
      setRequestId(crypto.randomUUID())
      resetForm()
      setFullNumber(null)
    } else if (fullNumber) {
      // The full number never survives past this screen closing.
      setFullNumber(null)
      router.refresh()
    }
    setOpen(next)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const trimmedNickname = nickname.trim()
    if (!trimmedNickname) {
      setError("Nickname is required")
      return
    }
    if (!merchantId || !selectedMerchant) {
      setError("Select a merchant")
      return
    }
    if (!category) {
      setError("Select a category")
      return
    }

    const spendLimit = parseAmountToMinorUnits(limitInput)
    if (spendLimit === null) {
      setLimitError("Enter a valid amount, like 250 or 250.00")
      return
    }
    setLimitError(null)

    setPending(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: trimmedNickname,
          merchantId,
          spendLimit,
          currency: selectedMerchant.currency,
          category,
          requestId,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.message ?? "Something went wrong. Try again.")
        return
      }
      setFullNumber(data.fullNumber as string)
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button>Issue card</Button>
      </DrawerTrigger>
      <DrawerContent aria-describedby={undefined}>
        {fullNumber ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <p className="font-mono text-2xl tracking-widest text-gray-900 dark:text-gray-50">
                {groupInFours(fullNumber)}
              </p>
              <p className="max-w-xs text-sm text-gray-500">
                This is the only time the full number is shown.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button className="w-full sm:w-fit">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
              <DrawerDescription>
                Creates a virtual card on the 4242 test BIN.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-400"
                >
                  {error}
                </p>
              )}

              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  className="mt-2"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={60}
                  placeholder="e.g. Ad spend – Q3"
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="card-merchant" className="mt-2">
                    <SelectValue placeholder="Select a merchant" />
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

              <div>
                <label
                  htmlFor="card-limit"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Limit{selectedMerchant ? ` (${selectedMerchant.currency})` : ""}
                </label>
                <Input
                  id="card-limit"
                  className="mt-2"
                  value={limitInput}
                  onChange={(event) => setLimitInput(event.target.value)}
                  placeholder="250.00"
                  inputMode="decimal"
                  hasError={Boolean(limitError)}
                  aria-invalid={Boolean(limitError)}
                />
                {limitError ? (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {limitError}
                  </p>
                ) : !selectedMerchant ? (
                  <p className="mt-1 text-sm text-gray-500">
                    Select a merchant to set the currency.
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as CardCategory)}
                >
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary" type="button" className="w-full sm:w-fit">
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                type="submit"
                className="w-full sm:w-fit"
                disabled={pending}
                isLoading={pending}
              >
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
