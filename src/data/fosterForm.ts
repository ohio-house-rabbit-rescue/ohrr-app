// Foster interest form — the "door in" for students, renters and young adults
// who aren't ready to adopt. OHRR has no published foster form, so these
// questions are the short, sensible set a coordinator needs to say yes or
// call back; OHRR can trim or add in this file. Lands in the staff Inbox as
// 'foster-application'. The website carries the same copy — keep in sync.
import type { FormSection } from './surrenderForm'

export const fosterSections: FormSection[] = [
  {
    title: 'About you',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'cityZip', label: 'City and ZIP', type: 'text', required: true, placeholder: 'Columbus 43214' },
      { name: 'age18', label: 'I am 18 or older', type: 'checkboxes', options: ['Yes'], required: true },
      {
        name: 'situation',
        label: 'Which describes you best?',
        type: 'radio',
        options: ['Student', 'Renting', 'Own my home', 'Other'],
      },
      { name: 'landlordOk', label: 'If you rent: does your lease allow a rabbit (a caged small animal)?', type: 'radio', options: ['Yes', 'Not sure yet', 'No'] },
    ],
  },
  {
    title: 'Your space',
    fields: [
      {
        name: 'space',
        label: 'Where would the rabbit live?',
        type: 'radio',
        options: ['A bunny-proofed room', 'A pen at least 4′ × 4′ in a shared room', 'Not sure — tell me what works'],
      },
      { name: 'otherPets', label: 'Other pets in the home (type and how they are kept)', type: 'text' },
      { name: 'household', label: 'Who lives with you (adults / children and ages)', type: 'text' },
      { name: 'awayHours', label: 'On a normal day, how many hours is the home empty?', type: 'text', placeholder: '6–8' },
    ],
  },
  {
    title: 'Fostering',
    fields: [
      { name: 'experience', label: 'Experience with rabbits (none is fine — say so)', type: 'textarea' },
      {
        name: 'length',
        label: 'How long could you foster?',
        type: 'radio',
        options: ['2–4 weeks', '1–2 months', 'Longer', 'Depends — ask me'],
      },
      { name: 'start', label: 'When could you start?', type: 'text', placeholder: 'Any time · after October · summer break' },
      {
        name: 'okWith',
        label: 'I would be comfortable with',
        type: 'checkboxes',
        options: ['A rabbit recovering from surgery (medication)', 'A shy rabbit', 'A bonded pair', 'Driving the rabbit to appointments'],
      },
      { name: 'breaks', label: 'If you are a student: where would the rabbit be over breaks?', type: 'text' },
      { name: 'notes', label: 'Anything else OHRR should know?', type: 'textarea' },
    ],
  },
]

export const fosterAgreement = [
  'I understand the rabbit remains the property and responsibility of Ohio House Rabbit Rescue, Inc., that OHRR arranges its veterinary care, and that I will contact OHRR before any decision about the rabbit’s care or placement.',
]
