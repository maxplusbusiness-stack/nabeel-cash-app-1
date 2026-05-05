'use client'
import { useRef } from 'react'

type Transaction = {
  id: string; date: string; description: string; person_id: string | null
  persons: { name: string } | null; category: string
  given_out: number; spent_by_person: number; returned: number; settled: boolean
}
interface InvoiceProps {
  tx: Transaction; allTransactions: Transaction[]; openingCash: number; onClose: () => void
}
const fmt = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Invoice({ tx, allTransactions, openingCash, onClose }: InvoiceProps) {
  const invoiceRef = useRef<HTMLDivElement>(null)
  const personTxs = allTransactions.filter(t => t.person_id === tx.person_id)
  const totalGiven = personTxs.reduce((s, t) => s + (t.given_out || 0), 0)
  const totalSpent = personTxs.reduce((s, t) => s + (t.spent_by_person || 0), 0)
  const totalReturned = personTxs.reduce((s, t) => s + (t.returned || 0), 0)
  const outstanding = totalGiven - totalSpent - totalReturned
  const totalGivenAll = allTransactions.reduce((s, t) => s + (t.given_out || 0), 0)
  const totalReturnedAll = allTransactions.reduce((s, t) => s + (t.returned || 0), 0)
  const cashInHand = openingCash - totalGivenAll + totalReturnedAll
  const invoiceNo = `INV-${tx.date.replace(/-/g, '')}-${tx.id.slice(0, 6).toUpperCase()}`
  const personName = tx.persons?.name || 'N/A'

  const buildText = () => {
    const lines = [`💰 PETTY CASH INVOICE`, `Invoice No: ${invoiceNo}`, `Date: ${tx.date}`, ``,
      `TRANSACTION DETAILS`, `Description: ${tx.description}`, `Category: ${tx.category || 'General'}`, `Person: ${personName}`, ``]
    if (tx.given_out > 0) lines.push(`Given Out: AED ${fmt(tx.given_out)}`)
    if (tx.spent_by_person > 0) lines.push(`Spent: AED ${fmt(tx.spent_by_person)}`)
    if (tx.returned > 0) lines.push(`Returned: AED ${fmt(tx.returned)}`)
    lines.push(`Status: ${tx.settled ? 'SETTLED' : 'OUTSTANDING'}`, ``,
      `ACCOUNT SUMMARY — ${personName}`, `Total Given: AED ${fmt(totalGiven)}`,
      `Total Spent: AED ${fmt(totalSpent)}`, `Total Returned: AED ${fmt(totalReturned)}`,
      `Outstanding Balance: AED ${fmt(outstanding)}`, ``,
      `OVERALL CASH POSITION`, `Cash in Hand: AED ${fmt(cashInHand)}`, ``, `Nabeel — Petty Cash Manager`)
    return lines.join('\n')
  }

  const sendWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(buildText())}`, '_blank')
  const sendEmail = () => window.open(`mailto:?subject=${encodeURIComponent(`Invoice — ${tx.description} — ${tx.date}`)}&body=${encodeURIComponent(buildText())}`, '_blank')
  const printInvoice = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>${invoiceNo}</title><meta charset="utf-8"/><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1a1a1a}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${invoiceRef.current?.innerHTML || ''}</body></html>`)
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close() }, 400)
  }
  const copyText = () => { navigator.clipboard.writeText(buildText()); alert('Copied!') }

  const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }
  const sheetStyle: React.CSSProperties = { background: '#f7f4ee', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 700, maxHeight: '95vh', overflowY: 'auto' }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={sheetStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 12px', background: '#1a2a1a', borderRadius: '20px 20px 0 0' }}>
          <div>
            <div style={{ color: '#c9a84c', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Invoice</div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{invoiceNo}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 34, height: 34, fontSize: 20, color: '#fff', cursor: 'pointer' }}>×</button>
        </div>

        <div ref={invoiceRef} style={{ padding: '0 16px 8px' }}>
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', margin: '14px 0', border: '1px solid #e0d8c8' }}>
            <div style={{ background: '#1a2a1a', padding: '22px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: '#c9a84c', fontSize: 22, fontWeight: 800 }}>💰 NABEEL</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 3 }}>Petty Cash Manager</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#c9a84c', fontSize: 13, fontWeight: 700 }}>INVOICE</div>
                  <div style={{ color: '#fff', fontSize: 12, marginTop: 2 }}>{invoiceNo}</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 }}>{tx.date}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', background: '#faf8f4', borderBottom: '1px solid #ede5d8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#8a7a5a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>To</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1a2a1a' }}>{personName}</div>
                  <div style={{ fontSize: 12, color: '#8a7a5a', marginTop: 2 }}>{tx.category || 'General'}</div>
                </div>
                <span style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, fontWeight: 700, background: tx.settled ? '#d5f5e3' : '#fff3cd', color: tx.settled ? '#1a7a3c' : '#856404', border: `1px solid ${tx.settled ? '#a8e8c0' : '#f0d060'}` }}>
                  {tx.settled ? '✅ SETTLED' : '⏳ OUTSTANDING'}
                </span>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #ede5d8' }}>
              <div style={{ fontSize: 11, color: '#8a7a5a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Transaction Details</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2a1a', marginBottom: 12 }}>{tx.description}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px,1fr))', gap: 10 }}>
                {tx.given_out > 0 && <div style={{ background: '#fff0f0', borderRadius: 8, padding: '10px 12px' }}><div style={{ fontSize: 10, color: '#b83232', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Given Out</div><div style={{ fontSize: 16, fontWeight: 800, color: '#b83232' }}>AED {fmt(tx.given_out)}</div></div>}
                {tx.spent_by_person > 0 && <div style={{ background: '#fef9e7', borderRadius: 8, padding: '10px 12px' }}><div style={{ fontSize: 10, color: '#856404', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Spent</div><div style={{ fontSize: 16, fontWeight: 800, color: '#856404' }}>AED {fmt(tx.spent_by_person)}</div></div>}
                {tx.returned > 0 && <div style={{ background: '#eafaf1', borderRadius: 8, padding: '10px 12px' }}><div style={{ fontSize: 10, color: '#1a7a3c', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Returned</div><div style={{ fontSize: 16, fontWeight: 800, color: '#1a7a3c' }}>AED {fmt(tx.returned)}</div></div>}
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #ede5d8' }}>
              <div style={{ fontSize: 11, color: '#8a7a5a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Account Summary — {personName}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                <tbody>
                  {[{ label: 'Total Given', value: totalGiven }, { label: 'Total Spent by Person', value: totalSpent }, { label: 'Total Returned', value: totalReturned }].map(r => (
                    <tr key={r.label}><td style={{ padding: '5px 0', color: '#8a7a5a' }}>{r.label}</td><td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>AED {fmt(r.value)}</td></tr>
                  ))}
                  <tr><td style={{ padding: '10px 0 5px', borderTop: '2px solid #ede5d8', fontWeight: 700, color: '#1a2a1a', fontSize: 14 }}>Outstanding Balance</td><td style={{ padding: '10px 0 5px', borderTop: '2px solid #ede5d8', textAlign: 'right', fontWeight: 800, fontSize: 16, color: outstanding > 0 ? '#b83232' : '#1a7a3c' }}>AED {fmt(outstanding)}</td></tr>
                </tbody>
              </table>
            </div>
            <div style={{ padding: '14px 24px', background: '#1a2a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cash In Hand (Overall)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#c9a84c', marginTop: 2 }}>AED {fmt(cashInHand)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Opening Cash</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>AED {fmt(openingCash)}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 32px' }}>
          <div style={{ fontSize: 12, color: '#8a7a5a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Send Invoice</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <button onClick={sendWhatsApp} style={{ background: '#25D366', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>📱 WhatsApp</button>
            <button onClick={sendEmail} style={{ background: '#4A6FA5', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>✉️ Email</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={printInvoice} style={{ background: '#fff', color: '#2d3a2d', border: '1px solid #e0d8c8', borderRadius: 10, padding: '13px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>🖨️ Print / PDF</button>
            <button onClick={copyText} style={{ background: '#fff', color: '#2d3a2d', border: '1px solid #e0d8c8', borderRadius: 10, padding: '13px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>📋 Copy Text</button>
          </div>
        </div>
      </div>
    </div>
  )
}
