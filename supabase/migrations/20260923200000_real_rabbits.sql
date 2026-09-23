-- =============================================================
-- OHRR — the real adoptable rabbits
--
-- 17 rabbits exactly as OHRR lists them today on RescueGroups.org, the
-- listing ohiohouserabbitrescue.org/adopt/adoptable-bunnies/ shows (and that also
-- feeds Petfinder and Adopt-a-Pet): April, Dan, Dory, Edmund, Eloise, Forrest, Helen, Henry, Leo, Mara, Monty, Muggsy, Nimbus, Nimbus, Pierce, Rainey, Sky.
--
-- Written by scripts/rescuegroups-rabbits.py. Each rabbit keeps its RescueGroups
-- id in `source_id`, so running this again adds only rabbits that are new and
-- never touches one staff have already edited. Photos are OHRR's own listing
-- photos, linked from RescueGroups; staff can change them in Staff -> Adopt.
-- Bonded pairs are two rows marked bonded, each naming the other. Every rabbit
-- is marked spayed/neutered because OHRR's adoption policy says all are.
--
-- Once rabbits are in this table, the app and the website show them instead of
-- the sample rabbits. Idempotent.
-- =============================================================
alter table rabbits add column if not exists source_id text;
create unique index if not exists rabbits_org_source_uidx on rabbits (org_id, source_id);

