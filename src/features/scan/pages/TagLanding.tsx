// /t/:code — what a printed OHRR tag's QR opens. Hands straight to the staff
// scan flow; the staff route guard sends people to sign in first if needed
// and they land back here afterwards via the ?code= query.
import { Navigate, useParams } from 'react-router-dom'

export default function TagLanding() {
  const { code = '' } = useParams()
  return <Navigate to={`/staff/scan?code=${encodeURIComponent(code)}`} replace />
}
