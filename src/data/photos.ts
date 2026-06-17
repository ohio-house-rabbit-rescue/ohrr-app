// Sample bunny photography used as friendly placeholders until OHRR's own
// rabbit photos (via the live Petfinder feed) are wired in. These are real
// rabbit photos from Wikimedia Commons — freely licensed — bundled locally in
// `public/sample-bunnies/` so they always load (no hotlink dependency) and the
// app reads like a real adoption app instead of an emoji.
//
// All credits are surfaced in-app on the Settings screen to honor the licenses.

export const BUNNY_PHOTOS = {
  caramelLop: '/sample-bunnies/bunny-lop-caramel.jpg',
  lionheadWhite: '/sample-bunnies/bunny-lionhead-white.jpg',
  blackLop: '/sample-bunnies/bunny-lop-black.jpg',
  orangeLop: '/sample-bunnies/bunny-lop-orange.jpg',
  silver: '/sample-bunnies/bunny-silver.jpg',
  spotted: '/sample-bunnies/bunny-spotted.jpg',
  brown: '/sample-bunnies/bunny-brown.jpg',
  greyLop: '/sample-bunnies/bunny-grey-lop.jpg',
  greyDwarf: '/sample-bunnies/bunny-grey-dwarf.jpg',
} as const

export interface PhotoCredit {
  author: string
  license: string
  licenseUrl: string
  source: string
}

// Attribution for the bundled sample photos (CC BY-SA / public domain from
// Wikimedia Commons). Required by the licenses; shown on the Settings screen.
export const PHOTO_CREDITS: PhotoCredit[] = [
  {
    author: 'Harold Cecchetti',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Holland_lop_rabbit.jpg',
  },
  {
    author: 'Kiraface',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Lionhead_Rabbit_with_black_nose.jpg',
  },
  {
    author: 'Paul Korecky',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    source:
      'https://commons.wikimedia.org/wiki/File:2018-06-09_AT_Wien_13_Hietzing,_Tiergarten_Sch%C3%B6nbrunn,_Oryctolagus_cuniculus_f._domesticus_(48942978561).jpg',
  },
  {
    author: 'Orlandkurtenbach',
    license: 'Public domain',
    licenseUrl: 'https://commons.wikimedia.org/wiki/Help:Public_domain',
    source: 'https://commons.wikimedia.org/wiki/File:Holland_lop_bunny.JPG',
  },
  {
    author: 'Paul Korecky',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    source:
      'https://commons.wikimedia.org/wiki/File:2018-01-28_AT_Wien_13_Hietzing,_Tiergarten_Sch%C3%B6nbrunn,_Oryctolagus_cuniculus_f._domesticus_(42373847040).jpg',
  },
  {
    author: 'Friedrich Haag',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Heimtier_004_2023_08_26.jpg',
  },
  {
    author: 'KittensMittens2',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Coconut_the_rabbit_09.jpg',
  },
  {
    author: 'Kippo44',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:A_grey_holland_lop_rabbit.jpg',
  },
  {
    author: 'DestinationFearFan',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Netherland_Dwarf_rabbit.jpg',
  },
]
