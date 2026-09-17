// Rabbit-care articles — the bundled seed for the shared `care_articles` table
// (see supabase/migrations/20260627065720_care_articles.sql). The Learn screens
// read live published articles from Supabase and silently fall back to this
// list; the staff "Import the built-in guides" button inserts these rows; and
// supabase/migrations/*_seed_live_site_content.sql seeds them (generated from
// this file by scripts/generate-seed-sql.mjs).
//
// Content adapted faithfully from OHRR's live Resources page
// (https://ohiohouserabbitrescue.org/rabbit-care/resources/) and the two
// "I want to LEARN" pages, captured 2026-09-17. Bodies are light markdown:
// blank-line paragraphs, `## ` headings, `- ` bullets; bare URLs are tappable.
// The three articles OHRR links out to (House Rabbit Society, Small Pet Select,
// Binkybunny.com) are summarized with a link rather than copied.

export const CARE_DISCLAIMER =
  'General guidance from Ohio House Rabbit Rescue — always consult a rabbit-savvy vet for medical concerns.'

export interface SeedArticle {
  slug: string
  title: string
  /** one of CARE_ICONS in src/lib/careContent.ts */
  icon: string
  summary: string
  body: string
  tip: string | null
  sort_order: number
  /** Where the original lives (shown as a "Read on ohiohouserabbitrescue.org" link). */
  source?: string
}

