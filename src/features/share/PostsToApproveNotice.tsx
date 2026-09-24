// "3 posts waiting for your approval" for the staff dashboard. It shows only
// to people with "Approve social posts", only when someone else's post is
// waiting, and not at all before update 26 is in the database.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { Icon } from '../../components/icons'
import { APPROVE_CAP, countPostsToApprove } from './queue'

/** Posts someone else wrote that are waiting for the signed-in approver (0 otherwise). */
function usePostsToApprove(): number {
  const { membership, can } = useAuth()
  const orgId = membership && can(APPROVE_CAP) ? membership.orgId : null
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!orgId) return
    let alive = true
    void countPostsToApprove(orgId).then((c) => {
      if (alive) setN(c)
    })
    return () => {
      alive = false
    }
  }, [orgId])
  return orgId ? n : 0
}

export function PostsToApproveNotice({ className = '' }: { className?: string }) {
  const n = usePostsToApprove()
  if (n <= 0) return null
  return (
    <Link to="/staff/posts" className={`flex items-center gap-3 rounded-2xl border border-brand-orange/40 bg-brand-orange-50 px-4 py-3 shadow-sm ${className}`}>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange text-white">
        <Icon name="check" size={20} />
      </span>
      <span className="min-w-0 flex-1 font-display text-[15px] font-extrabold text-ink">
        {n === 1 ? '1 post' : `${n} posts`} waiting for your approval
      </span>
      <Icon name="chevron" size={18} className="shrink-0 text-slate-400" />
    </Link>
  )
}

export default PostsToApproveNotice
