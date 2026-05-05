import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
export async function GET() {
  const { data, error } = await supabase.from('persons').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
export async function POST(req: NextRequest) {
  const { name } = await req.json()
  const { data, error } = await supabase.from('persons').insert([{ name: name.toUpperCase().trim() }]).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await supabase.from('persons').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
