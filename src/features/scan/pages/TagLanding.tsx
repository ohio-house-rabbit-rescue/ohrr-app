// /t/:code — what a printed label's QR opens.
//
// A visitor scanning the tag on the auction table lands on that item's page
// (auction_item_by_code, update 35). A Hop Shop price label (a SKU like
// HAY-101-001, update 41) opens the public Hop Shop for anyone who isn't
// staff. Any other code — or a code that isn't a published auction item, or a
// database without update 35 yet — hands to the staff scan flow; the staff
// route guard sends people to sign in first if needed and they land back here
// afterwards via the ?code= query.
import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { fetchItemByCode } from '../../auction/client'
import { isSku, normalizeCode } from '../codes'

export default function TagLanding() {
  const { code = '' } = useParams()
  const { loading, membership } = useAuth()
  const [to, setTo] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const staff = `/staff/scan?code=${encodeURIComponent(code)}`
    if (isSku(normalizeCode(code))) {
      // Wait to know who's looking: staff get the item, shoppers the shop.
      if (!loading) setTo(membership ? staff : '/hop-shop')
      return
    }
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
  }, [code, loading, membership])

  if (!to) return null
  return <Navigate to={to} replace />
}
