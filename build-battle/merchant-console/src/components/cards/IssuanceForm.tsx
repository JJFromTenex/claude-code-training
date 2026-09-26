"use client"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { merchants } from "@/data/merchants"
import { Currency } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"
import { useState } from "react"

interface IssuanceFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function IssuanceForm({ onSuccess, onCancel }: IssuanceFormProps) {
  const [merchantId, setMerchantId] = useState("")
  const [nickname, setNickname] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [fullNumber, setFullNumber] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side validation
    if (!merchantId.trim()) {
      setError("Please select a merchant")
      return
    }

    if (!nickname.trim()) {
      setError("Please enter a card nickname")
      return
    }

    if (!limit.trim()) {
      setError("Please enter a spend limit")
      return
    }

    const limitInMinorUnits = parseAmountToMinorUnits(limit)
    if (limitInMinorUnits === null || limitInMinorUnits <= 0) {
      setError("Please enter a valid spend limit")
      return
    }

    try {
      setLoading(true)
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId,
          nickname: nickname.trim(),
          limit: limitInMinorUnits,
          currency,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create card")
      }

      const data = await response.json()
      setFullNumber(data.fullNumber)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (success && fullNumber) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white dark:bg-gray-950 rounded-lg p-8 max-w-md w-full mx-4 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Card Created Successfully</h2>

          <div className="mb-6 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Your card number (shown once only)
            </p>
            <p className="font-mono text-lg font-bold text-green-700 dark:text-green-300 break-all">
              {fullNumber}
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Save this number securely. It will not be shown again. The card will appear in your list as •••• {fullNumber.slice(-4)}.
          </p>

          <Button onClick={onSuccess} className="w-full">
            Done
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-950 rounded-lg p-8 max-w-md w-full mx-4 shadow-lg">
        <h2 className="text-2xl font-bold mb-6">Issue New Card</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Merchant</label>
            <select
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              disabled={loading}
            >
              <option value="">Select a merchant...</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g., Q4 Ad Spend"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Spend Limit</label>
              <input
                type="text"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="e.g., 1250.50"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                disabled={loading}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Creating..." : "Create Card"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
