// /t/:code — what a printed OHRR tag's QR opens.
//
// A visitor scanning the tag on the auction table lands on that item's page
// (auction_item_by_code, update 35). Any other tag — or a code that isn't a
// published auction item, or a database without update 35 yet — hands to the
// staff scan flow as before; the staff route guard sends people to sign in
// first if needed and they land back here afterwards via the ?code= query.
import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import { fetchItemByCode } from '../../auction/client'

export default function TagLanding() {
  const { code = '' } = useParams()
  const [to, setTo] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const staff = `/staff/scan?code=${encodeURIComponent(code)}`
    if (!code || !isSupabaseConfigured) {
      setTo(staff)
      return
    }
    fetchItemByCode(supabase, code)
      .then((item) => alive && setTo(item?.id ? `/bunfest/auction/${item.id}` : staff))
      .catch(() => alive && setTo(staff))
    return () => {
      alive = false
    }
  }, [code])

  if (!to) return null
  return <Navigate to={to} replace />
}
