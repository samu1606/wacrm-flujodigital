import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ plan: string }>
}) {
  const { plan } = await params

  // Validate plan
  const validPlans = ['emprendedor', 'pro', 'business']
  if (!validPlans.includes(plan)) {
    redirect('/wasapea.html#precios')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/signup?plan=${plan}`)
  }

  redirect(`/settings?tab=subscription&checkout=${plan}`)
}
