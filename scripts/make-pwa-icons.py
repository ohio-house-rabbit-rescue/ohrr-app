"""Home-screen icons for the web app, from the same artwork as the phone apps.

    python scripts/make-pwa-icons.py

Writes to public/:
  icon-192.png, icon-512.png    Android / Chrome "Install app" (purpose any)
  icon-maskable-512.png         Android adaptive icon shape (the white circle
                                sits inside the 80% safe zone, so any mask works)
  apple-touch-icon.png          iPhone "Add to Home Screen", 180 x 180, no
                                transparency (iOS fills see-through parts black)
Source: resources/icon-only.png (made by scripts/make-native-assets.py).
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'resources' / 'icon-only.png'
OUT = ROOT / 'public'
BLUE = (6, 105, 172)  # #0669AC, the icon's own background


def opaque(img: Image.Image) -> Image.Image:
    base = Image.new('RGB', img.size, BLUE)
    base.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
    return base


src = opaque(Image.open(SRC).convert('RGBA'))
for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('icon-maskable-512.png', 512), ('apple-touch-icon.png', 180)]:
    src.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    print('wrote', name, size)