do $$
declare
  v_org uuid;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then return; end if;

  insert into rabbits (org_id, source_id, name, status, sex, age, breed, size, spayed_neutered,
                       house_trained, bonded, description, tags, photos, sort_order, is_published)
  values
    (v_org, $t$rescuegroups:19140503$t$, $t$April$t$, $t$Available$t$, $t$Female$t$, $t$Adult$t$, $t$Californian$t$, $t$Medium$t$, true, true, true, $t$Meet April and Pierce, a wonderful bonded pair looking for a forever home they can truly call their own. Pierce first came to OHRR after being rescued as a stray in 2021. He was eventually adopted and later bonded with the lovely April. Sadly, through no fault of their own, the pair recently found themselves back at the Center.

Despite the unexpected changes in their lives, April and Pierce have remained devoted to one another. Their bond is undeniable, and they provide each other with comfort and companionship every step of the way. Watching them interact is a wonderful reminder of just how special bonded rabbits can be.

The two complement each other perfectly. April is sweet, gentle, and laid back, happy to relax and take life at her own pace. Pierce is the playful one, always ready to investigate his surroundings and confidently lead the way. Together, they make the perfect team and must be adopted together.

April and Pierce are hoping their next home will be their last—a place where they can enjoy the stability, love, and security they deserve for the rest of their lives. If you're looking for a pair of adorable companions who already share an incredible bond, April and Pierce would love to meet you.$t$, array[$t$Adopted together with Pierce$t$], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/19140/19140503/93325257.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/19140/19140503/94002243.jpg$t$], 10, true),
    (v_org, $t$rescuegroups:22283159$t$, $t$Dan$t$, $t$Available$t$, $t$Male$t$, $t$Adult$t$, $t$Lionhead$t$, $t$Small$t$, true, true, true, $t$Meet Dan and Forrest, two absolutely adorable white lionhead boys with the sweetest faces and even sweeter hearts. These best buddies were originally found on the side of a rural road and later lived in an outdoor hutch for about a year and a half before finally making their way to OHRR.

When they arrived at the Center, it was clear that Dan had suffered a leg injury that could not be repaired. After careful evaluation by our vet, it was determined that the best way to relieve his pain was to amputate the injured hind leg. Dan’s surgery went well, and he has regained mobility, but losing one hind leg places additional stress on his remaining back leg. Because of this, Dan will require lifelong supportive care. In addition to pain medication, this may include treatments such as laser therapy to help manage inflammation and discomfort while keeping Dan mobile. We are happy to share recommendations for local veterinarians who can provide this care for a committed adopter. In return, we ask that the adopter be local to the central Ohio area.

Forrest, thankfully, is healthy and injury-free - but he absolutely adores his little buddy Dan. Their bond is strong, and they provide comfort and companionship to one another. For that reason, they must be adopted together. Forrest helps keep Dan confident and happy, and Dan returns the love in full.

Dan and Forrest are incredibly sweet, affectionate boys, but they will require either an experienced special-needs bunny parent or someone willing to learn and commit to Dan’s ongoing care. They may need a little extra effort, but they will reward the right home with love and devotion.$t$, array[$t$Special needs$t$, $t$Adopted together with Forrest$t$], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22283/22283159/103429593.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22283/22283159/102717959.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22283/22283159/102717960.jpg$t$], 20, true),
    (v_org, $t$rescuegroups:22640155$t$, $t$Dory$t$, $t$Available$t$, $t$Female$t$, $t$Adult$t$, $t$Florida White$t$, $t$Medium$t$, true, true, false, $t$Meet Dory, a gorgeous white bunny with a playful personality and lots of love to give. Dory was originally adopted but recently returned through no fault of her own. Now she's looking for a home that's the right fit for her personality and needs.

Dory lived in a home with several children and began nipping when they interacted with her. Rabbits are prey animals by nature and generally do not enjoy being picked up or handled frequently. It's likely that Dory was simply trying to communicate that she was uncomfortable. Like many rabbits, she prefers to keep all four feet on the ground and appreciates people who understand and respect rabbit body language.

Don't let that fool you into thinking Dory isn't social—quite the opposite! She is an active, curious, and friendly bunny who enjoys interacting with people. She loves exploring, being part of the action, and spending time with those who understand how rabbits communicate. When her boundaries are respected, Dory is a wonderful companion with a fun and engaging personality. She is quite funny and curious!

Dory is looking for a rabbit-savvy home—or one eager to learn about proper rabbit handling—where she can thrive. She would do best with a family that understands that affection doesn't require picking a bunny up, and that earning a rabbit's trust is one of the most rewarding experiences there is. In the right home, Dory will make an incredible companion for many years to come.$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22640/22640155/103511466.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22640/22640155/103511477.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22640/22640155/103511492.jpg$t$], 30, true),
    (v_org, $t$rescuegroups:22789280$t$, $t$Edmund$t$, $t$Available$t$, $t$Male$t$, $t$Adult$t$, $t$Holland Lop$t$, $t$Medium$t$, true, true, false, $t$Meet Edmund, an approximately one-year-old Lop with an adorable face and a whole lot of life ahead of him.

Edmund came to OHRR through our owner surrender waitlist after his family found that they could no longer give him the care and attention he needed while raising a toddler and a baby. Now Edmund is ready for a fresh start and the chance to find a family where he can once again be a cherished member of the household.

At just one year old, Edmund is still a young bunny with so much to discover. He is settling into life at the Center and getting to know the people around him while he waits for his next chapter to begin.

We always want families to remember that bringing a bunny home is an approximately 10–12 year commitment. Rabbits are part of the family, even as life changes and families grow, and they deserve to have a loving home for all of their years.

We hope Edmund’s next home will truly be his forever home—a place where he can be loved, cared for, and appreciated for the wonderful bunny he is. He has so much life ahead of him, and we can’t wait to see him find the family he deserves.$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22789/22789280/103852499.jpg$t$], 40, true),
    (v_org, $t$rescuegroups:22527782$t$, $t$Eloise$t$, $t$Available$t$, $t$Female$t$, $t$Adult$t$, $t$Silver Marten$t$, $t$Small$t$, true, true, false, $t$Meet Eloise, a gorgeous Silver Marten bunny with a big personality and a zest for life. This striking girl was found abandoned in someone's driveway, left to fend for herself until a kind person stepped in to help.

Despite her difficult start, Eloise hasn't let her past dampen her spirit. She is spunky, playful, and always ready for an adventure. Whether she's exploring her surroundings, tossing toys, or showing off her playful side, Eloise knows how to keep life interesting.

Eloise does have some ongoing dental needs, likely the result of not receiving enough hay in her previous environment. If you are interested in adopting Eloise, OHRR can work with you to help ensure her dental needs continue to be properly managed.

With her stunning looks, lively personality, and resilient spirit, Eloise is ready to find a forever home that will give her the love, care, and playtime she deserves.$t$, array[$t$Special needs$t$], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22527/22527782/103260325.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22527/22527782/103260326.jpg$t$], 50, true),
    (v_org, $t$rescuegroups:22283157$t$, $t$Forrest$t$, $t$Available$t$, $t$Male$t$, $t$Adult$t$, $t$Lionhead$t$, $t$Small$t$, true, true, true, $t$Meet Dan and Forrest, two absolutely adorable white lionhead boys with the sweetest faces and even sweeter hearts. These best buddies were originally found on the side of a rural road and later lived in an outdoor hutch for about a year and a half before finally making their way to OHRR.

When they arrived at the Center, it was clear that Dan had suffered a leg injury that could not be repaired. After careful evaluation by our vet, it was determined that the best way to relieve his pain was to amputate the injured hind leg. Dan’s surgery went well, and he has regained mobility, but losing one hind leg places additional stress on his remaining back leg. Because of this, Dan will require lifelong supportive care. In addition to pain medication, this may include treatments such as laser therapy to help manage inflammation and discomfort while keeping Dan mobile. We are happy to share recommendations for local veterinarians who can provide this care for a committed adopter. In return, we ask that the adopter be local to the central Ohio area.

Forrest, thankfully, is healthy and injury-free - but he absolutely adores his little buddy Dan. Their bond is strong, and they provide comfort and companionship to one another. For that reason, they must be adopted together. Forrest helps keep Dan confident and happy, and Dan returns the love in full.

Dan and Forrest are incredibly sweet, affectionate boys, but they will require either an experienced special-needs bunny parent or someone willing to learn and commit to Dan’s ongoing care. They may need a little extra effort, but they will reward the right home with love and devotion.$t$, array[$t$Adopted together with Dan$t$], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22283/22283157/103429589.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22283/22283157/102717961.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22283/22283157/102717962.jpg$t$], 60, true),
    (v_org, $t$rescuegroups:22789276$t$, $t$Helen$t$, $t$Available$t$, $t$Female$t$, $t$Adult$t$, $t$Lionhead$t$, $t$Medium$t$, true, true, false, $t$Meet Helen, an approximately three-year-old girl who is ready to leave her past behind and start a new chapter with a family who will truly appreciate her.

Helen came to OHRR through our owner surrender waitlist after her former owner went away to college and allergies also became an issue. Interestingly, her former owner had always thought Helen was a boy, but this sweet girl is definitely a little lady!

When Helen arrived at the Center, she had some skin and cleanliness issues that needed attention. She is now getting the care she needs and is looking forward to putting those days behind her. Helen deserves a home where she will be properly cared for, appreciated, and loved for the wonderful bunny she is.

Helen is ready for her fresh start. She is hoping to find a family who understands that rabbits are a long-term commitment and who will cherish her as part of the family for all of her years. We think this sweet girl is more than ready to discover how wonderful her next chapter can be!$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22789/22789276/103852471.jpg$t$], 70, true),
    (v_org, $t$rescuegroups:22757527$t$, $t$Henry$t$, $t$Available$t$, $t$Male$t$, $t$Adult$t$, null, $t$Medium$t$, true, true, false, $t$Meet Henry, a handsome six-year-old guy with a heart as sweet as they come. This special boy has already won the hearts of everyone at the Center, and it’s easy to see why.

Henry came to OHRR after his owner moved out of the country and could no longer care for him. He also has a history of E. cuniculi, for which he was treated at MedVet. As a result, Henry has some residual facial nerve paralysis. The right side of his face is affected, with the left side appearing slightly drawn, and his right ear should be monitored. Our team is happy to provide an adopter with more information about his care and what to watch for, but he appears to be otherwise living life healthily and happily.

But ask anyone who has met Henry, and they’ll tell you that his medical history is just one small part of his story. Henry is an incredibly sweet and gentle guy who seems to have a special way of making people fall in love with him. He is getting to know his new surroundings and all the people who are caring for him, and he has quickly become a favorite.

Henry has spent enough time waiting for his next chapter. Now he’s looking for a loving family who will see the wonderful bunny he is and give him the happy, secure home he deserves. We have a feeling Henry will continue winning hearts wherever he goes!$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22757/22757527/103778665.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22757/22757527/103778669.jpg$t$], 80, true),
    (v_org, $t$rescuegroups:22757500$t$, $t$Leo$t$, $t$Available$t$, $t$Male$t$, $t$Adult$t$, $t$Lionhead$t$, $t$Medium$t$, true, true, false, $t$Meet Leo, an approximately 2-year-old ball of fluff with a heart just as soft as his handsome mane. Leo came to the Center with his brother, Barry, after their mom was taken in by someone who didn't realize she was pregnant. Before long, two adorable brothers arrived and the owner tried to find them a home, but they eventually found their way to the OHRR surrender wait list. Now that they're grown, Leo is ready to begin his own chapter as a single bun.

Leo tends to be the shyer of the two brothers. He likes to take his time when meeting new people and prefers to observe until he's sure that everything—and everyone—is okay. But once Leo decides he can trust you, his sweet personality comes shining through. He's proof that sometimes the best things come to those who are willing to be patient.

And honestly, who could resist a snuggle with this fluffy little guy? Leo has an irresistibly cuddly appearance and a gentle nature to match. Give him a little time to get comfortable, and you'll discover a wonderful companion who is as sweet as he is adorable.

Leo is looking for a loving home where he can continue to build his confidence and be appreciated for the special bunny he is. If you're willing to let this handsome fluffball take things at his own pace, Leo just might steal your heart.$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22757/22757500/103778612.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22757/22757500/103780134.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22757/22757500/103780135.jpg$t$], 90, true),
    (v_org, $t$rescuegroups:22659183$t$, $t$Mara$t$, $t$Available$t$, $t$Female$t$, $t$Adult$t$, $t$American$t$, $t$Medium$t$, true, true, false, $t$Meet Mara, a truly remarkable bunny whose resilience and spirit inspire everyone who meets her. Mara came to OHRR as a rescue transfer from a rescue in Pittsburgh after being found abandoned outdoors with several other rabbits. When she was rescued, Mara was emaciated, pregnant, and unable to keep her balance. Despite everything she had endured, she never gave up.

Over the past several months, Mara has flourished. With proper nutrition, loving care, and plenty of time to heal, she has gained the weight and muscle she needed, and her balance has improved tremendously. She still has a slight wobble when she walks, but don't tell Mara that she's any different-she certainly doesn't believe it!

Mara is curious, outgoing, independent, and absolutely full of life. She approaches each day with excitement and enthusiasm, eager to explore, play, and see what adventures await. Her joyful personality is contagious, and it's impossible not to smile when you watch her happily hopping around. She truly embodies resilience and reminds us every day that life's challenges don't define who we are.

While the exact cause of Mara's wobble isn't known, it is suspected to be the result of residual neurological effects from severe malnutrition, dehydration, or past physical trauma. She simply needs a slightly adapted living space to help keep her safe, but otherwise enjoys life just like any other bunny.

Mara is looking for a family who will see beyond her wobble and appreciate the incredible rabbit she is. In return, they'll gain one of the happiest, sweetest, and most inspiring companions they could ever hope to meet.$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22659/22659183/103554671.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22659/22659183/103554672.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22659/22659183/103555850.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22659/22659183/103555854.jpg$t$], 100, true),
    (v_org, $t$rescuegroups:22789281$t$, $t$Monty$t$, $t$Available$t$, $t$Male$t$, $t$Adult$t$, $t$Holland Lop$t$, $t$Medium$t$, true, true, false, $t$Meet Monty, an approximately one-and-a-half-year-old Lop with an incredibly sweet personality and a whole lot of love to give.

Monty came to OHRR through our owner surrender waitlist after his family found themselves facing allergies and financial challenges that made it difficult for them to continue caring for him. None of that changes what a wonderful little guy Monty is, and now he is ready for a fresh start.

Monty is the sweetest little guy and has a gentle, lovable personality that makes him hard not to adore. He is enjoying getting to know everyone at the Center and is ready to find someone who will give him the time, attention, and affection he deserves.

Monty has so much life ahead of him, and we would love to see that life spent in a loving forever home. If you’re looking for a sweet little companion to add to your family, Monty would love to meet you!$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22789/22789281/103852584.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22789/22789281/103852597.jpg$t$], 110, true),
    (v_org, $t$rescuegroups:22773330$t$, $t$Muggsy$t$, $t$Available$t$, $t$Male$t$, $t$Adult$t$, $t$New Zealand$t$, $t$Medium$t$, true, true, false, $t$Meet Muggsy, an adorable boy who is ready for a fresh start and a family of his very own.

Muggsy came to OHRR as an owner surrender and is now settling into life at the Center while he waits for his next chapter to begin. He is ready to put the past behind him and discover all the wonderful things that come with having a safe and loving home.

Every bunny deserves to be cherished and treated as part of the family, and we hope Muggsy’s next home will be his forever home. He is ready for someone who will give him plenty of love, attention, and all the little things that make a bunny’s life happy.

Muggsy is looking forward to finding his people and starting the next chapter of his life. We think his forever family is going to be pretty lucky to have him!$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22773/22773330/103814796.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22773/22773330/103814795.jpg$t$], 120, true),
    (v_org, $t$rescuegroups:22757534$t$, $t$Nimbus$t$, $t$Available$t$, $t$Male$t$, $t$Young$t$, $t$Florida White$t$, $t$Medium$t$, true, true, false, $t$Meet Nimbus, an adorable little guy who is estimated to be between 6 and 8 months old. With his sweet face and gentle personality, he is already proving to everyone at the Center that he is something pretty special.

Nimbus came to OHRR after being rescued as a stray. Volunteers rescued him along with two other bunnies, believed to be siblings, and made sure they all got somewhere safe. Now Nimbus is ready to leave his days as a stray behind and discover what it’s like to have a loving family of his own.

At his neuter appointment, the veterinarian described Nimbus as a "sweet baby angel," and we would have to agree! He is a gentle, quiet little guy who is simply happy to be around people and is getting to know all the wonderful humans who are caring for him.

Nimbus is still just a baby with plenty of growing and exploring ahead of him, and we think he has all the makings of a wonderful companion. He is ready for a family who will give him the love, attention, and happy home he deserves. We have a feeling this sweet baby angel is going to steal some hearts!$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22757/22757534/103778790.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22757/22757534/103780142.jpg$t$], 130, true),
    (v_org, $t$rescuegroups:22773321$t$, $t$Nimbus$t$, $t$Available$t$, $t$Male$t$, $t$Young$t$, $t$Florida White$t$, $t$Medium$t$, true, true, false, $t$Meet Nimbus, a sweet little guy who is estimated to be between 6 and 8 months old. With his adorable face and gentle personality, Nimbus is enjoying getting to know volunteers at the Center.

Nimbus came to OHRR after being rescued as a stray with other bunnies who had been abandoned outside. These little bunnies were given a second chance when volunteers stepped in to make sure they were safe, and now Nimbus is ready to leave his days as a stray behind and start the next chapter of his life.

As a young bunny, Nimbus is still discovering the world around him and learning that people can be trusted. He has a gentle, sweet nature and is enjoying having a safe place where he can simply be a bunny—eating, exploring, playing, and getting to know his new friends.

Nimbus is looking for a loving home where he can continue to grow, explore, and gain confidence while being surrounded by people who adore him. He has so much life ahead of him, and we can't wait to see the happy, playful bunny he becomes once he knows he is home.$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22773/22773321/103814768.jpg$t$], 140, true),
    (v_org, $t$rescuegroups:19140502$t$, $t$Pierce$t$, $t$Available$t$, $t$Male$t$, $t$Adult$t$, $t$Dwarf$t$, $t$Medium$t$, true, true, true, $t$Meet April and Pierce, a wonderful bonded pair looking for a forever home they can truly call their own. Pierce first came to OHRR after being rescued as a stray in 2021. He was eventually adopted and later bonded with the lovely April. Sadly, through no fault of their own, the pair recently found themselves back at the Center.

Despite the unexpected changes in their lives, April and Pierce have remained devoted to one another. Their bond is undeniable, and they provide each other with comfort and companionship every step of the way. Watching them interact is a wonderful reminder of just how special bonded rabbits can be.

The two complement each other perfectly. April is sweet, gentle, and laid back, happy to relax and take life at her own pace. Pierce is the playful one, always ready to investigate his surroundings and confidently lead the way. Together, they make the perfect team and must be adopted together.

April and Pierce are hoping their next home will be their last—a place where they can enjoy the stability, love, and security they deserve for the rest of their lives. If you're looking for a pair of adorable companions who already share an incredible bond, April and Pierce would love to meet you.$t$, array[$t$Adopted together with April$t$], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/19140/19140502/93325255.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/19140/19140502/94002247.jpg$t$], 150, true),
    (v_org, $t$rescuegroups:22745083$t$, $t$Rainey$t$, $t$Available$t$, $t$Male$t$, $t$Adult$t$, $t$Lionhead$t$, $t$Medium$t$, true, true, false, $t$Meet Rainey, a handsome lionhead estimated to be about 5–6 years old. This sweet boy came to the Center after his former owner was moving and sadly would not take him along. While the transition was difficult for Rainey at first, he's slowly learning that he's safe and cared for.

When Rainey first arrived, he was quite terrified and understandably unsure of his new surroundings. With time, patience, and plenty of gentle encouragement from the volunteers, he's beginning to open up and show more of his personality. He can still be skittish at times, especially when he's unsure of a new person or situation, but we're seeing more and more of his sweet side as his confidence grows.

Rainey would love a calm, patient home where he can take his time getting comfortable and build a relationship at his own pace. The trust of a bunny is something truly special, and we think watching Rainey blossom into his best self will be incredibly rewarding.

Rainey is ready for a fresh start with someone who will give him the time, patience, and love he needs to feel completely at home again. His next chapter is just waiting to begin.$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22745/22745083/103751974.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22745/22745083/103751975.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22745/22745083/103751977.jpg$t$], 160, true),
    (v_org, $t$rescuegroups:22745076$t$, $t$Sky$t$, $t$Available$t$, $t$Female$t$, $t$Young$t$, $t$Florida White$t$, $t$Medium$t$, true, true, false, $t$Meet Sky, a gorgeous ruby-eyed white (REW) bunny with a sweet personality and a whole lot of life ahead of her. Under a year old, Sky is a playful, curious girl who is ready to leave her uncertain past behind and start her next chapter.

Sky was rescued after being abandoned outside as a stray. Caring volunteers were able to bring her and two other bunnies, believed to be her siblings, to safety. Sky has a tattoo on her ear, but it's not the typical tattoo seen in 4-H, so we're not sure exactly where her story began or how she ended up on her own. What we do know is that she's incredibly lucky to have been found.

Sky is as sweet as can be and loves all the important things in life: playing, eating, exploring, and getting to know new people. She's an active, happy girl who is enjoying the chance to discover the world from the safety and comfort of the Center.

Now Sky is ready to find a forever home where she can continue to grow, play, and be loved. She's got plenty of personality packed into her adorable little self, and we can't wait to see what wonderful adventures are ahead for this beautiful girl.$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22745/22745076/103751955.jpg$t$], 170, true)
  on conflict (org_id, source_id) do nothing;
end $$;
