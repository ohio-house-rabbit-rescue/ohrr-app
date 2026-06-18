// Field schema + legal agreement for the in-app rabbit intake form, mirroring
// OHRR's official Owner Surrender & Relinquishment form and Good Samaritan
// Rescue/Surrender & Relinquishment form
// (ohiohouserabbitrescue.org/about-us/admissions/...). Submissions post to
// Netlify Forms ("surrender-intake"); OHRR receives them by email.
//
// The owner agreement text is verbatim from OHRR's form. The Good Samaritan
// agreement adapts the same policy to a finder who doesn't know the owner.

export type IntakeType = 'owner' | 'good-samaritan'

export type FieldType = 'text' | 'tel' | 'email' | 'date' | 'textarea' | 'radio' | 'checkboxes'

export interface FormField {
  name: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  placeholder?: string
  help?: string
}

export interface FormSection {
  title: string
  intro?: string
  fields: FormField[]
}

const BEHAVIOR = ['Friendly', 'Shy', 'Indifferent', 'Aggressive', 'Unknown']

const contactSection = (nameLabel: string): FormSection => ({
  title: 'Your information',
  fields: [
    { name: 'name', label: nameLabel, type: 'text', required: true },
    { name: 'phone', label: 'Phone', type: 'tel', required: true },
    { name: 'altPhone', label: 'Alternate phone', type: 'tel' },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'address', label: 'Street address', type: 'text' },
    { name: 'cityStateZip', label: 'City, State, ZIP', type: 'text' },
    {
      name: 'heardAbout',
      label: 'How did you hear about OHRR?',
      type: 'radio',
      options: ['Word of mouth', 'Website', 'Newspaper', 'Television', 'Radio', 'Other'],
    },
  ],
})

export const ownerSections: FormSection[] = [
  contactSection('Your name'),
  {
    title: 'About the surrender',
    fields: [
      { name: 'rabbitName', label: 'Rabbit’s name', type: 'text' },
      { name: 'reason', label: 'Reason for surrender', type: 'textarea' },
    ],
  },
  {
    title: 'Your rabbit',
    intro: 'Anything you can share helps us care for and place your rabbit well.',
    fields: [
      { name: 'gotFrom', label: 'Where did you get your rabbit?', type: 'text' },
      { name: 'ownedFor', label: 'How long have you had them?', type: 'text' },
      { name: 'age', label: 'Age (if known)', type: 'text' },
      {
        name: 'enclosure',
        label: 'Their enclosure is',
        type: 'radio',
        options: ['Cage', 'Outdoor hutch', 'Exercise pen', 'Free-roaming', 'Other'],
      },
      {
        name: 'timeOut',
        label: 'Time outside the enclosure daily',
        type: 'radio',
        options: ['None', 'Less than 1 hour', '1–2 hours', '2–4 hours', '4+ hours'],
      },
      {
        name: 'livedWith',
        label: 'Has lived with',
        type: 'checkboxes',
        options: ['Other rabbits', 'Dogs', 'Cats', 'Other'],
      },
      { name: 'behaviorRabbits', label: 'Around other rabbits', type: 'radio', options: ['Snuggle & play', 'Fight', 'Ignore each other', 'Unknown'] },
      { name: 'behaviorCats', label: 'Around cats', type: 'radio', options: BEHAVIOR },
      { name: 'behaviorDogs', label: 'Around dogs', type: 'radio', options: BEHAVIOR },
      { name: 'behaviorChildren', label: 'Around children', type: 'radio', options: BEHAVIOR },
      { name: 'behaviorStrangers', label: 'Around strangers', type: 'radio', options: BEHAVIOR },
      { name: 'litterBox', label: 'Litter box in their living space?', type: 'radio', options: ['Yes', 'No'] },
      { name: 'litterUse', label: 'Uses the litter box', type: 'radio', options: ['Always', 'Sometimes', 'Never'] },
      { name: 'litterType', label: 'Type of litter used', type: 'text' },
      {
        name: 'diet',
        label: 'Usually eats',
        type: 'checkboxes',
        options: ['Hay', 'Green vegetables', 'Carrots / fruit', 'Treats', 'Pellets', 'Other'],
      },
      { name: 'lastVet', label: 'Last vet visit', type: 'date' },
      { name: 'vetName', label: 'Vet practice / vet’s name', type: 'text' },
      { name: 'spayNeuter', label: 'Spayed or neutered?', type: 'radio', options: ['Yes', 'No', 'Unknown'] },
      { name: 'surgeryClinic', label: 'Clinic that did the surgery', type: 'text' },
      { name: 'healthConcerns', label: 'Health concerns', type: 'textarea' },
      { name: 'otherInfo', label: 'Anything else that would help us?', type: 'textarea' },
    ],
  },
]

