// OHRR's details as the volunteer messages and letters need them.
import { useOrgProfile } from '../../lib/orgProfile'
import type { OrgBits } from './calls'

export function useOrgBits(): OrgBits & { ein: string } {
  const p = useOrgProfile()
  return {
    name: 'Ohio House Rabbit Rescue',
    short: 'OHRR',
    phone: p.phone,
    email: p.email,
    address: p.address,
    signerName: p.letter_signer_name,
    signerTitle: p.letter_signer_title,
    ein: p.ein,
  }
}
