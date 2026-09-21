-- =============================================================
-- OHRR — the last old-site pages, brought in-house as editable articles
--
-- care_articles gains a `section` so the same table (and the same staff
-- editors on the app and the website) hold the Give / About / Adopt pages
-- that used to link out to ohiohouserabbitrescue.org. Learn keeps showing
-- section = 'care' only; everything else is served at /info/<slug> on both
-- the website and the app.
--
-- Bodies are OHRR's own words, copied from the live site on 2026-09-21
-- (light-markdown: blank-line paragraphs, "## " headings, "- " bullets, bare
-- URLs). Staff edit them in Staff → Care guides / Pages.
--
-- Paste + Run in the Supabase SQL editor. Idempotent.
-- =============================================================

alter table care_articles add column if not exists section text not null default 'care';
alter table care_articles drop constraint if exists care_articles_section_check;
alter table care_articles add constraint care_articles_section_check
  check (section in ('care', 'give', 'about', 'adopt'));
create index if not exists idx_care_articles_section on care_articles(org_id, section, sort_order);

do $$
declare
  v_org uuid;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then return; end if;

  insert into care_articles (org_id, slug, section, title, icon, summary, body, sort_order, is_published) values

  (v_org, 'workplace-giving', 'give', 'Workplace Donations', 'gift',
   'Give through your employer — and ask about a match.',
   $body$Many OHRR volunteers and supporters extend their impact for OHRR by giving thru their workplace. We have supporters who give through major Columbus employers such as Chase, Battelle, IBM, Verizon, Nordstrom, Nationwide, and via United Way. Sometimes, that gift (or one you make directly to OHRR) can be matched by your employer, multiplying the impact for the bunnies!

In another example of a way to give, one of OHRR's long-time volunteers, Chris Baker, arranged for OHRR to be the charity of the month as a part of her employer's, (Nexeo Solutions) Great Place To Work group, Chris' colleagues combined to donate $750 to OHRR.

We thank everyone who has given through their workplace and encourage you to look into the possibility!$body$, 10, true),

  (v_org, 'host-a-fundraiser', 'give', 'Host a Fundraiser', 'sparkles',
   'Yard sale, bake sale, benefit concert — tell OHRR your idea.',
   $body$Thank you so much for your interest in helping Ohio House Rabbit Rescue! If you would like to help OHRR by hosting a fundraiser, please contact us at ohrrcontact@ohiohouserabbitrescue.org with your ideas!

Below are some that we've heard in the past:

- Hosting a yard sale
- Bake sales
- Door-to-Door Sales
- Beer/Wine Tastings
- Coin Drives
- Benefit Concert
- Sporting Events
- Wish-List Drive$body$, 20, true),

  (v_org, 'legacy-fund', 'give', 'OHRR Legacy Fund', 'heart',
   'Planned gifts and major gifts — become a Rescue Rabbit Guardian.',
   $body$Thanks to you, we have been able to meet the annual expenses of caring for the bunnies (most notably the expense of vet care). However, we also need to plan for the long-term financial health of our organization, and to do that we are beginning to build an OHRR Legacy Fund. Accordingly, we want to let you know about new opportunities, today or in the future, that will help us build that fund.

Below you will find examples of a range of options outlining how you can make contributions to OHRR and the bunnies. You may want to include OHRR in your estate planning or give a larger one-time contribution to help secure a bright future for OHRR and the rescue rabbits. By naming OHRR in your estate or making a major gift, you will be included in our new donor group – Rescue Rabbit Guardians.

## Make OHRR a beneficiary in a will or trust, or your IRA

By inserting as little as one sentence into your will or trust, you can name OHRR as a beneficiary. Your gift will not affect your current fiscal situation, and you are free to change your plans at any time.

By naming OHRR as a beneficiary of your retirement plan or life insurance, you can make a larger gift than you may have imagined, without letting go of your assets in case you need them.

By including OHRR in your estate planning, you will automatically become a Rescue Rabbit Guardian.

## Make a donation in a variety of ways to support the OHRR bunnies at the Center

A Charitable Distribution or Required Minimum Distribution from your IRA.

Gifts of Appreciated Stock, Bonds or Mutual Funds — make a huge impact through a gift of appreciated assets. Ask your tax professional about possibly avoiding capital gains tax on the securities you donate and receiving a tax deduction.

Start, Continue, or Increase a Monthly Gift to the Bunnies or make a One-Time Contribution — help OHRR fund the on-going costs of care for the rescue rabbits and the Adoption Center that is their home.

Calendar year donations of $1000 or more qualify you to become a member of our Rescue Rabbit Guardians group.

## Rescue Rabbit Guardians

Rescue Rabbit Guardians are a dedicated group of people committed to assuring a bright future for OHRR bunnies – now and for years to come.

Two ways to become a Rescue Rabbit Guardian:

- For the Future – Make a planned gift. Include OHRR in your will or trust, or as the beneficiary of a retirement account.
- For Today – By making an annual donation of $1000 or more, you provide invaluable resources to care for the bunnies right now.

Benefits of membership: Guardians will receive recognition on the OHRR website and at the Adoption Center, will be invited to special events, and will receive other benefits.

If you have already designated OHRR as a beneficiary, or wish to discuss your donation amount, please contact Pat Barron at pbarronosu@aol.com. We look forward to thanking you and recognizing you as a Rescue Rabbit Guardian.$body$, 30, true),

  (v_org, 'license-plate', 'give', 'Drive for the Bunnies – Get Your OHRR License Plate Today!', 'star',
   'The official Ohio House Rabbit Rescue plate: $25 a year supports the rescue.',
   $body$In 2023, we launched the official Ohio House Rabbit Rescue license plate. The process took years and had many steps; including developing a design, gathering signatures of support, and getting a bill passed by the Ohio Legislature approving the plate.

By purchasing our specialty license plate featuring a Dutch rabbit, you're directly contributing to the rescue, medical care, and adoption of our rescue rabbits. We receive a portion of each sale which goes towards supporting the Adoption Center, helping with medical costs, supplies, food, and more.

Our rabbits come from a variety of backgrounds – some are rescued after being abandoned and brought to us by compassionate individuals, while others arrive with signs of neglect or injury. Many have endured difficult lives confined to small cages or hutches. Others were never given the chance to be understood, or the previous person was just not equipped to give the care a rabbit needs and deserves. Every rabbit at OHRR is given a second chance. They each receive a medical exam, spaying/neutering, and their RHDV2 vaccination. We provide comprehensive education to adopters and place all of our bunnies in loving, forever homes.

## Thank you!

We are very grateful to State Senator Beth Liston, who sponsored legislation to create the license plate, to OHRR volunteer Tracy Wiczer who led the effort, and Eli Niswander who designed the plate. Thank you to everyone who supported us along the way, providing signatures, showing support at the State House, and more. All of your efforts made this plate a reality!

## You have two options when buying the OHRR logo plate

- Order the logo plate with randomly assigned letters and numbers – $25 annually for the logo plate + your normal fee.
- Order the logo plate with a personalized 6 letters/numbers of your choice – $25 annually for the logo plate + $50 annually for the personalized message + your normal fee.

## How do I purchase an Ohio House Rabbit Rescue plate online?

- Go to https://www.bmv.ohio.gov
- Choose BMV Online Services, first option on the home page
- Choose "OPLATES"
- Log in and select your vehicle
- Choose to exchange your plates
- Add personalized plate info if you want to choose what your plates say
- Click "Choose logo plate"
- Then, choose "OH HSE RABBIT RESCUE", and check for your desired wording if you are personalizing your plate.
- You will have the option to personalize your plates with 6 letters or numbers. If your choice is available, it will show you a preview of the plate.
- Follow the rest of the prompts and wait approximately 20 business days to receive your plate in the mail.

## Can I order plates in person at the BMV?

At the BMV, you will receive a form to fill out. Give this back to them and you will receive your plate in approximately 20 business days. Be sure to check availability of your chosen wording for personalized plates online before adding it to the form, or ask the BMV employee if your desired wording is available.

## Can I get new plates any time, or do I wait for my registration/birthday?

You can update your plates at any time, but will renew your registration around your birthday. You can of course wait until your birthday and do both, and they will both have their separate process.

## How much does it cost?

The bunny plate logo fee is an additional $25, annually. There are two fees that make up this cost: $15.00 contribution, and $10.00 BMV. The cost for personalized plates is an additional $50 annually. Exchanging plates is $25 for logo plates, plus your annual fees; it is an additional $50 plus fees for personalized plates.

## Can I keep my current plate number and order it with a logo plate?

If your previous plates were system-assigned (not personalized), and you wish to stay with system-assigned plate numbers, you will receive new plate numbers, the old ones will not be used.

## Who is eligible, and which vehicles?

Any Ohio motorist. Passenger vehicles, non-commercial trucks, recreational vehicles, house vehicles, non-commercial trailers, and unconventional vehicles.

## Payment options

- Credit/Debit Card
- PayPal
- Electronic Check

## I am up for renewal and want to get a logo plate. How does that work?

Unfortunately, you can't send in your plate order with the registration form that was mailed to you. Purchasing a logo license plate would be separate and would take about 10 minutes online. Or you can fill out the form at the BMV. Be sure to tell the BMV employee that you want to change your license plate if you go there to renew your vehicle registration. The vehicle registration and license plates are shipped separately.

## Do I need one or two plates?

As of 2020, a change in Ohio law requires only one license plate on the back of the vehicle. Front license plates are free, but optional. Up to 6 letters/numbers fit on the logo plate.$body$, 40, true),

  (v_org, 'kroger-rewards', 'give', 'Link OHRR to your Kroger Community Rewards', 'bag',
   'Link OHRR to your Kroger account and they donate every time you shop.',
   $body$Link OHRR to your Kroger account and they will donate to us every time you shop.

Easily help out the bunnies by making us your Kroger Community Rewards partner. It takes less than a minute and each shopping trip automatically donates to our rescue rabbits at no cost to you. You'll be able to see that it's working by seeing our name towards the bottom of your receipt. Thank you!

Enroll at https://www.kroger.com/i/community/community-rewards — search for Ohio House Rabbit Rescue by name or by our ID number 80631. Don't forget to re-enroll your Kroger Card after April 1!

Please note: Kroger lists charities that are within a certain radius of the Kroger store you choose. If you live outside of Columbus, but you would still like your Community Rewards to go to OHRR, select a store in Columbus as your main store and OHRR will receive the benefits — you don't have to shop at that store!$body$, 50, true),

  (v_org, 'wish-list', 'give', 'Wish List', 'gift',
   'Supplies the bunnies use every day — buy online or drop off at the Center.',
   $body$You may purchase items from the Amazon Wish List and have them sent directly to Ohio House Rabbit Rescue: https://www.amazon.com/hz/wishlist/ls/1C5PQRB5VI51L

## Cleaning Supplies

- Oxiclean Max Force 2 in 1 Stain Fighter with Color Safe Brightener Power Packs (26 count)
- 30-gallon paper lawn and leaf bags
- Nature's Miracle Stain and Odor Remover (Gallon)
- OxiClean Laundry Stain Remover Spray
- Bounty Paper Towels
- Nature's Miracle Hard Floor Stain and Odor Remover

## Bunny Supplies

- Kitty litter boxes (such as the Petmate Litter Pan)
- Sterillite 28 Quart Clear Storage Tubs
- Non-Slip Bath Mats (such as Sleep Innovations Memory Foam Bath Mat (20-inch) or the 2ft X 5Ft Runner)
- Fleece Blankets
- Ceramic Pet Bowls (approximately 5-inches in diameter)
- CareFresh Natural Blend
- Oxbow Western Timothy Hay for Pets
- Oxbow Bunny Basics Adult Rabbit Food (Timothy Based)
- Midwest Gold or Black Indoor/Outdoor Exercise Pet Pens (24"Wx30"H or 24"Wx24"W)

## Bunny Toys

- Cottontail Cottage (Cats, Rabbits and More: https://www.catsandrabbitsandmore.com/inc/sdetail/59389)
- Mini Maze Haven, Tunnel Haven, Willow Tent, Willow Baskets, Fruity Balsa Blocks, Grass Mats and Mini Willow Ball Rattle from Binky Bunny: https://store.binkybunny.com
- Oxbow Timothy Club Bungalow for Pets (Large)
- Sisal Carpet and Dig Station from Happy Rabbit Toys: https://happyrabbittoys.com
- Various toys, chews and Toy Elf items from Small Pet Select: https://shop.smallpetselect.com
- Bunny tunnels (such as the Tunnel Haven or the SmartyKat CrackleChute Collapsible Tunnel)

Items are available at local stores like Petco, PetPeople, Target, or the Hop Shop at the Adoption Center, as well as online retailers including Busy Bunny (https://www.busybunny.com), BinkyBunny (https://www.binkybunny.com), Cats & Rabbits & More (https://www.catsandrabbitsandmore.com), Small Pet Select (https://shop.smallpetselect.com), Bunny Approved (https://bunnyapproved.com), Bingaling Bunnybox (https://www.bingalingstore.com), or Happy Rabbit Toys (https://www.happyrabbittoys.com).$body$, 60, true),

  (v_org, 'online-affiliates', 'give', 'Online Affiliates', 'store',
   'Shop through these links and a portion comes back to the bunnies.',
   $body$Small Pet Select (https://smallpetselect.com) offers only the highest quality hay so that your bunnies will eat more of it and stay healthy. Our bunnies absolutely adore hay from Small Pet Select — and we're not just saying that! If you use the coupon code OHRR, you will not only get free shipping, but Small Pet Select will donate a portion of your purchase back to OHRR. Plus, the hay is delivered straight to your door. Bonus!

Cats, Rabbits and More! (https://www.catsandrabbitsandmore.com/inc/sdetail/59389) — you can donate a Cottontail Cottage to Ohio House Rabbit Rescue and our bunnies for $14.50. All of our bunnies have a "hidey-box" in their x-pen and their favorites are the Cottontail Cottages! Just click on the link and choose OHRR as the rescue you would like the Cottontail Cottage donated to.

Bunny Approved (https://bunnyapproved.com?affiliates=8) — click on our unique link when shopping for products on BunnyApproved.com and a portion of your purchase will be donated to OHRR to support our adoptions! Bunny Approved has lots of great treats, toys and more for your bunnies. Be sure to take a look!

ResQthreads – Show Your Love for Adopted Bunnies (https://resqthreads.com/?rescue=OHRR) — OHRR is a ResQthreads beneficiary! OHRR is eligible to receive a donation for every item purchased from their site, including an awesome T-Shirt promoting bunny adoption (available for both men and women). Make sure you enter through OHRR's unique link so we can receive the benefits from your purchase.

Pawlee's Treat Co. (https://pawlees.com) — Ohio House Rabbit Rescue is participating in the Pawlee's Treat Co. Paws to Rescue program. If you would like high quality, all-natural treats for your dog, purchase them from Pawlee's Treat Co. and as you check out, select Ohio House Rabbit Rescue as the organization you would like to support. OHRR then receives 10% of your purchase!

Binky Bunny (https://www.binkybunny.com) — if you do not have a House Rabbit Society chapter near you, buy your bunny's hay, pellets, treats, and toys from Binky Bunny through our link and we will receive a referral commission on your purchases. To ensure that OHRR receives the commission on all of your orders in the future, cut and paste this line in the comments section of your order: "Please attach this order and all future orders to Ohio House Rabbit Rescue."

Kroger Rewards (https://www.kroger.com/communityrewards) — participate in the Kroger Rewards program and choose Ohio House Rabbit Rescue as your participating nonprofit! OHRR receives benefits every time you shop! Search for OHRR through our ID number 80631 or by typing in our name. Don't forget to re-enroll your Kroger Card after April 1! Kroger lists charities within a certain radius of the store you choose — if you live outside of Columbus, select a store in Columbus as your main store and OHRR will receive the benefits; you don't have to shop at that store.

Black Horse (https://www.ablackhorse.com/store/pc/home.asp?idaffiliate=453) — purchase products for your bunnies, dogs, cats and horses through OHRR's affiliate code on ablackhorse.com. If you enter the site using our link, OHRR will receive 5% commission from your order.

Bissell's Partners for Pets (https://www.bissell.com/partnersforpets/products/) — Ohio House Rabbit Rescue is proud to be a Partner for Pets! When you purchase pet products on Bissell.com, Bissell will donate 10% of your purchase to Ohio House Rabbit Rescue. You'll save 10% and receive free shipping. Use the code ADOPT and select OHIO HOUSE RABBIT RESCUE at the BISSELL checkout to receive the discount.

Goodshop and Goodsearch (https://www.goodsearch.com) — Goodshop is a free and easy way to support Ohio House Rabbit Rescue when you shop at thousands of stores online; Goodsearch donates 50% of the revenue generated from sponsored search advertisers to Ohio House Rabbit Rescue.

Guidestar (https://www.guidestar.org/organizations/27-0830606/ohio-house-rabbit-rescue.aspx) — view Ohio House Rabbit Rescue's Guidestar portrait for an in-depth look at our organization's programs, leadership, and more.

(AmazonSmile, once listed here, ended in February 2023.)$body$, 70, true),

  (v_org, 'bunny-dates', 'adopt', 'What to Expect When you Bring your Bunny to OHRR for a Bonding Date', 'heart',
   'How a bonding date at the Adoption Center works, start to finish.',
   $body$Many bunny owners would love to expand their bunny family, but are worried about finding the right fit for their home and their current bunny. Some have even tried multiple potential bunny friends without much luck. At the Ohio House Rabbit Adoption Center, we want to be sure that you find the bunny for you, and we're here to support you through the entire bonding process.

Before coming to the Center, please check out our list of adoptable rabbits. If there is a rabbit you would like your bunny to meet that is in a foster home, let us know ahead of time so we can get the rabbit from the foster home and into the Center for your bunny to meet.

Plan on being at the Center for about 1-2 hours.

When you bring your bunny to the Center, we will set up an x-pen that we will put your bunny in to do the dates. We will then ask you to walk around and spend some time with the rabbits and decide on 3 rabbits you would like your bunny to meet. Even if you have your heart set on one rabbit, we still like to try 3 rabbits. This will allow you see how the date goes with the rabbit you prefer compared to other rabbits. Sometimes the rabbit you pick isn't the one your rabbit would pick. That doesn't mean you can't adopt the rabbit you picked, but it may mean the bonding process will be longer.

Once you have picked the 3 rabbits that you would like to try, we will bring one into the x-pen with your rabbit. The bonding expert at the Center will get in with the two rabbits to observe their behavior and be there to stop any fights and prevent injury. We ask that you don't get in with us. The reason for that is that if they do start to fight, it is easier to stop the fight if there isn't anyone else in the x-pen. But you can be right outside the pen to watch all the dates. If the date seems to be going well, you can get in if you feel comfortable.

During the dates, we do not have anything else in the pen that the rabbits could fight over, that includes litter boxes. We have found that even if you put two litter boxes in, they will both want to be in the same litter box. We also want them to pay attention to each other.

We repeat the process with each of the 3 rabbits you picked. After we finish, we can try any of them again. We just want to watch your bunny's behavior to be sure that he/she is not getting too tired. If it has been 2 hours, your bunny may be ready for a break. Sometimes we will even take a break between the 3 dates and give your bunny some water and hay.

After the dates are done, we talk about how they went, and who seemed compatible and who didn't. We will coach you on continuing the bonding process at home and the best way to set up their x-pens. If you need to borrow a x-pen until they are bonded, we will lend you one. In addition, our bonding expert will provide continuing support through email. Every bonding is different as every rabbit's personality is different, and we have found it's best if you have someone to reach out to if you are not sure how to proceed at home or if you have a question. We will also do in-home bonding visits to help out. We want the bonding process to be enjoyable and successful for everyone involved, especially you and your bunny!$body$, 10, true)

  on conflict (org_id, slug) do nothing;
end $$;
