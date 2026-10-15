import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { token?: string }
}) {
  const tokenQuery = searchParams?.token ? `&token=${searchParams.token}` : ''
  redirect(`/receipts/${params.id}?type=invoice${tokenQuery}`)
}
