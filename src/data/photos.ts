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
  // Happy Tails set (kept distinct from the adoptables above)
  tailLopCarpet: '/sample-bunnies/tail-lop-carpet.jpg',
  tailGreyLap: '/sample-bunnies/tail-grey-lap.jpg',
  tailSpotted: '/sample-bunnies/tail-spotted.jpg',
  tailGreyGrass: '/sample-bunnies/tail-grey-grass.jpg',
  tailFluffy: '/sample-bunnies/tail-fluffy.jpg',
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
  {
    author: 'UsanaAngelou',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Grey_lop-eared_rabbit_lying_on_the_carpet_in_a_lounge.jpg',
  },
  {
    author: 'ZephyrNines',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Rabbit_named_Jupiter.jpg',
  },
  {
    author: 'Gluonman',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Patches_the_Rabbit_2.jpg',
  },
  {
    author: 'Miniaturelop',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Miniature_Lop_-_Grey.jpg',
  },
  {
    author: 'Lithonius',
    license: 'Public domain',
    licenseUrl: 'https://commons.wikimedia.org/wiki/Help:Public_domain',
    source: 'https://commons.wikimedia.org/wiki/File:Rabbit_american_fuzzy_lop_buck_white.jpg',
  },
  // Silent-auction sample item photos
  {
    author: 'Vegan Feast Catering',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Exotic_Fruit_Gift_Basket_(4461109309).jpg',
  },
  {
    author: 'DevoCutlerRubenstein',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Bunnies_in_a_Basket_(Where_toys_go_to_die).jpg',
  },
  {
    author: 'Susangesare',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Handmade_beaded_necklace.jpg',
  },
  {
    author: '999real',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Blue,_pink,_white,_purple_crochet_blanket_2.jpg',
  },
  {
    author: 'Janko Ferlič',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://commons.wikimedia.org/wiki/File:White_Ceramic_Mug_Filled_With_Coffee_Beside_Coffee_Beans_(43087322071).jpg',
  },
  {
    author: 'Tom Beatty',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Canvas_two-tone_tote_Navy_and_Natural7_(9038437258).jpg',
  },
  {
    author: 'Isoda Koryūsai (The Met)',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:%E9%9B%AA%E5%85%8E%E5%9B%B3-Painting_the_Eyes_on_a_Snow_Rabbit_MET_DT5291.jpg',
  },
]
