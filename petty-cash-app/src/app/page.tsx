'use client'
import { useEffect, useState, useCallback } from 'react'
import Invoice from '@/components/Invoice'

type Person = { id: string; name: string }
type Transaction = {
  id: string
  date: string
  description: string
  person_id: string | null
  persons: { name: string } | null
  category: string
  given_out: number
  spent_by_person: number
  returned: number
  settled: boolean
}
type Settings = { opening_cash: number }

// ── Form has its own type so boolean settled doesn't conflict ──
type TxForm = {
  date: string
  description: string
  person_id: string
  category: string
  given_out: string
  spent_by_person: string
  returned: string
  settled: boolean
}

const CATEGORIES = ['General', 'Transport', 'Customs & Clearance', 'Office Supplies', 'Utilities', 'Courier / Shipping', 'Food & Refreshments', 'Maintenance', 'Other']
const fmt = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = (): TxForm => ({ date: today(), description: '', person_id: '', category: 'General', given_out: '', spent_by_person: '', returned: '', settled: false })

// ── PRO EXCEL EXPORT ──────────────────────────────────────────
function exportProExcel(transactions: Transaction[], persons: Person[], openingCash: number, filterPerson: string, filterCat: string, filterStatus: string) {
  const filtered = transactions.filter(tx => {
    if (filterPerson && tx.person_id !== filterPerson) return false
    if (filterCat && (tx.category || 'General') !== filterCat) return false
    if (filterStatus === 'settled' && !tx.settled) return false
    if (filterStatus === 'outstanding' && tx.settled) return false
    return true
  })

  const totalGivenAll = transactions.reduce((s, t) => s + (t.given_out || 0), 0)
  const totalReturnedAll = transactions.reduce((s, t) => s + (t.returned || 0), 0)
  const cashInHand = openingCash - totalGivenAll + totalReturnedAll

  const lines: string[] = []
  const row = (cols: string[]) => lines.push(cols.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
  const blank = () => lines.push('')
  const sep = (title: string) => { blank(); row([`── ${title} ──`, '', '', '', '', '', '', '']) }

  row(['NABEEL — PETTY CASH MANAGER', '', '', '', '', '', '', ''])
  row([`Report Date: ${new Date().toLocaleDateString('en-AE')}`, '', '', '', '', '', '', ''])
  if (filterPerson) row([`Person Filter: ${persons.find(p => p.id === filterPerson)?.name || ''}`, '', '', '', '', '', '', ''])
  if (filterCat) row([`Category Filter: ${filterCat}`, '', '', '', '', '', '', ''])
  if (filterStatus) row([`Status Filter: ${filterStatus === 'settled' ? 'Settled only' : 'Outstanding only'}`, '', '', '', '', '', '', ''])
  blank()

  sep('SUMMARY')
  row(['Opening Cash (AED)', '', fmt(openingCash), '', '', '', '', ''])
  row(['Cash In Hand (AED)', '', fmt(cashInHand), '', '', '', '', ''])
  row(['Total Given Out (AED)', '', fmt(filtered.reduce((s, t) => s + (t.given_out || 0), 0)), '', '', '', '', ''])
  row(['Total Spent by Persons (AED)', '', fmt(filtered.reduce((s, t) => s + (t.spent_by_person || 0), 0)), '', '', '', '', ''])
  row(['Total Returned (AED)', '', fmt(filtered.reduce((s, t) => s + (t.returned || 0), 0)), '', '', '', '', ''])
  row(['Transactions Shown', '', String(filtered.length), '', '', '', '', ''])
  blank()

  sep('PER-PERSON SUMMARY')
  row(['Person', 'Total Given (AED)', 'Total Spent (AED)', 'Total Returned (AED)', 'Still Holding (AED)', 'Status', '', ''])
  persons.forEach(p => {
    const txs = filtered.filter(t => t.person_id === p.id)
    const g = txs.reduce((s, t) => s + (t.given_out || 0), 0)
    const sp = txs.reduce((s, t) => s + (t.spent_by_person || 0), 0)
    const r = txs.reduce((s, t) => s + (t.returned || 0), 0)
    const holding = g - sp - r
    if (g > 0 || sp > 0 || r > 0) row([p.name, fmt(g), fmt(sp), fmt(r), fmt(holding), holding <= 0 ? 'SETTLED' : 'OUTSTANDING', '', ''])
  })
  blank()

  sep('CATEGORY BREAKDOWN')
  row(['Category', 'Transactions', 'Total Given (AED)', 'Total Spent (AED)', 'Total Returned (AED)', '', '', ''])
  const cats = Array.from(new Set(filtered.map(t => t.category || 'General')))
  cats.forEach(cat => {
    const txs = filtered.filter(t => (t.category || 'General') === cat)
    const g = txs.reduce((s, t) => s + (t.given_out || 0), 0)
    const sp = txs.reduce((s, t) => s + (t.spent_by_person || 0), 0)
    const r = txs.reduce((s, t) => s + (t.returned || 0), 0)
    row([cat, String(txs.length), fmt(g), fmt(sp), fmt(r), '', '', ''])
  })
  blank()

  sep('TRANSACTION DETAIL')
  row(['#', 'Date', 'Description', 'Person', 'Category', 'Given Out (AED)', 'Spent By Person (AED)', 'Returned (AED)', 'Balance Effect (AED)', 'Status'])
  let rowNum = 1
  const allSorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  allSorted.forEach(tx => {
    if (!filtered.find(f => f.id === tx.id)) return
    const effect = -(tx.given_out || 0) + (tx.returned || 0)
    row([String(rowNum++), tx.date, tx.description, tx.persons?.name || '—', tx.category || 'General',
      tx.given_out > 0 ? fmt(tx.given_out) : '', tx.spent_by_person > 0 ? fmt(tx.spent_by_person) : '',
      tx.returned > 0 ? fmt(tx.returned) : '', fmt(effect), tx.settled ? 'SETTLED' : 'OUTSTANDING'])
  })

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const label = filterPerson ? (persons.find(p => p.id === filterPerson)?.name || 'filtered') : 'all'
  a.download = `nabeel-cash-${label}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [persons, setPersons] = useState<Person[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [settings, setSettings] = useState<Settings>({ opening_cash: 0 })
  const [view, setView] = useState<'dashboard' | 'transactions' | 'persons'>('dashboard')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [newPerson, setNewPerson] = useState('')
  const [form, setForm] = useState<TxForm>(emptyForm())
  const [openingInput, setOpeningInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [invoiceTx, setInvoiceTx] = useState<Transaction | null>(null)
  const [filterPerson, setFilterPerson] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [p, t, s] = await Promise.all([
      fetch('/api/persons').then(r => r.json()),
      fetch('/api/transactions').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ])
    setPersons(Array.isArray(p) ? p : [])
    setTransactions(Array.isArray(t) ? t : [])
    setSettings(s && s.opening_cash !== undefined ? s : { opening_cash: 0 })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const totalGivenOut = transactions.reduce((s, t) => s + (t.given_out || 0), 0)
  const totalReturned = transactions.reduce((s, t) => s + (t.returned || 0), 0)
  const cashInHand = settings.opening_cash - totalGivenOut + totalReturned

  const personStats = persons.map(p => {
    const txs = transactions.filter(t => t.person_id === p.id)
    const given = txs.reduce((s, t) => s + (t.given_out || 0), 0)
    const spent = txs.reduce((s, t) => s + (t.spent_by_person || 0), 0)
    const returned = txs.reduce((s, t) => s + (t.returned || 0), 0)
    return { ...p, given, spent, returned, holding: given - spent - returned }
  })

  const filtered = transactions.filter(tx => {
    if (filterPerson && tx.person_id !== filterPerson) return false
    if (filterCat && (tx.category || 'General') !== filterCat) return false
    if (filterStatus === 'settled' && !tx.settled) return false
    if (filterStatus === 'outstanding' && tx.settled) return false
    return true
  })

  const submitTx = async () => {
    if (!form.description.trim()) { toast('Please enter a description'); return }
    setSaving(true)
    const payload = {
      date: form.date || today(),
      description: form.description.trim(),
      person_id: form.person_id || null,
      category: form.category || 'General',
      given_out: parseFloat(form.given_out) || 0,
      spent_by_person: parseFloat(form.spent_by_person) || 0,
      returned: parseFloat(form.returned) || 0,
      settled: form.settled,
    }
    if (editTx) {
      await fetch('/api/transactions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editTx.id, ...payload }) })
      toast('Updated ✓')
    } else {
      await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      toast('Added ✓')
    }
    setForm(emptyForm()); setShowForm(false); setEditTx(null); setSaving(false); load()
  }

  const toggleSettled = async (tx: Transaction) => {
    await fetch('/api/transactions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tx.id, settled: !tx.settled }) })
    toast(tx.settled ? 'Marked outstanding' : 'Marked settled ✓'); load()
  }

  const deleteTx = async (id: string) => {
    if (!confirm('Delete this transaction?')) return
    await fetch('/api/transactions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); load()
  }

  const openEdit = (tx: Transaction) => {
    setEditTx(tx)
    setForm({
      date: tx.date, description: tx.description, person_id: tx.person_id || '',
      category: tx.category || 'General',
      given_out: tx.given_out ? String(tx.given_out) : '',
      spent_by_person: tx.spent_by_person ? String(tx.spent_by_person) : '',
      returned: tx.returned ? String(tx.returned) : '',
      settled: tx.settled || false,
    })
    setShowForm(true)
  }

  const addPerson = async () => {
    if (!newPerson.trim()) return
    await fetch('/api/persons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newPerson }) })
    setNewPerson(''); toast('Person added ✓'); load()
  }

  const deletePerson = async (id: string) => {
    if (!confirm('Delete this person?')) return
    await fetch('/api/persons', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); load()
  }

  const saveOpening = async () => {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opening_cash: parseFloat(openingInput) || 0 }) })
    setShowSettings(false); toast('Saved ✓'); load()
  }

  // ── Style helpers ──────────────────────────────────────────
  const navBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '13px 4px', background: 'none', border: 'none',
    borderBottom: active ? '3px solid #c9a84c' : '3px solid transparent',
    color: active ? '#c9a84c' : 'rgba(255,255,255,0.5)',
    fontWeight: active ? 600 : 400, fontSize: 13, borderRadius: 0, cursor: 'pointer',
  })
  const badge = (settled: boolean): React.CSSProperties => ({
    fontSize: 11, padding: '3px 9px', borderRadius: 20,
    background: settled ? '#d5f5e3' : '#fef3cd',
    color: settled ? '#1a7a3c' : '#856404', fontWeight: 600,
  })
  const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
    background: bg, color, border: 'none', borderRadius: 8,
    padding: '10px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  })
  const btnSm = (bg: string, color = '#fff'): React.CSSProperties => ({
    background: bg, color, border: 'none', borderRadius: 6,
    padding: '5px 11px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
  })
  const inputStyle: React.CSSProperties = {
    border: '1px solid #e8e0d0', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, width: '100%', outline: 'none', fontFamily: 'inherit', background: '#fff', color: '#2d3a2d',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: '#8a7a5a', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5,
  }
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e8e0d0', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }
  const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }
  const sheet: React.CSSProperties = { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 700, padding: '24px 20px 36px', maxHeight: '92vh', overflowY: 'auto' }
  const saveBtn: React.CSSProperties = { background: '#1a2a1a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontWeight: 700, fontSize: 15, width: '100%', cursor: 'pointer' }
  const filterSelect: React.CSSProperties = { border: '1px solid #e8e0d0', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff', color: '#2d3a2d', cursor: 'pointer', width: '100%' }
  const catColor: Record<string, { bg: string; color: string }> = {
    'General': { bg: '#f0f0f0', color: '#555' }, 'Transport': { bg: '#e8f4ff', color: '#1a5f8a' },
    'Customs & Clearance': { bg: '#fff0e8', color: '#8a3a1a' }, 'Office Supplies': { bg: '#f0e8ff', color: '#5a1a8a' },
    'Utilities': { bg: '#e8fff0', color: '#1a7a3c' }, 'Courier / Shipping': { bg: '#fff8e8', color: '#8a6a1a' },
    'Food & Refreshments': { bg: '#ffe8f0', color: '#8a1a4a' }, 'Maintenance': { bg: '#e8f8ff', color: '#1a5a7a' },
    'Other': { bg: '#f5f5f5', color: '#666' },
  }
  const getCatStyle = (cat: string): React.CSSProperties => ({
    fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
    background: catColor[cat]?.bg || '#f0f0f0', color: catColor[cat]?.color || '#555',
  })
  const activeFilters = [filterPerson, filterCat, filterStatus].filter(Boolean).length

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f7f4ee' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
      <div style={{ color: '#8a7a5a', fontSize: 15 }}>Loading...</div>
    </div>
  )

  return (
    <>
      {/* HEADER */}
      <div style={{ background: '#1a2a1a' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '18px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#c9a84c', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Petty Cash Manager</div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginTop: 2 }}>💰 Nabeel</div>
          </div>
          <button onClick={() => { setShowSettings(true); setOpeningInput(String(settings.opening_cash)) }}
            style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            ⚙ Settings
          </button>
        </div>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '14px 16px 0' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cash in my hand</div>
          <div style={{ color: '#c9a84c', fontSize: 38, fontWeight: 800, lineHeight: 1.2, marginTop: 4 }}>AED {fmt(cashInHand)}</div>
        </div>
        <div style={{ maxWidth: 700, margin: '14px auto 0', display: 'flex', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {(['dashboard', 'transactions', 'persons'] as const).map(v => (
            <button key={v} style={navBtn(view === v)} onClick={() => setView(v)}>
              {v === 'dashboard' ? '📊 Dashboard' : v === 'transactions' ? '📋 Transactions' : '👥 People'}
            </button>
          ))}
        </div>
      </div>

      {/* BODY */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '18px 14px 100px', background: '#f7f4ee', minHeight: 'calc(100vh - 170px)' }}>

        {/* DASHBOARD */}
        {view === 'dashboard' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Opening Cash', value: settings.opening_cash, color: '#2d4a2d' },
                { label: 'Total Given Out', value: totalGivenOut, color: '#b83232' },
                { label: 'Total Returned', value: totalReturned, color: '#1a7a3c' },
                { label: 'Net Spent', value: totalGivenOut - totalReturned, color: '#856404' },
              ].map(stat => (
                <div key={stat.label} style={{ background: '#fff', border: '1px solid #e8e0d0', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#8a7a5a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>AED {fmt(stat.value)}</div>
                </div>
              ))}
            </div>
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 4, height: 18, background: '#c9a84c', borderRadius: 2 }}></div>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#2d3a2d' }}>Money with each person</span>
              </div>
              {personStats.filter(p => p.given > 0 || p.holding !== 0).length === 0 && (
                <div style={{ color: '#8a7a5a', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No transactions yet</div>
              )}
              {personStats.filter(p => p.given > 0 || p.holding !== 0).map((p, i, arr) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid #f0ebe0' : 'none' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#2d3a2d' }}>{p.name}</span>
                      <button style={{ ...btnSm('#eef0ff', '#3d5af1'), fontSize: 11, padding: '2px 8px' }}
                        onClick={() => { setFilterPerson(p.id); setView('transactions') }}>View →</button>
                    </div>
                    <div style={{ fontSize: 12, color: '#8a7a5a', marginTop: 2 }}>Given: AED {fmt(p.given)} · Spent: AED {fmt(p.spent)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: p.holding > 0 ? '#b83232' : '#1a7a3c' }}>AED {fmt(p.holding)}</div>
                    <span style={badge(p.holding <= 0)}>{p.holding <= 0 ? '✅ Settled' : '⏳ Outstanding'}</span>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e8e0d0', paddingTop: 12, marginTop: 6, fontWeight: 700, fontSize: 14 }}>
                <span style={{ color: '#2d3a2d' }}>Total outstanding</span>
                <span style={{ color: '#b83232' }}>AED {fmt(personStats.reduce((s, p) => s + Math.max(0, p.holding), 0))}</span>
              </div>
            </div>
          </>
        )}

        {/* TRANSACTIONS */}
        {view === 'transactions' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#2d3a2d' }}>
                Transactions <span style={{ fontSize: 13, color: '#8a7a5a', fontWeight: 400 }}>({filtered.length}{filtered.length !== transactions.length ? ` of ${transactions.length}` : ''})</span>
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnSm('#2d4a2d')} onClick={() => exportProExcel(transactions, persons, settings.opening_cash, filterPerson, filterCat, filterStatus)}>⬇ Excel</button>
                <button style={btnSm('#c9a84c', '#1a1a0a')} onClick={() => { setEditTx(null); setForm(emptyForm()); setShowForm(true) }}>+ Add</button>
              </div>
            </div>

            {/* Filter bar */}
            <div style={{ background: '#fff', border: '1px solid #e8e0d0', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#8a7a5a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter</span>
                {activeFilters > 0 && <span style={{ fontSize: 11, background: '#c9a84c', color: '#1a1a0a', borderRadius: 20, padding: '1px 7px', fontWeight: 700 }}>{activeFilters}</span>}
                {activeFilters > 0 && <button onClick={() => { setFilterPerson(''); setFilterCat(''); setFilterStatus('') }} style={{ fontSize: 11, color: '#b83232', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', fontWeight: 500 }}>Clear all</button>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#8a7a5a', fontWeight: 600, marginBottom: 4 }}>Person</div>
                  <select style={filterSelect} value={filterPerson} onChange={e => setFilterPerson(e.target.value)}>
                    <option value="">All people</option>
                    {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#8a7a5a', fontWeight: 600, marginBottom: 4 }}>Category</div>
                  <select style={filterSelect} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                    <option value="">All categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#8a7a5a', fontWeight: 600, marginBottom: 4 }}>Status</div>
                  <select style={filterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">All</option>
                    <option value="outstanding">Outstanding</option>
                    <option value="settled">Settled</option>
                  </select>
                </div>
              </div>
            </div>

            {activeFilters > 0 && (
              <div style={{ background: '#fef9e7', border: '1px solid #f0d060', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: '#856404', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Filtered view active</span>
                <span style={{ fontWeight: 700 }}>AED {fmt(filtered.reduce((s, t) => s + (t.given_out || 0), 0))} given</span>
              </div>
            )}

            {filtered.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px 20px', color: '#8a7a5a' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                {activeFilters > 0 ? 'No transactions match your filters.' : 'No transactions yet. Tap + Add to start.'}
              </div>
            ) : (
              <div style={card}>
                {filtered.map((tx, i) => (
                  <div key={tx.id} style={{ padding: '12px 0', borderBottom: i < filtered.length - 1 ? '1px solid #f0ebe0' : 'none', opacity: tx.settled ? 0.75 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' as const }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: tx.settled ? '#8a7a5a' : '#2d3a2d', textDecoration: tx.settled ? 'line-through' : 'none' }}>{tx.description}</span>
                          {tx.settled && <span style={{ fontSize: 11, background: '#d5f5e3', color: '#1a7a3c', padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>Settled</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#8a7a5a', marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                          <span>{tx.date}</span>
                          {tx.persons?.name && <span>· <span style={{ color: '#2d4a2d', fontWeight: 600 }}>{tx.persons.name}</span></span>}
                          <span style={getCatStyle(tx.category || 'General')}>{tx.category || 'General'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
                        <button title={tx.settled ? 'Mark outstanding' : 'Mark settled'}
                          style={{ ...btnSm(tx.settled ? '#d5f5e3' : '#f0f0f0', tx.settled ? '#1a7a3c' : '#555'), fontSize: 14, padding: '4px 8px' }}
                          onClick={() => toggleSettled(tx)}>{tx.settled ? '✓' : '○'}</button>
                        <button style={btnSm('#fef9e7', '#856404')} onClick={() => setInvoiceTx(tx)} title="Send Invoice">📄</button>
                        <button style={btnSm('#eef0ff', '#3d5af1')} onClick={() => openEdit(tx)}>Edit</button>
                        <button style={btnSm('#fff0f0', '#b83232')} onClick={() => deleteTx(tx.id)}>Del</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' as const }}>
                      {tx.given_out > 0 && <span style={{ fontSize: 12, background: '#fff0f0', color: '#b83232', padding: '2px 9px', borderRadius: 20, fontWeight: 500 }}>Given: AED {fmt(tx.given_out)}</span>}
                      {tx.spent_by_person > 0 && <span style={{ fontSize: 12, background: '#fef3cd', color: '#856404', padding: '2px 9px', borderRadius: 20, fontWeight: 500 }}>Spent: AED {fmt(tx.spent_by_person)}</span>}
                      {tx.returned > 0 && <span style={{ fontSize: 12, background: '#d5f5e3', color: '#1a7a3c', padding: '2px 9px', borderRadius: 20, fontWeight: 500 }}>Returned: AED {fmt(tx.returned)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filtered.length > 0 && (
              <div style={{ background: '#1a2a1a', borderRadius: 10, padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                {[
                  { label: 'Given', value: filtered.reduce((s, t) => s + (t.given_out || 0), 0), color: '#ff9a9a' },
                  { label: 'Spent', value: filtered.reduce((s, t) => s + (t.spent_by_person || 0), 0), color: '#ffd97a' },
                  { label: 'Returned', value: filtered.reduce((s, t) => s + (t.returned || 0), 0), color: '#7affc0' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: s.color, marginTop: 2 }}>AED {fmt(s.value)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* PERSONS */}
        {view === 'persons' && (
          <>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#2d3a2d', marginBottom: 14 }}>Manage People</div>
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ ...lbl, marginBottom: 8 }}>Add new person</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newPerson} onChange={e => setNewPerson(e.target.value)} placeholder="Name (e.g. AHMED)" onKeyDown={e => e.key === 'Enter' && addPerson()} style={inputStyle} />
                <button style={{ ...btn('#2d4a2d'), padding: '10px 18px', whiteSpace: 'nowrap' as const }} onClick={addPerson}>Add</button>
              </div>
            </div>
            <div style={card}>
              {persons.length === 0 && <div style={{ color: '#8a7a5a', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No people added yet.</div>}
              {persons.map((p, i) => {
                const ps = personStats.find(s => s.id === p.id)
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < persons.length - 1 ? '1px solid #f0ebe0' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e8f0e8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d4a2d', fontWeight: 700, fontSize: 13 }}>
                        {p.name.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#2d3a2d' }}>{p.name}</div>
                        {ps && ps.given > 0 && <div style={{ fontSize: 12, color: '#8a7a5a' }}>Holding: AED {fmt(ps.holding)}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={btnSm('#eef0ff', '#3d5af1')} onClick={() => { setFilterPerson(p.id); setView('transactions') }}>View</button>
                      <button style={btnSm('#fff0f0', '#b83232')} onClick={() => deletePerson(p.id)}>Remove</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {showForm && (
        <div style={modalOverlay} onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditTx(null) } }}>
          <div style={sheet}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ ...lbl, marginBottom: 2 }}>Transaction</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#2d3a2d' }}>{editTx ? 'Edit' : 'New'}</div>
              </div>
              <button onClick={() => { setShowForm(false); setEditTx(null) }} style={{ background: '#f0ebe0', border: 'none', borderRadius: '50%', width: 34, height: 34, fontSize: 20, color: '#8a7a5a', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Description *</label>
              <input placeholder="e.g. Cash handover to Sameer" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Person</label>
                <select value={form.person_id} onChange={e => setForm(f => ({ ...f, person_id: e.target.value }))} style={{ ...inputStyle, background: '#fff' }}>
                  <option value="">— Select —</option>
                  {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputStyle, background: '#fff' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Amounts (AED) — fill only what applies</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {([
                  { label: 'Given Out', key: 'given_out' as const, bg: '#fff0f0' },
                  { label: 'Spent by Person', key: 'spent_by_person' as const, bg: '#fef9e7' },
                  { label: 'Returned', key: 'returned' as const, bg: '#eafaf1' },
                ]).map(f => (
                  <div key={f.key} style={{ background: f.bg, borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, color: '#555', fontWeight: 600, marginBottom: 5 }}>{f.label}</div>
                    <input
                      type="number" min="0" placeholder="0"
                      value={form[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, padding: '6px 8px', fontSize: 14, width: '100%', outline: 'none', fontFamily: 'inherit', background: 'rgba(255,255,255,0.75)', color: '#2d3a2d' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Settled toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, background: '#f7f4ee', borderRadius: 10, padding: '12px 14px' }}>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, settled: !f.settled }))}
                style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: form.settled ? '#1a7a3c' : '#d0ccc4', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', top: 3, left: form.settled ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}></div>
              </button>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2d3a2d' }}>Mark as Settled</div>
                <div style={{ fontSize: 12, color: '#8a7a5a' }}>Transaction is fully settled / closed</div>
              </div>
            </div>

            <button style={saveBtn} onClick={submitTx} disabled={saving}>
              {saving ? 'Saving...' : editTx ? '✓ Update Transaction' : '+ Add Transaction'}
            </button>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div style={modalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}>
          <div style={sheet}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#2d3a2d' }}>⚙ Settings</div>
              <button onClick={() => setShowSettings(false)} style={{ background: '#f0ebe0', border: 'none', borderRadius: '50%', width: 34, height: 34, fontSize: 20, color: '#8a7a5a', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Opening Cash (AED)</label>
              <input type="number" min="0" value={openingInput} onChange={e => setOpeningInput(e.target.value)} placeholder="e.g. 5453.50" style={inputStyle} />
            </div>
            <button style={saveBtn} onClick={saveOpening}>Save Changes</button>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {invoiceTx && (
        <Invoice tx={invoiceTx} allTransactions={transactions} openingCash={settings.opening_cash} onClose={() => setInvoiceTx(null)} />
      )}

      {/* TOAST */}
      {msg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#2d4a2d', color: '#fff', padding: '11px 22px', borderRadius: 24, fontSize: 14, fontWeight: 500, zIndex: 200, whiteSpace: 'nowrap' }}>
          {msg}
        </div>
      )}
    </>
  )
}
