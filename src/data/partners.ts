// Real Midwest BunFest 2025 rescue partners (midwestbunfest.org/2025-rescue-partners).
// Rabbit rescues and humane organizations from across the country. OHRR is the host.

export interface Partner {
  id: string
  name: string
  location: string
  url?: string
  host?: boolean
}

export const partners: Partner[] = [
  { id: 'ohrr', name: 'Ohio House Rabbit Rescue', location: 'Columbus, OH', url: 'https://www.ohiohouserabbitrescue.org/', host: true },
  { id: 'p1', name: 'A Home for EveryBunny', location: 'Iowa', url: 'https://www.iowarabbitrescue.org' },
  { id: 'p2', name: 'Buckeye House Rabbit Society', location: 'Ohio · since 1997', url: 'https://www.ohare.org/wordpress' },
  { id: 'p3', name: 'Bunnies on Board', location: 'Animal transport', url: 'https://www.facebook.com/bunniesonboard' },
  { id: 'p4', name: 'Columbus House Rabbit Society', location: 'Columbus, OH', url: 'https://www.columbusrabbit.org' },
  { id: 'p5', name: 'Columbus Humane', location: 'Columbus, OH · since 1883', url: 'https://www.columbushumane.org' },
  { id: 'p6', name: 'Destiny’s Safe Haven Inc.', location: 'West Virginia', url: 'https://www.destinyssafehaven.com' },
  { id: 'p7', name: 'Dolly’s Dream Home Rabbit Rescue', location: 'St. Louis, MO', url: 'https://www.DollysDreamHome.org' },
  { id: 'p8', name: 'E.A.R.S. — Erie Area Rabbit Society & Rescue', location: 'Erie, PA', url: 'https://www.eriearearabbitsociety.org' },
  { id: 'p9', name: 'F5RS — Frisky Ferrets, Fuzzies & Feathered Friends', location: 'North Lima, OH', url: 'https://www.facebook.com/F5RS1/' },
  { id: 'p10', name: 'Friends of Rabbits, Inc.', location: 'Mid-Atlantic · since 1997', url: 'https://www.friendsofrabbits.org' },
  { id: 'p11', name: 'Great Lakes Rabbit Sanctuary', location: 'SE Michigan · since 1995', url: 'https://www.rabbitsanctuary.org' },
  { id: 'p12', name: 'Humane Society of Greater Dayton', location: 'Dayton, OH · since 1902', url: 'https://www.hsdayton.org' },
  { id: 'p13', name: 'Indiana House Rabbit Society', location: 'Indiana', url: 'https://indianahrs.org' },
  { id: 'p14', name: 'Missouri House Rabbit Society', location: 'St. Louis, MO', url: 'https://www.morabbit.org' },
  { id: 'p15', name: 'Operation Obi', location: 'Pittsburgh, PA', url: 'https://linktr.ee/operationobi' },
  { id: 'p16', name: 'Saving Rabbits', location: 'Advocacy & education', url: 'https://www.savingrabbits.org' },
  { id: 'p17', name: 'Save the Buns, Inc.', location: 'Research-rabbit rescue', url: 'https://www.savethebuns.org/' },
  { id: 'p18', name: 'Snickerdoodles’ Rabbit Rescue', location: 'Northeast Ohio', url: 'https://snickerdoodlesrescue.org' },
]
