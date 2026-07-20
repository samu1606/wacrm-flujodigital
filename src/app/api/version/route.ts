import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    commit: '8369847',
    deployed: true,
    features: ['evolution-bridge', 'fromCharCode-key', 'evolution-inbox-check'],
  })
}
