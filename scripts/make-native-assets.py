"""Build the source images @capacitor/assets needs from the existing OHRR mark.

No new artwork: every file is public/ohrr-mark.png (the Ohio-shaped OHRR mark)
on the brand-blue background, inside a white disc because the mark itself is
drawn for a white background (its house-shaped negative space is white).

Outputs (all under resources/, committed):
  icon-only.png         1024x1024  iOS app icon: blue, white disc ~78%, mark inside
  icon-foreground.png   1024x1024  Android adaptive foreground: disc ~90% (the tool
                                   insets it 16.7% into the launcher safe zone)
  icon-background.png   1024x1024  solid brand blue
  splash.png            2732x2732  blue, disc + mark centred (~24% of the width)
  splash-dark.png       2732x2732  same (the splash is brand blue in both themes)

Plus the Android status-bar (notification) icon, which @capacitor/assets doesn't
make: a white silhouette of the mark on transparent, in every density, at
android/app/src/main/res/drawable-*/ic_stat_ohrr.png (24dp base).

Run:  python scripts/make-native-assets.py   (needs Pillow)
Then: npm run cap:assets
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MARK = ROOT / "public" / "ohrr-mark.png"
RES = ROOT / "resources"
BRAND_BLUE = (0x06, 0x69, 0xAC, 255)
WHITE = (255, 255, 255, 255)

# Supersample so the disc edge is smooth.
SS = 4


def disc_with_mark(size: int, disc_frac: float, mark_frac_of_disc: float = 0.9) -> Image.Image:
    """Brand-blue square with a centred white disc holding the mark.

    The mark is a white square (its own background) so it is clipped to the disc:
    the corners vanish into the disc's white and only the Ohio shape shows.
    """
    big = size * SS
    img = Image.new("RGBA", (big, big), BRAND_BLUE)
    draw = ImageDraw.Draw(img)
    d = int(big * disc_frac)
    x0 = (big - d) // 2
    draw.ellipse((x0, x0, x0 + d, x0 + d), fill=WHITE)
    mark = Image.open(MARK).convert("RGBA")
    m = int(d * mark_frac_of_disc)
    mark = mark.resize((m, m), Image.LANCZOS)
    mx = (big - m) // 2
    clip = Image.new("L", (big, big), 0)
    ImageDraw.Draw(clip).ellipse((x0, x0, x0 + d, x0 + d), fill=255)
    img.paste(mark, (mx, mx), clip.crop((mx, mx, mx + m, mx + m)))
    return img.resize((size, size), Image.LANCZOS)


def solid(size: int) -> Image.Image:
    return Image.new("RGBA", (size, size), BRAND_BLUE)


def silhouette(size: int) -> Image.Image:
    """White-on-transparent version of the mark for the Android status bar."""
    src = Image.open(MARK).convert("RGB")
    w, h = src.size
    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    px = src.load()
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            ink = 255 - min(r, g, b)  # 0 on white, large on any colour
            a = max(0, min(255, int(ink * 255 / 24)))  # cream bunny fill (min channel ~207) -> solid
            op[x, y] = (255, 255, 255, a)
    # Trim to content, then fit into the requested square with a little padding.
    bbox = out.getbbox()
    out = out.crop(bbox)
    pad = int(size * 0.06)
    inner = size - 2 * pad
    ow, oh = out.size
    scale = min(inner / ow, inner / oh)
    out = out.resize((max(1, int(ow * scale)), max(1, int(oh * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    canvas.alpha_composite(out, ((size - out.width) // 2, (size - out.height) // 2))
    return canvas


def main() -> None:
    RES.mkdir(exist_ok=True)
    disc_with_mark(1024, 0.78).save(RES / "icon-only.png")
    # @capacitor/assets insets the foreground by 16.7% so this 1024 square maps onto
    # the launcher's 72dp safe zone: a 0.9 disc leaves a thin blue ring under any mask.
    disc_with_mark(1024, 0.9).save(RES / "icon-foreground.png")
    solid(1024).save(RES / "icon-background.png")
    splash = disc_with_mark(2732, 0.24)
    splash.save(RES / "splash.png")
    splash.save(RES / "splash-dark.png")
    print("resources/ written")

    densities = {"mdpi": 24, "hdpi": 36, "xhdpi": 48, "xxhdpi": 72, "xxxhdpi": 96}
    res_dir = ROOT / "android" / "app" / "src" / "main" / "res"
    for name, px in densities.items():
        d = res_dir / f"drawable-{name}"
        d.mkdir(parents=True, exist_ok=True)
        silhouette(px).save(d / "ic_stat_ohrr.png")
    print("android ic_stat_ohrr written")


if __name__ == "__main__":
    main()
