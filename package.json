import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
export async function GET() {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
export async function POST(req: NextRequest) {
  const { opening_cash } = await req.json()
  const { data, error } = await supabase.from('settings').upsert({ id: 1, opening_cash }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
