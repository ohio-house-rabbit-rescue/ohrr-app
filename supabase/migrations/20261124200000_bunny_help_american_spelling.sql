-- =============================================================
-- OHRR — update 60: American spelling in the Bunny Help topics
--
-- The app and website were changed to American spelling in the fall, but the
-- Bunny Help topics are stored in the database, so they still show the old
-- British spellings: "Laboured" breathing, behaviour, fibre, colourful,
-- favourites, mouldy. They are in seven of the topics.
--
-- After this update those words read Labored, behavior, fiber, colorful,
-- favorites and moldy. Nothing else in a topic changes, and any topic without
-- one of these words is not touched.
--
-- The hidden search words (aliases) are left alone on purpose, so someone who
-- types "diarrhoea" or "mouldy" still finds the right topic.
--
-- Apply AFTER update 59. Safe to run twice. Run it as ONE paste.
-- =============================================================

do $$
declare w record;
begin
  -- \y means "start of a word", so only whole words (and their endings, like
  -- "behaviours") are changed. The first letter keeps its capital or small form.
  for w in
    select * from (values
      ('\y([Ll])aboured',   '\1abored'),
      ('\y([Bb])ehaviour',  '\1ehavior'),
      ('\y([Ff])ibre',      '\1iber'),
      ('\y([Cc])olour',     '\1olor'),
      ('\y([Ff])avourite',  '\1avorite'),
      ('\y([Mm])ould',      '\1old')
    ) as v(british, american)
  loop
    update care_topics set
      title        = regexp_replace(title,        w.british, w.american, 'g'),
      summary      = regexp_replace(summary,      w.british, w.american, 'g'),
      what_to_do   = regexp_replace(what_to_do,   w.british, w.american, 'g'),
      hopshop_note = regexp_replace(hopshop_note, w.british, w.american, 'g')
    where title        ~ w.british
       or summary      ~ w.british
       or what_to_do   ~ w.british
       or hopshop_note ~ w.british;
  end loop;
end $$;

-- Check: should say true.
select exists (select 1 from care_topics)
   and not exists (
  select 1 from care_topics
  where concat_ws(' ', title, summary, what_to_do, hopshop_note)
        ~ '\y([Ll]aboured|[Bb]ehaviour|[Ff]ibre|[Cc]olour|[Ff]avourite|[Mm]ould)'
) as bunny_help_is_american;
