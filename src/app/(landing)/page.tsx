import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LandingPage() {
  redirect('/wasapea.html')
}
