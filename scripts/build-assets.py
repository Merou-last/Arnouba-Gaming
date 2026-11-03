"""Builds assets/games/<key>.png (256x256) from assets/logos/source/*.jpg and the game-roles banner.
Run:  python3 scripts/build-assets.py   (needs Pillow). Missing logos get an ORIGINAL initials tile."""
import os, re, glob
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'logos', 'source')
OUT = os.path.join(ROOT, 'assets', 'games')
SIZE = 256

# key, name, accent colour, initials (order = order in src/config/gameRoles.js)
src = open(os.path.join(ROOT, 'src', 'config', 'gameRoles.js'), encoding='utf8').read()
GAMES = re.findall(r"key: '(\w+)', name: '([^']+)', emoji: '[^']+', color: 0x([0-9a-fA-F]{6})", src)

def corner_bg(im):
    w, h = im.size
    px = [im.getpixel(p) for p in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
    return tuple(sorted(c[i] for c in px)[1] for i in range(3))

def font(sz):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf']:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

def from_logo(path, key):
    im = Image.open(path).convert('RGB')
    bg = (17, 17, 17) if key == 'pubg' else corner_bg(im)
    tile = Image.new('RGB', (SIZE, SIZE), bg)
    box = int(SIZE * 0.92)
    im.thumbnail((box, box), Image.LANCZOS)
    tile.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    return tile

def placeholder(name, color):
    tile = Image.new('RGB', (SIZE, SIZE), color)
    d = ImageDraw.Draw(tile)
    words = [w for w in re.split(r'\s+', name) if w]
    text = (words[0][0] + words[1][0]).upper() if len(words) > 1 else name[:2].upper()
    f = font(110)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    d.text(((SIZE - (r - l)) / 2 - l, (SIZE - (b - t)) / 2 - t), text, font=f, fill=(255, 255, 255))
    return tile

made, generated = [], []
for key, name, hexcol in GAMES:
    p = os.path.join(SRC, f'{key}.jpg')
    if os.path.exists(p):
        img = from_logo(p, key)
    else:
        c = tuple(int(hexcol[i:i + 2], 16) for i in (0, 2, 4))
        img = placeholder(name, c); generated.append(key)
    img.save(os.path.join(OUT, f'{key}.png'), optimize=True)
    made.append(key)

# collage banner for the game-roles panel (5 columns)
T, G, COLS = 150, 14, 5
rows = (len(made) + COLS - 1) // COLS
W, H = COLS * T + (COLS + 1) * G, rows * T + (rows + 1) * G
bn = Image.new('RGB', (W, H), (43, 45, 49))
for n, key in enumerate(made):
    t = Image.open(os.path.join(OUT, f'{key}.png')).resize((T, T), Image.LANCZOS)
    m = Image.new('L', (T, T), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, T - 1, T - 1), 24, fill=255)
    bn.paste(t, (G + (n % COLS) * (T + G), G + (n // COLS) * (T + G)), m)
bn.save(os.path.join(ROOT, 'assets', 'game-roles-banner.png'), optimize=True)
print('games:', len(made), '| generated placeholders:', generated, '| banner', bn.size)
