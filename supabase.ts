import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
export async function GET() {
  const { data, error } = await supabase.from('transactions').select('*, persons(name)').order('date', { ascending: false }).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabase.from('transactions').insert([body]).select('*, persons(name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select('*, persons(name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