export const seedCareArticles: SeedArticle[] = [
  {
    slug: 'bunny-diet',
    title: 'Timothy? Alfalfa? What You Should Know About Your Bunny’s Diet!',
    icon: 'apple',
    summary: 'Limited timothy pellets, unlimited timothy hay, and a daily fresh green salad.',
    sort_order: 0,
    source: 'https://www.ohiohouserabbitrescue.org/bunnydiet/',
    tip: 'One baby carrot or one slice of banana per day is plenty — too much sugar is not good!',
    body: `We see it all the time. Someone brought their cute, little bunny home from the pet store and had no idea what to feed it. We’ve had bunnies who were eating exclusively pellets, or bunnies who were fed only carrots. After all, that’s what Bugs Bunny eats, right? Once, we had a bunny who had lived on gerbil food, chicken nuggets and a Peep over the course of a year.

Feeding your rabbit a proper diet is more important than just good nutrition. Rabbits have unusually sensitive digestive systems, and eating a high fiber diet of pellets and hay can prevent their digestive system from slowing, or worse, stopping entirely. Gastrointestinal stasis is extremely dangerous for rabbits and can be caused by insufficient fiber in your bunny’s diet. Not only that, but grinding hay helps keep their teeth from getting too long. Luckily, knowing the right food for your bunny can help.

## The three essentials

Ohio House Rabbit Rescue recommends that your bunny’s main diet include three things: limited timothy pellets, unlimited timothy hay and a daily fresh green salad.

## Pellets

Pellets are high in calories and therefore are used as a supplement. We recommend feeding 1/8 of a cup of high quality pellets (such as Oxbow Essentials Adult Rabbit Food or Small Pet Select Premium Rabbit Food Pellets) per 4 lbs of bunny, although many bunnies are OK with less.

## The daily salad

The salad is where your bunny’s most important nutrients are coming from. Almost all leafy greens are suitable, and that includes things that people might not normally eat, like beet greens or carrot tops. Be careful of spinach, mustard greens and kale, as they’re high in calcium, and never feed your rabbit iceberg lettuce because it has no nutritional value. The perfect salad includes a lettuce base (like green leaf, romaine or butter lettuce) and a few other herbs or greens depending on what your rabbit likes. Cilantro, radicchio, mint, parsley or basil are all great choices, and your bunny will let you know what he likes!

## Hay, hay, hay

The most important part of your rabbit’s diet is hay. Hay is high in fiber so it will help keep your bunny’s digestive system moving and it will keep their teeth in shape. Ohio House Rabbit Rescue feeds our bunnies Oxbow Timothy Hay, but you can also use orchard grass and/or oat hay depending on your bunny’s preferences. You can even order fresh hay online through retailers like Small Pet Select. We also stock a variety of hay in the OHRR Hop Shop.

## Treats

All bunnies need to know that they’re adored, so feel free to give your bun an occasional treat. In fact, it’s good to know your bunny’s favorite treat in case you ever need to give them medicine (particularly Metacam), which can be “disguised” by mixing it with a treat. Raisins or Craisins, baby carrots, small banana slices or strawberries make great treats for bunnies. But be careful not to overdo it; too much sugar is not good! One baby carrot or slice of a banana per day is plenty!`,
  },
  {
    slug: 'vegetables-and-fruits',
    title: 'Suggested Vegetables and Fruits for a Rabbit Diet',
    icon: 'apple',
    summary: 'The House Rabbit Society’s guide to safe greens, how much to feed, and what to avoid.',
    sort_order: 1,
    source: 'https://rabbit.org/suggested-vegetables-and-fruits-for-a-rabbit-diet/',
    tip: 'Introduce one new green at a time and wait 24 hours before adding another, so you can tell if something doesn’t agree with your bunny.',
    body: `OHRR points bunny parents to the House Rabbit Society’s vegetable and fruit guide. The essentials:

- Fresh vegetables should make up approximately 10% of an adult rabbit’s diet; hay should be about 80%. Fruit is a treat — less than 5% of the daily diet.
- A good rule of thumb for adults is approximately one cup of packed greens for every two pounds of rabbit. Leafy greens should be about 75% of the fresh vegetables you feed.
- Baby rabbits should only get vegetables after 12 weeks of age, introduced one at a time in tiny amounts.
- Introduce new greens one type per day and watch for soft stools or gas; discontinue anything that causes them.
- Serve vegetables wet to boost your rabbit’s water intake, and never serve spoiled produce.
- Sugary vegetables like carrots are treats and should be strictly rationed.

The full guide — with the complete list of safe leafy greens, non-leafy vegetables, fruits, and the vegetables to avoid — is on the House Rabbit Society site:

https://rabbit.org/care/fruits-vegetables/`,
  },
  {
    slug: 'top-ten-tips',
    title: 'Top Ten Tips for New Bunny Owners',
    icon: 'book',
    summary: 'A rabbit-savvy vet, spay/neuter, indoor living, a 4×4 space, bunny-proofing, and more.',
    sort_order: 2,
    source: 'https://ohiohouserabbitrescue.org/top_ten_tips_for_new_bunny_parents/',
    tip: 'Never use non-kiln-dried pine or cedar litter — it can damage a bunny’s respiratory system.',
    body: `We asked and you answered! Here are the top ten tips for new (or even experienced) bunny owners.

## 1. A rabbit savvy vet is your new best friend.

Rabbits are considered exotic pets and have different needs than dogs or cats, so make sure your vet has experience with bunnies. Even the best dog or cat vet may not know about your bunny’s needs. Check out OHRR’s list of rabbit vets in Ohio — it’s in this app under Find a vet.

## 2. Get them fixed!

All rabbits from Ohio House Rabbit Rescue are spayed/neutered before being adopted. Spaying/neutering not only prevents unwanted litters, but it also helps cut back on bad behavior such as aggression and marking territory. Older, unaltered rabbits are also at a higher risk for certain cancers, which can be prevented by spay/neuter.

## 3. Think outside the hutch, and inside the house.

Rabbits that live outdoors are susceptible to disease, insects and predators such as coyotes and hawks, not to mention extreme weather. Most importantly, bunnies are very social pets and you’re much less likely to get to know your bunny’s unique personality if he/she is always outside.

## 4. Choose appropriate housing.

Rabbits should be kept in a minimum of a 4×4 space on the floor without a wire bottom. OHRR recommends using a 4×4 exercise pen, which can be purchased at the Hop Shop. Many rabbit parents give their bunny full ownership of an entire bedroom or even the house.

## 5. Bunny-proof your house.

Protecting all loose cords, covering baseboards and ensuring houseplants, remote controls, and even your favorite snacks are out of reach is a good start.

## 6. Bunnies will use a litter box.

Rabbits prefer to do their business in one place, so they are easily litter box trained. Use a paper based litter in the box, such as Yesterday’s News, CareFresh or even shredded newspaper. Alternatively, you can use pelleted horse bedding (kiln dried pine or aspen) or wood stove pellet. Never use non-kiln dried pine- or cedar-based litter. It can damage the bunny’s respiratory system.

## 7. Don’t forget to play!

Bunnies need exercise and stimulation. Giving your bunny at least an hour outside of their space to run and play is essential. Also, make sure your bun has a variety of safe toys to toss, chew or dig!

## 8. A bunny’s diet is essential.

Rabbits should be fed a diet of limited pellets, unlimited hay and a daily salad. Treats should be given on a limited basis such as a teaspoon of carrots, bananas or raisins per 2 pounds of body weight. Giving a daily treat can be a good indicator of your bunny’s health — if she doesn’t come out begging for treats then you know something isn’t right! Be careful when purchasing store bought “rabbit treats” as many are not actually good for rabbits.

## 9. Do your research.

Make sure you know about common rabbit illnesses such as GI Stasis and Bloat. Have a plan for emergencies and potentially assemble a rabbit first aid kit. Talk to your veterinarian and check out binkybunny.com and rabbit.org for information.

## 10. Remember, a bunny is a commitment, so enjoy it!

Rabbits can live from 8–12 years. Spend time with your bunny and show your love through kisses and pets. Who knows, your bunny might just return the favor!`,
  },
  {
    slug: 'litter-box-training',
    title: 'Wait, Bunnies Can Be Litter Box Trained? How to Create the Perfect Litter Box, Tips on Training and More!',
    icon: 'sparkles',
    summary: 'The perfect box, safe litters, and how to train — starting with spay/neuter.',
    sort_order: 3,
    source: 'https://www.ohiohouserabbitrescue.org/litterbox/',
    tip: 'A bunny who suddenly stops using the box after a long streak may have a urinary tract infection, bladder sludge, or stones — see a vet.',
    body: `Just like cats, bunnies can be litter trained, which is why so many bunny owners are able to let their buns run free in the house. Most rabbits prefer to do their business in one spot, and so litter training comes naturally.

## The perfect litter box

Ideally, your rabbit should be housed in a 4×4 space without a wire bottom, and so a plastic litter box made for cats should be able to fit nicely. In the Adoption Center, our larger bunnies use low, plastic storage tubs that you can buy at Target or Wal-Mart. Or, some bunny parents use the plastic tray that goes at the bottom of dog crates as an extra large, super low, litter box. This is an especially good option for bunnies that have difficulty climbing into higher boxes due to arthritis or old age.

Litter should cover at least half the box, although some people choose to line the entire box with litter, which works just as well. Paper based litter, such as CareFresh, Yesterday’s News, or even shredded newspaper (made with soy-based ink), is a safe option. Pelleted horse or cat bedding made from kiln-dried pine or aspen — such as Feline Pine — is another affordable option, but the bedding must be kiln-dried to remove harmful phenols and hydrocarbons. Alternatively, in some areas and seasons you can find wood stove pellet, which is also a great option and is very similar to Feline Pine. Many people use a combination of one or more types of litter!

Other types of litter, such as clumping litter, deodorant crystals, corncob litter, or oat- and alfalfa-based litters are dangerous or toxic if ingested, so they should be avoided. Softwood (such as pine- or cedar-based litters) or clay litter can be dangerous if inhaled, so avoid those types as well.

The other half of the litter box should be where you keep your bunny’s hay. You will need to refill this daily, as bunnies need to have a constant fresh supply of hay. Not only will having hay in the litter box encourage your rabbit to get into the box, but it will also encourage them to eat their hay. Believe it or not, rabbits like to have something to munch on while doing their business!

You should clean your bunny’s litter box at least every other day with a safe, non-toxic cleaner such as white vinegar or baking soda. You could also use cleaning products made for animals like Nature’s Miracle. The litter and hay should be disposed of and if you’re using an organic litter it can be composted into an excellent fertilizer.

## How to litter box train

It’s imperative to litter box training that your rabbit be spayed/neutered. Unaltered rabbits with raging hormones will mark their territory with urine, and therefore are not easily litter box trained.

Once your bunny is fixed, the most frequently used training method is to start small. Put the litter box in the bunny’s 4×4 space. If she goes in another area, move the box to that area until she starts using the box. If she still refuses, you may have to temporarily reduce her space until she gets the idea.

After she is consistently using her litter box in her 4×4 space, you can let her out, but only with careful supervision and preferably in a room where you can easily keep an eye on her, like a small bedroom. If she attempts to urinate in a corner or space where there is no box, loudly and sharply tell her “No” and nicely herd her back to her box. You must keep an eye on your bunny until she is completely trained, and never scold her after she has an accident, as it is only effective if you catch her in the act. Never, ever hit your rabbit for any reason — by simply telling your bunny “No!” you are doing enough. Also whenever you see your bunny using the box, make sure to give her lots of praise.

You can continue increasing her free space as she consistently uses the litter box, but make sure to go slowly. If you plan on allowing your bunny to have lots of space, it can be very helpful to have multiple litter boxes, especially if she is able to go up and down stairs.

## A few things to keep in mind

If your bunny is consistently using the litter box for an extended period of time, and then suddenly starts urinating outside the box, it could be a sign of an issue such as a urinary tract infection, bladder sludge, kidney stones or bladder stones. Assuming there are no external stressors, such as a new member of the household, furniture rearranging, unusual visitors in the home, etc., the bunny should be taken to see a vet.

Also, many bunnies will continue to mark their territory with bunny poops even after they are spayed/neutered, especially if there is another bunny in the home. So, if your bunny is pooping small amounts outside of the box, this is completely normal. Fortunately, healthy rabbit poops are hard and dry, and easy to clean up. In addition, if your bunny lives in a 4×4 space, this is generally what she considers her territory, and will not mark outside of that space.

Finally, remember that all bunnies are different and while this method works for most buns, it may not work for yours. If you are struggling with litter box training, please feel free to contact us at OHRR for support and advice!`,
  },
  {
    slug: 'stopped-using-litter-box',
    title: 'Help… My Rabbit Stopped Using the Litter Box!',
    icon: 'info',
    summary: 'An article by Small Pet Select on why bunnies quit the box and how to retrain them.',
    sort_order: 4,
    source: 'https://smallpetselect.com/rabbit-stopped-using-litterbox/',
    tip: null,
    body: `OHRR recommends this article from Small Pet Select for bunnies who used to be reliable and suddenly aren’t.

It walks through the usual reasons a rabbit abandons the litter box — a change in the home or a move, changes to the box itself or where it sits, age (young bunnies have small bladders; adolescents mark territory), and medical issues such as a urinary tract infection — and then how to retrain: put hay in the box, keep boxes near where your bunny eats, temporarily shrink their space with more than one box, and expand their territory again gradually. Above all, be patient: what works for one rabbit might not work for another.

Read the full article on Small Pet Select:

https://smallpetselect.com/rabbit-stopped-using-litterbox/`,
  },
  {
    slug: 'bonding-bunnies',
    title: 'The Art of Bunny Dating: Tips for Bonding Bunnies',
    icon: 'users',
    summary: 'OHRR bonding expert Amy Shears’ tips and tricks — plus what to do when dates go badly.',
    sort_order: 5,
    source: 'https://www.ohiohouserabbitrescue.org/bondingbunnies/',
    tip: 'Never reach into a fight with bare hands — keep a broom, spray bottle, or gloves on hand, and pet both bunnies on top of the head, never near the mouth.',
    body: `If you have been working on bonding two of your bunnies for a while, or you would like to know more about what it takes to bond two bunnies, one of OHRR’s Bonding Experts, Amy Shears, has created a handy list of tips and tricks for bonding bunnies.

## Before you start

- Both rabbits should be spayed/neutered. The strong hormones in unaltered bunnies can cause aggressive and/or sexual behavior. After they are spayed/neutered you will want to wait a few weeks before starting the bonding process because it can take some time for the hormones to get out of their systems.
- It is always best to let your rabbit choose who they want to live with. The bonding process will be a lot easier if you let them pick their own bunny buddy!
- You should let your bunny meet 2–3 rabbits during the dating process. This will allow you to compare how all the dates went. Although male-female bonding is usually the easiest, female-female and male-male could also work. Bonding is about personality and not about the size or breed of the potential friend!

## Setting up at home

- When you take your new bunny home, set their x-pens next to each other about 3 inches apart. You don’t want them to be able to bite and injure one another because the pens are too close.
- Place their food on the sides of the pen closest to the other bunny. It is good for them to see each other while they are eating.

## The dates

- In the beginning, you should always start in a neutral area to do the dates. The bathtub works well because it is slippery, so it is hard for them to get good footing to fight, and it is easy to slide one away if they start nipping. You don’t want to put them into a place where they can start fighting and you can’t get to them.
- When you put the bunnies together, always have something on hand to stop a fight: a broom, a spray bottle filled with water, something that will make a loud noise, or gloves for your hands. Never reach in to stop a fight without protecting your hands.
- Nipping will most likely happen at some point during the bonding process. It is normal and isn’t always a negative action. Sometimes a rabbit will nip the other because they want him/her to groom them.
- Petting both bunnies during the bonding process helps to keep them calm. Keep your hands on the top of their heads and not near their mouths so you don’t get nipped yourself!
- Don’t give the bunnies anything “territorial” during their dates such as a litter box, hidey boxes or food. As you move forward, slowly add these items — always two litter boxes, two hidey boxes, and two food bowls. Hidey boxes should have separate entrances and exits so one bunny can’t corner the other.
- Bonding sessions may only last about 10–15 minutes at first. That is okay. You can slowly increase the time until they can spend hours together.
- At first, you should always be with the bonding pair. Then you will start to feel comfortable leaving them for a few minutes, and then a little longer. Always stay in earshot, and never leave them if they are still having issues when you are there.

## Setbacks are normal

- Bunnies have bad days too. You may feel like everything is progressing great and then you have a bad date. That is normal.
- Moving to the next stage (for example, from the bathtub to an x-pen in the living room) can feel like a step backwards. Hang in there!
- The amount of time it takes to bond each pair is different because every bunny is different. It can take months before you have them living together. That doesn’t mean you are doing anything wrong.
- Mounting is one way bunnies establish dominance, and it isn’t always the male. Pet the submissive (bottom) rabbit to keep him/her calm, wait a few seconds, then gently pull the dominant (top) bunny off. If the submissive bunny won’t tolerate it even for a few seconds, pull the dominant bunny off immediately, as it could lead to a fight.
- It is normal for rabbits to mark during the bonding process — pooping along the pen closest to the other bunny is their way of saying “This is mine.” Once they are bonded, marking will stop.
- Trust your instincts. You will know when they’re ready to move to the next bonding stage.

## Help! My bunnies are fighting and I don’t know what to do!

Suggestions for a difficult bonding process:

- Stress bonding: when you put two bunnies in a stressful situation, they will lean on each other for comfort. Take them for a car ride together in a laundry basket or box (two people — a driver and someone to watch the bunnies), set them in a basket on top of the washing machine on the spin cycle, run the vacuum nearby, carry them around the house together, or take them for a walk in a pet stroller. Afterwards, put them back in the usual dating spot to see how they do.
- Try a different bonding area. If you are using the bathtub, try the kitchen. Try smaller areas and bigger areas.
- Rub banana on their noses. They will lick it off and the other bunny will think they are grooming them.
- Switch the bunnies’ enclosures (or just swap litter boxes, toys, bowls, and hidey boxes) so they get used to each other’s smells and learn that an enclosure isn’t “theirs.”
- Give both bunnies separate time out to run around before a date, so they are relaxed and not interested in fighting.

OHRR offers free bunny matchmaking at the Adoption Center — see Adopt in this app for what to expect when you bring your bunny in for a date.`,
  },
  {
    slug: 'top-ten-reasons',
    title: 'Top Ten Reasons To Bring a Bunny Into Your Life',
    icon: 'heart',
    summary: 'Eco-friendly, long-lived, apartment-friendly, entertaining — and wonderful companions.',
    sort_order: 6,
    source: 'https://www.ohiohouserabbitrescue.org/bunnies-top-ten/',
    tip: null,
    body: `February is Adopt-a-Rabbit month, so we thought we would share with you our top ten reasons to add a bunny to your home. If you have been considering a rabbit as a pet, or considering a friend for your current rabbit, maybe now is the time!

## 10. They’re eco-friendly.

Bunnies love recycled toys like toilet paper rolls stuffed with hay, used cardboard boxes with a door cut out, or even an old phone book for digging. You can compost their entire litter box if you use a natural litter, and you can grow herbs and greens for them right in your backyard!

## 9. Your bunny will be with you for a long time.

Believe it or not, bunnies can live up to 10–12 years. That means you’ll have lots of time to spend with your new friend.

## 8. Allergic to dogs and cats? Try a bunny!

Some people who are allergic to dogs and/or cats are not allergic to bunnies. They’re a great alternative companion!

## 7. Petting a bunny reduces stress.

There are quite a few scientific studies demonstrating that just watching an animal reduces cortisol, the stress hormone, and increases serotonin, the happy molecule. Snuggling up with a bunny can even lower blood pressure!

## 6. They’re great in apartments.

They only need a minimum of a 4×4 space to live in during the day, with some time to roam free in the evenings. Plus they’re quiet enough not to bother the neighbors. You won’t ever have to take them out for walks, and you don’t need a backyard to let them run around in.

## 5. Compared to dogs or cats, they’re fairly low-maintenance.

Bunnies don’t need to go for walks and they can be litter box trained. Although they do need to visit the vet for regular care and they are not a “starter pet” for children, they are pretty easy to care for!

## 4. They want to play when you do.

Bunnies are “crepuscular”, meaning that they’re most active in the mornings and evenings. That means bunnies are the most playful in the evenings when you get home from work!

## 3. Bunnies are entertaining.

Have you ever seen a bunny binky? It’s not only amazing, it’s adorable too. Bunnies are intelligent; they can learn tricks and play games. It’s even more fun if you adopt two!

## 2. They may be small, but they have BIG personalities.

Bunnies can be sweet, friendly, sassy, energetic, goofy and a little bit of everything. You’ll be surprised at how much personality, attitude and spunk your bunny will have!

## 1. Bunnies make wonderful companions.

They will make you smile when you’re down, they will listen when you need to talk, and they’ll snuggle you when you need a friend. Who knows? You may even get a few kisses!

Whatever reasons you have, bringing a bunny into your home can be a wonderful and rewarding experience. And choosing to adopt a bunny gives a homeless bunny a forever home. If you are hoping to add a bunny or two to your life, stop by the Ohio House Rabbit Adoption Center and our volunteers will help you find your new, furry friend!`,
  },
  {
    slug: 'spay-neuter',
    title: 'Spay/Neuter: It’s More than Population Control',
    icon: 'heart',
    summary: 'Calmer bunnies, easier litter training, no reproductive cancers, and successful bonding.',
    sort_order: 7,
    source: 'https://www.ohiohouserabbitrescue.org/spayneuter/',
    tip: 'Every OHRR rabbit is already spayed or neutered before adoption.',
    body: `Although many people know about the risks and benefits of spaying/neutering their dogs and cats, some don’t realize that you can also spay/neuter your bunny! Luckily, groups like Ohio House Rabbit Rescue and House Rabbit Society Chapters are making an effort to change the way people think about spay/neuter for bunnies, and we’re able to connect rabbit owners with experienced veterinarians to do the surgery.

## Best for your family

Spaying/neutering your bunny is one of the best choices that you’ll make for your family. Because they no longer have the urge to mate, altered rabbits tend to be calmer and less aggressive than unaltered rabbits. That means more petting, snuggling and bunny kisses!

## Best for your house

Altered bunnies are less prone to destructive behavior such as chewing and digging, and they’re much easier to litter train. Also, unaltered male rabbits will spray to mark their territory, a nasty habit that can be avoided.

## Best for your bunny

Unaltered rabbits are prone to certain reproductive cancers, and the risk of getting these cancers is virtually eliminated by spaying/neutering. Also, while it’s almost impossible to bond an unaltered rabbit due to sexual/aggressive behaviors, spaying/neutering allows bunnies to be successfully bonded to a new bunny friend.

## Best for the future

Spaying/neutering ensures that you and your bunny won’t be responsible for unwanted litters of rabbits, meaning you won’t be contributing to the problem of bunny overpopulation.

Looking for a vet who does rabbit spays and neuters, or a low-cost option? See Find a vet in this app.`,
  },
  {
    slug: 'digging-and-chewing',
    title: 'Staying Friends with your Bunny: How to Deal with Bunnies that Dig and Chew',
    icon: 'home',
    summary: 'Teach, block, and redirect — chewing and digging are natural; aim them at the right things.',
    sort_order: 8,
    source: 'https://www.ohiohouserabbitrescue.org/diggingandchewing/',
    tip: 'If you know your bunny will dig and chew things you don’t want them to, don’t leave them in their play area unsupervised.',
    body: `Rabbits like to chew and dig. We found that out with our first pair of bunnies in an apartment. Luckily for us, the damage was minimal and our furniture was largely hand-me-down or thrifted. Below are tactics we’ve learned to deal with a digging and chewing bunny.

People commonly live with their house rabbits either keeping them in a 4×4 or larger pen during the day, with daily exercise time in a bunny-proofed area, or giving them permanent access to a room or portion of the house. Your living arrangement choice will dictate what tactics below are most effective — and necessary — for you.

Chewing and digging are natural for rabbits. The key is to redirect the behavior away from the items you want to keep intact and towards acceptable chew and dig-ables. That takes three major steps:

- Teach your rabbit what they are and aren’t allowed to chew and dig
- Block access to areas and objects that are just too tempting to resist
- Give bunny toys he is allowed to use to chew and dig

## Teaching “not that”

Speak bunny language. If you’re across the room, you can clap or thump to get his attention and let him know something’s up and that you don’t like his behavior. You can then walk up to him and put something that he is allowed to chew in front of his nose. We find toilet paper rolls very effective in this role.

## Common targets — and removing temptation

You’ll find that many of these temptations are what “bunny proofing” is all about. Bunny proofing is essential to a happy human-rabbit relationship. Take the time to bunny proof — it saves a lot of heartache!

- Baseboards: interesting and chewable, located at right about bunny’s nose level. If your bunny has permanent access to a room of their own, protect the baseboards with wooden boards or plastic.
- Wires: first choice is not to have them in the bunny-occupied area, second is to block access (think behind an entertainment center), third is to encase them in plastic tubing (Critter Cord) and block access as best as possible. Remember your “temporary” cords too: chargers, game controllers, etc.
- Carpet: bunnies particularly like to dig or chew at irregular portions of carpet. A tightly woven carpet works best, ideally with the edges outside of the rabbit’s reach. Shag carpet is a poor choice, both for the carpet and the rabbit’s digestive system. Area rugs work nicely.
- Furniture: legs and cushions are subject to chewing, and rabbits may dig at cushion seats or tunnel into upholstered pieces from below. Remove it from the room or protect it.
- Corners and enclosed spaces: rabbits are prone to chewing and digging in corners and confined areas. Block access — or put the litter box in that tempting corner, where they can safely dig and munch hay.

Finally, if you know your bunny will dig and chew items you don’t want them to, don’t leave the rabbit in his play area unsupervised. They usually know what they are and aren’t allowed to do once you’ve taught them, and typically won’t do it under your watchful eye.

## Toys for chewing and digging

- Cardboard boxes, which can also double as hidey-holes. Products like the Cottontail Cottage are available if you want something prettier. If your rabbit digs while in boxes, place cardboard, a blanket or a sacrificial carpet scrap under the box.
- Toilet paper and paper towel rolls, cereal boxes, paper bags — stuff them with hay and you can occupy your rabbit for quite some time.
- A box full of shredded paper or child-safe play sand for diggers.
- Willow or twig chews. Make sure any branches are non-toxic to rabbits and free of pesticide sprays.
- Commercial bunny and small animal toys — your bunny is just as likely to enjoy the free recyclables, but you may prefer the aesthetics.

Your bunny will always dig and chew. The goal is to get him to dig and chew what you consider to be appropriate, so that he won’t be interested in the rest of the house. And yet another benefit of adoption: the volunteers at adoption sites usually know who digs and chews more than the average rabbit, and can help you pick a bunny more appropriate for your home.`,
  },
  {
    slug: 'diy-bunny-toys',
    title: 'Do-it-Yourself Bunny Toys',
    icon: 'sparkles',
    summary: 'Cardboard, paper, fleece, willow, pinecones — and you. Cheap toys your bunny will love.',
    sort_order: 9,
    source: 'https://www.ohiohouserabbitrescue.org/diy-bunny-toys/',
    tip: 'Remove all adhesives and covers from cardboard and phone books, and only use untreated pinecones and willow.',
    body: `By Rebecca Allen

A rabbit is never happier than when he is playing! While there are many toys available at pet stores, it is not necessary to spend a lot of money to entertain your rabbit. Many of the components you need to keep your bunny busy are probably already available to you at home!

## Know your bunny’s play style

Most rabbits enjoy digging and chewing. These are ingrained, instinctual behaviors that are beneficial for the wild bunny. Many buns also enjoy tossing objects around. An ideal toy would engage a rabbit in at least two of these behaviors. Take some time and observe your rabbit. What are his go-to play behaviors? Tailor your toys accordingly.

## Bunny-safe materials for play

- Cardboard — a must-have material for any rabbit owner. As long as any adhesives are removed, it is a very safe material for rabbits to chew and “redecorate.” Cut out doors so your bun can hop through (at least two entrances so your bunny feels safe), use boxes as platforms, fill them with paper or hay for digging, put a large cardboard tube behind the couch as a tunnel, or stuff toilet paper rolls with hay.
- Paper — Kraft paper or newspapers let your rabbit rip, dig and destroy safely. Plain Kraft paper is safe; most newspapers use soy-based inks and are also safe, provided your bun is not an avid paper eater. Fill boxes with paper for burrowing, or crumple paper into a ball to toss.
- Blankets / polar fleece — polar fleece is the only safe fabric for buns, because the fibers are short enough that they will not cause digestive problems. Pile it up for digging, tie knots to chew, or cut strips into a fluffy ball to toss.
- Phone books — use under supervision only. Remove the front and back covers and make sure your rabbit does not eat the adhesive on the spine.
- Pinecones (untreated — please use caution!) — bunnies love to chew and toss them, and they wear down teeth.
- Willow baskets (untreated — please use caution!) — great to nose around, hold treats, and chew. You can find them at home décor stores or at the Ohio House Rabbit Adoption Center Hop Shop.
- Repurposed toddler toys — hard plastic teething toys (especially teething keys) and wooden letter blocks are great for chewing and tossing.

## You

You are the best toy your rabbit can have. Spend time down on the floor with your bun! Play peek-a-boo on the other side of a cardboard box; pile and dig on blankets with him; gently toss him a set of toddler keys. Sometimes it takes bunnies a little while to warm up to a toy — leave it where your bun can investigate it thoroughly, and model how to play with it. Talk to him, pet him, and communicate with him through play. Your relationship will deepen and your bunny will be quite content.`,
  },
  {
    slug: 'cost-of-a-house-rabbit',
    title: 'How much does having a house rabbit really cost?',
    icon: 'info',
    summary: 'Binkybunny.com breaks down the real cost of a house rabbit.',
    sort_order: 10,
    source: 'https://www.binkybunny.com/BUNNYINFO/tabid/53/CategoryID/4/PID/940/Default.aspx',
    tip: 'Rabbits live 8–12 years, and vet care for an exotic pet is the biggest variable — budget for a yearly wellness check and an emergency fund.',
    body: `OHRR points prospective bunny parents to Binkybunny.com, which breaks down what having a house rabbit really costs — the one-time setup and the ongoing supplies and care that add up over a rabbit’s 8–12-year life.

Before you adopt, plan for the essentials OHRR requires of every home: a minimum 4 ft × 4 ft indoor space (an exercise pen), a litter box and paper-based litter, unlimited grass hay, limited high-quality timothy pellets, a daily fresh salad, and yearly wellness checks with a rabbit-experienced vet. Two bonded rabbits are generally not more expensive than one — pellets, hay, greens and litter for two put little additional strain on the budget; the exception is medical care.

OHRR’s current adoption fees are $60 for a single rabbit and $75 for a pair (Adoption Policy, revised January 2022).

Read the Binkybunny.com breakdown here:

https://www.binkybunny.com/BUNNYINFO/tabid/53/CategoryID/4/PID/940/Default.aspx`,
  },
  {
    slug: 'bunny-living-space',
    title: 'Bunny Living Space',
    icon: 'home',
    summary: 'What to set up before you bring your bunny home — space, bowls, litter, toys and bunny-proofing.',
    sort_order: 11,
    source: 'https://www.ohiohouserabbitrescue.org/i-want-to-learn/bunny-living-space/',
    tip: 'Worried about “marking”? A 50/50 mix of distilled white vinegar and water in a spray bottle completely eliminates urine spots and is safe for the bunny.',
    body: `So, you’re ready to adopt a bunny and you need to prepare their living space. You may not know where to start, but we can help!

Many of the items you’ll need are available in our Hop Shop. If we’re out of stock or you’d prefer to purchase them elsewhere, we can assist you with information on where they can typically be purchased.

## Before you bring your bunny home

- In addition to housing items, you’ll also want litter, pellets, hay, and greens. See the bunny diet and litter box guides in this app.
- We do not advise bunnies use water bottles. They are messy and bunnies have difficulty drinking from them. There are some special cases in which your adoption coordinator may advise using them for medical reasons.
- Our housing requirements are a minimum 4 ft × 4 ft of indoor space in a location where the bunny is part of the family, can receive regular attention, and continue to be socialized. The bunny should also get out of the 4 ft × 4 ft space for regular exercise. We do not permit small cages, outdoor hutches, or wire bottom cages.
- Many of our adopted bunnies live in free roam homes, or have an entire room for themselves. This is great for the bunnies! However, we do advise “bunny proofing” your home or room by protecting exposed wires and cords with products such as Critter Cord or split wire loom tubing. This will keep your bunny and electronics safe!
- Providing your bunny with plenty of toys, that are regularly alternated, will keep them entertained and help prevent them from being destructive in other areas. Typically, when bunnies are chewing or destroying objects that are not theirs, it’s because they don’t have enough toys to chew.
- Unfortunately, many pet stores sell bunny toys that are labeled as safe, but are not actually safe. Stay away from things with nuts, seeds, and corn. If you are unsure of the safety, it is better to avoid it. For safe toy ideas try binkybunny.com, smallpetselect.com, our Wish List, or the DIY bunny toys guide in this app.
- Keep houseplants out of reach. They are poisonous to bunnies!

## Pro tip

Worried about your bunny “marking” their new space with urine? A mixture of 50% distilled white vinegar and 50% water in a spray bottle will completely eliminate urine spots on floors, carpets, and rugs. The mixture is safe for the bunny. You can also use this spray along with dish soap and warm water to clean your bunny’s litter box.`,
  },
  {
    slug: 'tips-for-catching-a-stray',
    title: 'Tips for Catching a Stray',
    icon: 'mappin',
    summary: 'Domestic or wild? How to keep a stray nearby, catch it safely, and who to call.',
    sort_order: 12,
    source: 'https://www.ohiohouserabbitrescue.org/i-want-to-learn/tips-for-catching-a-stray/',
    tip: 'Babies cannot survive without their mother and should never be rescued without their mom.',
    body: `## Domestic or wild?

Ohio House Rabbit Rescue is frequently contacted by Good Samaritans about rabbits found outdoors in their yard, neighborhood, etc. The first thing to do is figure out if the rabbit is wild or domestic. If the rabbit does not look like a wild cottontail, then it is a domestic rabbit. If you’re still unsure, Small Pet Select has a helpful article on wild bunnies vs. pet bunnies: https://smallpetselect.com/pet-bunny-vs-wild-rabbit/

If you need help with a wild rabbit that may be injured or in danger, please contact the Ohio Wildlife Center: https://www.ohiowildlifecenter.org/wildlife-emergency/

If it is indeed a domestic rabbit that you’ve found outdoors, then it will need to be rescued as it does not possess the means for survival in the wild. Occasionally a domestic rabbit may escape an outdoor enclosure, but in most cases domestic rabbits are found outdoors after being intentionally “set free” by their previous owner, and they need your help. The first thing you should do is contact your local rabbit rescue with:

- The location of the rabbit
- The time of day you saw the rabbit
- How long you have seen the rabbit (days, weeks, etc.)
- The color and approximate size of the rabbit

Chances are that your local rescue is entirely volunteer based and may not be able to get someone out to the site immediately. This is where you can help!

## Keep the rabbit coming back

At the very least, leave some water and food in the area where you saw the rabbit to keep them in that general location for whenever volunteers are able to make it out to the site. Green leaf or romaine lettuce along with a few baby carrots or slices of banana should keep the rabbit coming back. If possible, try and refresh the food and water on a daily basis. Rabbits are creatures of habit and will keep a daily routine as long as food and water are available to them along their route.

## Catching a stray rabbit

If you’re able and willing to try and catch the rabbit yourself, then the best time to attempt a rescue is early morning or late evening when rabbits are generally most active. If you do not see the rabbit, try looking under porches, cars, etc. as they tend to hide and rest most of the day.

Some rabbits, if they were socialized and have not been outdoors long, will let you slowly approach and pick them up or entrap them. Other rabbits may only let you get within about 10 feet before they will run off. It’s important to know how skittish the rabbit that you’ve found is so that you can figure out the best approach to catching it. If the rabbit appears trustworthy and allows you to get within a couple feet, then you can try tossing a large box or laundry basket over them. If the rabbit is very cautious and won’t allow you to get close enough, then try one of the methods below. Most importantly, be patient! A rabbit will be easier to catch once it begins to trust you and associate you with food.

- Exercise pens are what our volunteers use to catch abandoned rabbits. The more exercise pens the better, and a few extra helping hands will definitely make your job easier. You can try encircling the rabbit using the exercise pens — this works best when they are cornered or hiding under an object. Your other option is to set up the exercise pen(s) in a half circle at least 10 feet from the rabbit and attempt to coax them from the opposite side into the enclosure. Once they are safely inside, work quickly to fully close the gap.
- Live traps are often unsuccessful and should only be used if they will be checked at least twice daily (morning and evening). More times than not our volunteers catch other animals, such as opossums and raccoons, instead of the rabbit. Please be willing and able to safely release any wildlife that may become trapped. Place the trap in the shade if possible and out of plain sight, and line the bottom with hay, lettuce, and treats to lure them.

## Once you’ve caught the rabbit

You will want to have a place to temporarily contain the rabbit. The easiest thing to have on hand is a pet carrier or crate. Just make sure the bottom is lined with newspaper or an old towel to prevent the rescued rabbit from slipping. Contact your local rabbit rescue or Humane Society about your recent capture. They should be able to provide recommendations in terms of care until they are able to work out a date and time for the surrender of the rabbit.

Note: Occasionally, multiple rabbits of opposite genders may be abandoned at once or a nest of domestic babies may be found. These situations are more difficult and should be handled with extreme care. Remember, babies cannot survive without their mother and should never be rescued without their mom.

In Columbus, report a stray to the CHRS Help Line at chrstipline@gmail.com — see “Found a rabbit?” in this app for the field-rescue path and OHRR’s admissions policy.`,
  },
]
