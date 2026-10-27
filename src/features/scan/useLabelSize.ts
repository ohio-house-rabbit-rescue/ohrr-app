// The label size in the printer, for pages that print a label without the
// size dropdown (Add a donation's "Print its label"). Same rule as Print
// labels: the rescue's size, unless this device picked one after it was set.
import { useSetting } from '../settings/useSetting'
import type { Json } from '../../lib/database.types'
import { LABEL_SIZE_SETTING, labelSizeFrom, labelSizePickedAt, labelSizeSetAt, loadLabelSize, type LabelSize } from './labels'

export function useLabelSize(): LabelSize {
  const shared = useSetting<Json>(LABEL_SIZE_SETTING, null)
  const rescue = shared.loading ? null : labelSizeFrom(shared.value)
  return rescue && labelSizeSetAt(shared.value) > labelSizePickedAt() ? rescue : loadLabelSize()
}