export const samSections: FormSection[] = [
  contactSection('Your name'),
  {
    title: 'About the rabbit',
    intro: 'You rescued a rabbit that isn’t yours — tell us what you know.',
    fields: [
      { name: 'rabbitName', label: 'Rabbit’s name (if any)', type: 'text' },
      {
        name: 'foundConditions',
        label: 'Where and under what conditions did you find the rabbit?',
        type: 'textarea',
        required: true,
      },
      { name: 'eating', label: 'Eating habits', type: 'textarea' },
      { name: 'behavior', label: 'Behavior', type: 'textarea' },
      { name: 'litterHabits', label: 'Litter box habits', type: 'textarea' },
      { name: 'healthConcerns', label: 'Any health concerns', type: 'textarea' },
      { name: 'vetVisit', label: 'Did you take the rabbit to a vet? Details', type: 'textarea' },
      { name: 'otherInfo', label: 'Anything else helpful for us to know', type: 'textarea' },
    ],
  },
]

// Verbatim owner agreement (from OHRR's Owner Surrender & Relinquishment form).
export const ownerAgreement: string[] = [
  'I am the owner of this rabbit or the owner’s representative acting upon the owner’s consent.',
  'I have been offered support and information to help me keep my rabbit but decline it at this time.',
  'I understand that I will be charged a non-refundable donation of $40 (single rabbit) / $60 (bonded pair) to admit this rabbit to Ohio House Rabbit Rescue, Inc.',
  'I understand that Ohio House Rabbit Rescue, Inc. is a nonprofit organization whose mission is to build and operate a Center for rescued abandoned pet rabbits, offer a robust adoption program, and provide educational resources and programming on the proper care of rabbits as indoor companions.',
  'Rabbits with unmanageable illness or contagious disease and rabbits that pose a health or safety risk to people or other animals and cannot be handled safely may not be candidates for our adoption program and may be humanely euthanized. Ohio House Rabbit Rescue, Inc. cannot guarantee adoption or placement of any rabbit. Sometimes health, age, or behavioral problems become evident after admission or our veterinarian/staff discover them upon examination or evaluation.',
  'My signature below reflects that I have read and understand the above information and that I am releasing all rights and claims for this rabbit to Ohio House Rabbit Rescue, Inc.',
]

// Good Samaritan agreement (OHRR's combined GS/Owner Surrender & Relinquishment
// Policy, adapted to a finder who doesn’t know the owner).
export const samAgreement: string[] = [
  'I am a Good Samaritan who rescued this rabbit, and I do not know who the rabbit’s owner is.',
  'I have been offered support and information to help me keep the rabbit but decline it at this time.',
  'I understand that I will be charged a non-refundable donation of $40 (single rabbit) / $60 (bonded pair) to admit this rabbit to Ohio House Rabbit Rescue, Inc.',
  'I understand that Ohio House Rabbit Rescue, Inc. is a nonprofit organization whose mission is to build and operate a Center for rescued abandoned pet rabbits, offer a robust adoption program, and provide educational resources and programming on the proper care of rabbits as indoor companions.',
  'Rabbits with unmanageable illness or contagious disease and rabbits that pose a health or safety risk to people or other animals and cannot be handled safely may not be candidates for our adoption program and may be humanely euthanized. Ohio House Rabbit Rescue, Inc. cannot guarantee adoption or placement of any rabbit.',
  'My signature below reflects that I have read and understand the above information and that I am releasing all rights and claims for this rabbit to Ohio House Rabbit Rescue, Inc.',
]

export function intakeConfig(type: IntakeType) {
  return type === 'good-samaritan'
    ? { sections: samSections, agreement: samAgreement, title: 'Good Samaritan Surrender', noun: 'rescued rabbit' }
    : { sections: ownerSections, agreement: ownerAgreement, title: 'Owner Surrender & Relinquishment', noun: 'rabbit' }
}
