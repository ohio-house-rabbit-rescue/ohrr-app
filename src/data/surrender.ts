// OHRR owner-surrender content, brought in-app so people don't have to leave for
// the org's website. Sourced verbatim from OHRR's official policy PDFs:
//  - Good Samaritan/Owner Surrender & Relinquishment Policy
//  - Admissions Policy
// (linked from ohiohouserabbitrescue.org/about-us/admissions). The supportive
// framing matches the app's "let's help you keep your bunny first" approach.

export const surrenderContact = {
  email: 'ohrrcontact@ohiohouserabbitrescue.org',
  phone: '614-263-8557',
  phoneHref: 'tel:+16142638557',
}

// The two official relinquishment forms (interactive on OHRR's site — these are
// the legal forms that must be completed and brought in on surrender day).
export const surrenderForms = {
  owner:
    'https://www.ohiohouserabbitrescue.org/about-us/admissions/owner-surrender-and-relinquishment-form/',
  goodSamaritan:
    'https://www.ohiohouserabbitrescue.org/about-us/admissions/good-samaritian-rescuesurrender-and-relinquishment-form/',
}

export const surrenderIntro =
  'Life changes, and sometimes keeping a rabbit becomes hard. Before anything else, reach out — OHRR will offer support and information to help you keep your bunny if at all possible. If surrender really is the right step, here’s exactly how it works.'

export const surrenderSteps: { title: string; text: string }[] = [
  {
    title: 'Contact OHRR first to check space',
    text: 'OHRR is a restricted-admissions rescue, and only a very limited amount of space is set aside for owner surrenders. Email or call before bringing a rabbit in so they can tell you whether there’s room.',
  },
  {
    title: 'Let OHRR try to help you keep your rabbit',
    text: 'OHRR offers support and information to help owners and Good Samaritans keep the rabbit. If a medical need like a spay or neuter is the obstacle, they may be able to help (you’d sign a waiver acknowledging the risks). A home visit may be requested before any action is taken.',
  },
  {
    title: 'Complete the relinquishment form',
    text: 'If you’ve declined that support and still wish to surrender, complete the Owner Surrender & Relinquishment form (or the Good Samaritan form if you rescued the rabbit) and bring it with you on the day you surrender the rabbit.',
  },
  {
    title: 'Bring the rabbit’s supplies',
    text: 'OHRR asks that the rabbit’s food, litter, litter box, cage, exercise enclosure, and food/water bowls come with them and become OHRR’s property — delivered on surrender day so the rabbit keeps familiar things.',
  },
  {
    title: 'Make the surrender donation',
    text: 'A donation of $40 for a single rabbit, or $60 for a bonded pair, is required. It helps cover spay/neuter, food, any needed veterinary care, and the costs of fostering and adoption.',
  },
  {
    title: 'If there’s no space',
    text: 'If OHRR can’t admit the rabbit, they’ll offer a list of other organizations that may be able to help, and they keep a waiting list.',
  },
]

export const surrenderDonation = { single: '$40', pair: '$60' }

// Reassurance: what happens to the rabbit after intake (from the Admissions Policy).
export const afterSurrender: string[] = [
  'Once admitted, the rabbit becomes OHRR’s responsibility and is assessed for behavior and health.',
  'A rabbit-experienced veterinarian gives a wellness exam; a board member or staff checks temperament.',
  'If cleared, the rabbit is spayed or neutered and recovers in a foster home.',
  'After about a two-week recovery, the rabbit becomes available for adoption.',
]

export const goodSamaritanNote =
  'A “Good Samaritan” surrender is when you’ve rescued a rabbit that isn’t yours and are turning it over to OHRR — it uses a separate form from an owner surrender.'

