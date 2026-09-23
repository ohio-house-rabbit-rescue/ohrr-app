"""Load OHRR's adoptable rabbits from its RescueGroups.org listing into the app.

ohiohouserabbitrescue.org/adopt/adoptable-bunnies/ shows OHRR's rabbits
through a RescueGroups.org toolkit frame (organisation 6091). The same
RescueGroups record also feeds Petfinder and Adopt-a-Pet, so it's the one
source of truth. This script reads that public listing (read-only) and writes
a Supabase migration that adds each rabbit to the `rabbits` table, keyed by
its RescueGroups id so running it again never duplicates a rabbit.

Until the proper feed is wired in, run it to pick up new arrivals:

    python scripts/rescuegroups-rabbits.py supabase/migrations/<timestamp>_rabbits_refresh.sql

Existing rows are left alone (`on conflict do nothing`), so staff edits made
in Staff -> Adopt survive a refresh; a rabbit adopted since is marked there.
"""
import html
import re
import sys
import time
import urllib.request

BASE = 'https://toolkit.rescuegroups.org/iframe/fb/v1.0/'
ORG = '6091'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128'}

# RescueGroups' catch-all breed — it means "not given", so it isn't shown.
NO_BREED = {'bunny rabbit', 'rabbit'}
# OHRR's own closing line on every listing; the app has its own Apply button.
BOILERPLATE = re.compile(r'^If you have read our Adoption Policy', re.I)


def get(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')


def text(fragment: str) -> str:
    t = re.sub(r'<br\s*/?>', '\n', fragment)
    t = re.sub(r'</p>\s*', '\n\n', t)
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t).replace('\xa0', ' ')
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r'\n\s*\n\s*(\n\s*)+', '\n\n', t)
    return t.strip()


def listing_ids() -> list[str]:
    ids: list[str] = []
    page = 1
    while True:
        s = get(f'{BASE}?breed=&age=&sex=&page={page}&ids={ORG}&species=')
        new = [i for i in dict.fromkeys(re.findall(r'pet\?animalID=(\d+)&', s)) if i not in ids]
        if not new:
            return ids
        ids += new
        page += 1
        time.sleep(0.5)


def rabbit(aid: str) -> dict:
    s = get(f'{BASE}pet?animalID={aid}&ids={ORG}&species=&breed=&age=&sex=&page=1&url=http://www.ohiohouserabbitrescue.org/')

    def span(i: str) -> str:
        m = re.search(rf'id="{i}">(.*?)</span>', s, re.S)
        return text(m.group(1)).strip(': ') if m else ''

    info = {
        text(k).rstrip(':'): text(v)
        for k, v in re.findall(r'<td class="petInfoTitle">(.*?)</td><td class="petInfoValue">(.*?)</td>', s, re.S)
    }
    extra_block = re.search(r'<strong>Additional Info:</strong>(.*?)</div>', s, re.S)
    extra = [text(x) for x in re.findall(r'<li>(.*?)</li>', extra_block.group(1), re.S)] if extra_block else []
    photos = list(dict.fromkeys(re.findall(r'href="(https://cdn\.rescuegroups\.org/[^"]+\.(?:jpe?g|png|gif))"', s, re.I)))
    if not photos:
        photos = list(dict.fromkeys(re.findall(r'src="(https://cdn\.rescuegroups\.org/[^"]+\.(?:jpe?g|png|gif))"', s, re.I)))
    d = re.search(r'<div class="rgDescription">(.*?)</div></div>', s, re.S)
    paras = [p for p in (text(d.group(1)).split('\n\n') if d else []) if p and not BOILERPLATE.match(p)]
    breed = span('rgPetDetailsBreed')
    return {
        'id': aid,
        'name': text(re.search(r'<div class="pageCenterTitle"[^>]*>(.*?)</div>', s, re.S).group(1)),
        'breed': None if breed.lower() in NO_BREED else breed or None,
        'sex': span('rgPetDetailsSex') or None,
        'age': span('rgPetDetailsAge') or None,
        'status': info.get('Status', ''),
        'size': info.get('Size') or None,
        'house_trained': 'House trained' in extra,
        'special_needs': 'Has Special Needs' in extra,
        'photos': photos,
        'description': '\n\n'.join(paras),
    }


def partners(r: dict, everyone: list[dict]) -> list[str]:
    """Bonded pairs are two listings sharing one write-up that says so."""
    if not re.search(r'bonded|adopted together', r['description'], re.I):
        return []
    return [o['name'] for o in everyone if o is not r and o['description'] == r['description']]


def status_of(s: str) -> str:
    s = s.lower()
    if 'pending' in s:
        return 'Pending'
    if 'adopted' in s:
        return 'Adopted'
    return 'Available'


def lit(v) -> str:
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, int):
        return str(v)
    assert '$t$' not in v
    return f'$t${v}$t$'


def arr(items: list[str]) -> str:
    return "'{}'::text[]" if not items else 'array[' + ', '.join(lit(i) for i in items) + ']'


def main(out: str) -> None:
    rabbits = [rabbit(i) for i in listing_ids()]
    rows = []
    for n, r in enumerate(rabbits):
        mates = partners(r, rabbits)
        tags = (['Special needs'] if r['special_needs'] else []) + [f'Adopted together with {m}' for m in mates]
        rows.append(
            '    (v_org, '
            + ', '.join([
                lit(f"rescuegroups:{r['id']}"), lit(r['name']), lit(status_of(r['status'])), lit(r['sex']),
                lit(r['age']), lit(r['breed']), lit(r['size']),
                # OHRR's adoption policy: "All OHRR rabbits are spayed or neutered."
                'true',
                lit(r['house_trained']), lit(bool(mates)), lit(r['description'] or None), arr(tags), arr(r['photos']),
                lit((n + 1) * 10), 'true',
            ])
            + ')'
        )
    names = ', '.join(r['name'] for r in rabbits)
    sql = f"""-- =============================================================
-- OHRR — the real adoptable rabbits
--
-- {len(rabbits)} rabbits exactly as OHRR lists them today on RescueGroups.org, the
-- listing ohiohouserabbitrescue.org/adopt/adoptable-bunnies/ shows (and that also
-- feeds Petfinder and Adopt-a-Pet): {names}.
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
{',\n'.join(rows)}
  on conflict (org_id, source_id) do nothing;
end $$;
"""
    open(out, 'w', encoding='utf-8', newline='\n').write(sql)
    print(f'{len(rabbits)} rabbits -> {out}')
    for r in rabbits:
        print(f"  {r['name']:<10} {r['sex'] or '':<7} {r['age'] or '':<6} {r['breed'] or '-':<15} photos={len(r['photos'])} bonded={partners(r, rabbits)}")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'rabbits.sql')
