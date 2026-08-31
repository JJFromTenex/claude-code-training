"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/Dialog"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { merchants } from "@/data/merchants"
import { CreditCard } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function IssueCardDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fullNumber, setFullNumber] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    nickname: "",
    merchantId: "",
    limit: "",
    currency: "USD",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const limit = parseInt(formData.limit, 10)
      if (isNaN(limit)) {
        setError("Limit must be a number")
        setLoading(false)
        return
      }

      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: formData.nickname,
          merchantId: formData.merchantId,
          limit,
          currency: formData.currency,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to issue card")
        setLoading(false)
        return
      }

      // Show full number once
      setFullNumber(data.fullNumber)
      setFormData({ nickname: "", merchantId: "", limit: "", currency: "USD" })

      // Wait 3 seconds, then close and refresh
      setTimeout(() => {
        setOpen(false)
        setFullNumber(null)
        router.refresh()
      }, 3000)
    } catch (err) {
      setError("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (fullNumber) {
    return (
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Card Issued Successfully</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <p className="text-sm text-gray-600 dark:text-gray-400">Your card number:</p>
              <p className="font-mono text-lg font-bold text-gray-900 dark:text-gray-50">
                {fullNumber}
              </p>
              <p className="mt-2 text-xs text-gray-500">This number will not be shown again.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setFullNumber(null)} disabled>
              Closing in 3 seconds...
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2 sm:w-fit">
          <CreditCard className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue Card
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Virtual Card</DialogTitle>
          <DialogDescription>Create a new virtual card with a spending limit</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nickname
            </label>
            <Input
              type="text"
              placeholder="e.g., Marketing Team Card"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Merchant
            </label>
            <Select
              value={formData.merchantId}
              onValueChange={(value) => setFormData({ ...formData, merchantId: value })}
            >
              <option value="">Select a merchant...</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Spending Limit
            </label>
            <Input
              type="number"
              placeholder="In minor units (e.g., 25000 for $250.00)"
              value={formData.limit}
              onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
              min="1"
              max="5000000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Currency
            </label>
            <Select
              value={formData.currency}
              onValueChange={(value) => setFormData({ ...formData, currency: value })}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </Select>
          </div>

          {error && <div className="rounded bg-red-50 p-3 text-sm text-red-900">{error}</div>}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Issue Card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
