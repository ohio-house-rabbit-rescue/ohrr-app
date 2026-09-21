// OHRR's adoption application, question for question from
// https://www.ohiohouserabbitrescue.org/adopt/adoption-application/ (captured
// 2026-09-21). Wording is verbatim — including OHRR's own typos in a couple of
// labels — so what staff receive matches the form they already know. The
// website carries a copy of this file (src/data/adoptionApplication.ts);
// keep the two in sync. Submissions land in the staff Inbox as
// 'adoption-application'.
import type { FormField, FormSection } from './surrenderForm'

const YES_NO = ['Yes', 'No']

function pet(n: number): FormField[] {
  return [
    { name: `pet${n}Type`, label: `Type of pet`, type: 'text' },
    { name: `pet${n}Age`, label: 'Age', type: 'text' },
    { name: `pet${n}Owned`, label: 'How Long Owned', type: 'text' },
    { name: `pet${n}Sex`, label: 'Sex', type: 'radio', options: ['Male', 'Female'] },
    { name: `pet${n}Altered`, label: 'Altered (Spayed/Neutered)', type: 'radio', options: YES_NO },
    { name: `pet${n}Kept`, label: 'Kept Indoors/Outdoors/Both', type: 'text' },
  ]
}
function pastPet(n: number): FormField[] {
  return [
    { name: `past${n}Type`, label: 'Type of Pet', type: 'text' },
    { name: `past${n}Owned`, label: 'How Long Owned', type: 'text' },
    { name: `past${n}Reason`, label: 'Reason No Longer Owned', type: 'text' },
  ]
}
function member(n: number): FormField[] {
  return [
    { name: `member${n}Name`, label: 'Name', type: 'text' },
    { name: `member${n}Relationship`, label: 'Relationship', type: 'text' },
    { name: `member${n}Age`, label: 'Age', type: 'text' },
  ]
}

export const applicationSections: FormSection[] = [
  {
    title: 'About you',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'street', label: 'Street address', type: 'text', required: true },
      { name: 'street2', label: 'Apt / suite / building', type: 'text' },
      { name: 'city', label: 'City', type: 'text', required: true },
      { name: 'state', label: 'State', type: 'text', required: true, placeholder: 'OH' },
      { name: 'zip', label: 'ZIP code', type: 'text', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'altPhone', label: 'Alternate Phone', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'why', label: 'Please tell us why you are interested in adopting a rabbit', type: 'textarea', required: true },
      {
        name: 'policyReviewed',
        label: "I have reviewed Ohio House Rabbit Rescue's adoption policy and I understand that the rabbit must live in a minimum space of 4′ by 4′",
        type: 'checkboxes',
        options: ['Yes, I have reviewed it'],
        required: true,
      },
      { name: 'over18', label: 'I am over 18 years old', type: 'checkboxes', options: ['Yes'], required: true },
    ],
  },
  {
    title: 'Your home',
    fields: [
      { name: 'ownRent', label: 'Do you own or rent your home?', type: 'radio', options: ['Own', 'Rent'] },
      { name: 'landlordApproval', label: "Have you received your landlord's approval?", type: 'radio', options: YES_NO },
      { name: 'yearsAtAddress', label: 'How long have you lived at this address?', type: 'text' },
      { name: 'landlordName', label: "Landlord's Name", type: 'text' },
      { name: 'landlordPhone', label: "Landlord's Phone", type: 'tel' },
      {
        name: 'household',
        label: 'My Household Consist of',
        type: 'radio',
        options: ['Adults Only', 'Family with children over 10 years old', 'Family with young children under 10 years old', 'Live Alone'],
      },
    ],
  },
  {
    title: 'Who lives with you',
    intro: 'Please provide the names and ages of everyone living in your home. For example: Ron, spouse, over 21; Beth, daugher, 13, etc.',
    fields: [...member(1), ...member(2), ...member(3), ...member(4), ...member(5)],
  },
  {
    title: 'A little more about your home',
    fields: [
      {
        name: 'crueltyConviction',
        label: 'Has anyone in the household been convicted of animal neglect or cruelty in any local, state, or national jurisdication?',
        type: 'radio',
        options: YES_NO,
      },
      { name: 'breeding', label: 'Has anyone in the household been involved in breeding rabbits for sale?', type: 'radio', options: YES_NO },
      { name: 'activityLevel', label: 'The activity level in my home is', type: 'radio', options: ['Quiet', 'Active', 'Hectic'] },
      {
        name: 'homePresence',
        label: 'I am…',
        type: 'radio',
        options: ['rarely home (sleep there only)', 'at home when not at work', 'home all day (or someone is there)'],
      },
    ],
  },
  {
    title: 'Current pets in household',
    fields: [...pet(1), ...pet(2), ...pet(3)],
  },
  {
    title: 'Tell Us About your Past Pets',
    fields: [...pastPet(1), ...pastPet(2), ...pastPet(3)],
  },
  {
    title: 'Vet, allergies and research',
    fields: [
      { name: 'vet', label: 'Who is your veterinarian?', type: 'text' },
      { name: 'vetPhone', label: 'Phone', type: 'tel' },
      {
        name: 'allergies',
        label: 'Does anyone in your household have an environmental or animal allergy to',
        type: 'checkboxes',
        options: ['Rabbits', 'Hay', 'Grass'],
      },
      { name: 'everyoneAgrees', label: 'Does everyone in your hosehold agree with getting a new rabbit?', type: 'radio', options: YES_NO },
      { name: 'research', label: "What kind of research have you done to learn about this kind of animal's needs?", type: 'textarea' },
      { name: 'caregiver', label: "Who will be directly responsible for your rabbit's care/feeding/handling?", type: 'textarea' },
      {
        name: 'housing',
        label: "How and where will you house your new rabbit? Please describe in detail the size and location of your new rabbit's habitat.",
        type: 'textarea',
      },
    ],
  },
  {
    title: 'The rabbit you have in mind',
    fields: [
      {
        name: 'consider',
        label: 'Would you consider adopting an older, shy, or special needs rabbit? Check all that apply.',
        type: 'checkboxes',
        options: ['Older', 'Shy', 'Special Needs'],
      },
      { name: 'bondedPair', label: 'Would you consider adopting a bonded pair?', type: 'radio', options: YES_NO },
      { name: 'rabbit', label: 'Is there a particular rabbit that you are interested in?', type: 'text' },
      {
        name: 'heardAbout',
        label: 'How did you hear about us?',
        type: 'radio',
        options: ['Word of Mouth/Friend', 'Website', 'Newspaper', 'Television', 'Radio', 'Facebook/Social Media', 'Other'],
      },
      { name: 'heardOther', label: 'If Other', type: 'text' },
      { name: 'rehomeConditions', label: 'Under what conditions would you feel it necessary to find another home for your rabbit?', type: 'textarea' },
    ],
  },
]

// Agreement (verbatim).
export const applicationAgreement = {
  certify:
    'I certify that all of the information in this application is true and I understand that false information may void the adoption and future adoptions from Ohio House Rabbit Rescue, Inc.',
  returnPolicy: 'I agree that if I can no longer care for this rabbit, I will return this rabbit to Ohio House Rabbit Rescue, Inc.',
  reserves:
    'Ohio House Rabbit Rescue, Inc. reserves the right to deny adoptions. Our priorities are the health, safety, and future well being of the rabbits in our care and the health, safety, and expectations of people who visit us with hopes of finding a pet who will match their interests, lifestyle, and existing companion animal(s).',
}