// Verbatim official policy text, included so the full detail lives in-app.
export const fullPolicies: { title: string; body: string }[] = [
  {
    title: 'Good Samaritan / Owner Surrender & Relinquishment Policy',
    body: `Ohio House Rabbit Rescue, Inc is a private, nonprofit rabbit rescue organization and does not receive any tax dollars from the city or any government agency. If space is available, Ohio House Rabbit Rescue will accept rabbits that have been rescued by Ohio House Rabbit Rescue staff and volunteers, rabbits rescued and then surrendered by a Good Samaritan, and rabbits surrendered by their owners (very limited space is designated for owner surrenders). If it is determined that Ohio House Rabbit Rescue does not have the space to admit the rabbit, then Ohio House Rabbit Rescue will offer a list of other organizations that may accept the rabbit. Additionally, Ohio House Rabbit Rescue will utilize a waiting list option.

If a Good Samaritan rescuer or owner is considering bringing a rabbit to Ohio House Rabbit Rescue for possible intake, contact Ohio House Rabbit Rescue to see if space is available.

For Good Samaritan and owner surrenders, Ohio House Rabbit Rescue will offer support and information to encourage and assist the Good Samaritan or owner to keep the rabbit. If medical intervention, such as a necessary spay or neuter is needed for the Good Samaritan or owner to keep the rabbit, the Good Samaritan or owner will be required to sign a waiver acknowledging the risks of any medical procedure or intervention and release Ohio House Rabbit Rescue from all liabilities. The Good Samaritan or owner may also be asked to allow Ohio House Rabbit Rescue to complete a home visit before any action is taken.

If the Good Samaritan or owner declines support from Ohio House Rabbit Rescue to keep the rabbit and still wishes to surrender the rabbit, the Good Samaritan is required to complete the Good Samaritan Rescue/Surrender & Relinquishment form and the owner is required to complete the Owner Surrender & Relinquishment form and bring it to Ohio House Rabbit Rescue on the day the rabbit is surrendered. Additionally, Ohio House Rabbit Rescue asks that all materials such as food, litter, litter box, cage, exercise enclosure, food and water bowls used by the surrendered rabbit and his/her owner become the property of Ohio House Rabbit Rescue, Inc and should be delivered to Ohio House Rabbit Rescue on the day the rabbit is surrendered.

For all surrenders, we require a $40 donation for a single rabbit and $60 for a bonded pair. This donation helps cover the costs of spaying/neutering, food, any necessary veterinary care, and costs related to fostering and adoption of the surrendered rabbit.`,
  },
  {
    title: 'Admissions Policy',
    body: `Ohio House Rabbit Rescue, Inc. is a restricted admissions organization. If space is available, Ohio House Rabbit Rescue will accept rabbits that have been rescued by Ohio House Rabbit Rescue staff or volunteers and rabbits rescued and then surrendered by a Good Samaritan. A very limited space will be dedicated to rabbits surrendered by their owners. If it is determined that Ohio House Rabbit Rescue does not have the space to admit the rabbit, then Ohio House Rabbit Rescue will offer a list of other organizations, with contact information that may accept the rabbit.

Once Ohio House Rabbit Rescue accepts the rabbit for admission, the owner or Good Samaritan must complete a surrender/relinquishment form. The rabbit then becomes the responsibility of Ohio House Rabbit Rescue and he/she will be assessed to determine behavior and health status.

The rabbit’s behavior will be assessed by an Ohio House Rabbit Rescue Board member or staff to determine whether the rabbit is exhibiting aggressive behavior and/or may create a safety risk to people or other animals. The rabbit will be assessed medically with a wellness exam performed by a rabbit-experienced veterinarian.

If the rabbit is cleared behaviorally and medically, the rabbit will be spayed or neutered. The rabbit will then be placed in a foster home during the recovery period. The rabbit will be available for adoption after a 2-week recovery period. For an experienced fosterer, the rabbit may be placed in the foster home before the medical assessment and subsequent surgery.

If the rabbit is diagnosed with a treatable medical condition, the rabbit will be treated at the veterinarian’s recommendation for an agreed upon period of time. At the end of that period, the rabbit’s condition will be reassessed by a veterinarian to determine further treatment or another course of action based on the veterinarian’s recommendation. If the medical condition is worse or untreatable or if the rabbit is suffering, the outcome will be dealt with on a case-by-case basis for possible euthanasia.

If the initial wellness examination reveals that the rabbit is determined to be suffering from pain with no treatment options, euthanasia will be considered.

Ohio House Rabbit Rescue, Inc. is committed to the preservation of life and to the objective use of approved methods of euthanasia, when appropriate, guided by medical standards and a reasonable interpretation of the definition of the purpose behind euthanasia. Factors contributing to the euthanasia of any rabbit include an untreatable condition, a contagious disease, experiencing pain and suffering, or a health or safety risk to people or other animals. The Board of Directors will discuss each matter on a case-by-case basis with input from the veterinarian treating the rabbit. If the rabbit is being housed in a foster home, the fosterer’s input will be considered before a decision to euthanize is finalized. If the fosterer is willing to adopt the rabbit, he/she assumes financial responsibility for the rabbit.`,
  },
]
