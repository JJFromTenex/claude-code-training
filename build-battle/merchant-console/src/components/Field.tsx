/**
 * One labelled value inside a `<dl>`. Shared so the payment and card detail
 * views render a record the same way rather than each keeping a copy.
 */
export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
