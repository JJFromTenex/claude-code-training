import { Divider } from "@/components/Divider"
import { DetailField } from "@/components/ui/DetailField"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { merchantById } from "@/data/merchants"
import {
  disputeForPayment,
  paymentById,
  refundsForPayment,
} from "@/data/queries"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function PaymentDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payment = paymentById(id)
  if (!payment) notFound()

  const merchant = merchantById(payment.merchantId)!
  const refunds = refundsForPayment(payment.id)
  const dispute = disputeForPayment(payment.id)
  const refunded = refunds.reduce((sum, refund) => sum + refund.amount, 0)

  const timeline = [
    { label: "Payment created", at: payment.createdAt },
    ...(payment.status !== "failed" && payment.status !== "authorized"
      ? [{ label: "Captured", at: payment.createdAt }]
      : []),
    ...refunds.map((refund) => ({
      label: `Refunded ${formatMoney(refund.amount, refund.currency)}`,
      at: refund.createdAt,
    })),
    ...(dispute ? [{ label: `Dispute opened · ${dispute.reasonCode}`, at: dispute.openedAt }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at))

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/payments"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All payments
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(payment.amount, payment.currency)}
        </h1>
        <span className="text-sm text-gray-500">{payment.currency}</span>
        <StatusBadge status={payment.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">{payment.id}</p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </DetailField>
        <DetailField label="Description">{payment.description}</DetailField>
        <DetailField label="Method">
          {payment.method === "card"
            ? `${payment.cardBrand} •••• ${payment.last4}`
            : payment.method.replace("_", " ")}
        </DetailField>
        <DetailField label="Created (UTC)">
          <span className="font-mono text-sm">{payment.createdAt}</span>
        </DetailField>
        <DetailField label={`Created (${merchant.timezone})`}>
          {formatInZone(payment.createdAt, merchant.timezone)}
        </DetailField>
        <DetailField label="Refunded">
          {refunded > 0 ? formatMoney(refunded, payment.currency) : "—"}
        </DetailField>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Timeline
      </h2>
      <ol className="mt-4 space-y-4">
        {timeline.map((entry, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {entry.label}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(entry.at, merchant.timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {dispute && (
        <>
          <Divider />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Dispute
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
            <DetailField label="Reason">{dispute.reasonCode}</DetailField>
            <DetailField label="Status">
              <StatusBadge status={dispute.status} />
            </DetailField>
            <DetailField label="Evidence due">
              {formatInZone(dispute.evidenceDueAt, merchant.timezone)}
            </DetailField>
          </dl>
        </>
      )}
    </div>
  )
}
