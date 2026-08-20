"""Generate a clean, bold 1024x1024 app icon for PLUCK.
One big Ace of Hearts card on dark navy. Fills the frame.
"""
from PIL import Image, ImageDraw, ImageFont
import math

SIZE = 1024

# ── Background ──
img = Image.new("RGB", (SIZE, SIZE), (14, 14, 40))
draw = ImageDraw.Draw(img)
for y in range(SIZE):
    t = y / SIZE
    draw.line([(0, y), (SIZE, y)], fill=(14 + int(t*12), 14 + int(t*8), 40 + int(t*18)))

# ── Card (bigger — fills ~80% of frame) ──
cw, ch = 620, 860
card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
cd = ImageDraw.Draw(card)
cd.rounded_rectangle([(0, 0), (cw - 1, ch - 1)], radius=40, fill=(255, 255, 253))
cd.rounded_rectangle([(3, 3), (cw - 4, ch - 4)], radius=38, outline=(230, 230, 230), width=2)

red = (220, 38, 38)

try:
    font_rank = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 100)
except:
    font_rank = ImageFont.load_default()

def draw_heart(d, cx, cy, size, fill_color):
    """Draw a proper heart using bezier-approximated polygon."""
    pts = []
    # Generate heart curve: x = 16sin^3(t), y = -(13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t))
    for i in range(200):
        t = 2 * math.pi * i / 200
        x = 16 * (math.sin(t) ** 3)
        y = -(13 * math.cos(t) - 5 * math.cos(2*t) - 2 * math.cos(3*t) - math.cos(4*t))
        scale = size / 36  # normalize to size
        pts.append((int(cx + x * scale), int(cy + y * scale)))
    d.polygon(pts, fill=fill_color)

# Big center heart
draw_heart(cd, cw // 2, ch // 2 + 30, 320, red)

# Top-left corner: rank + small heart
cd.text((40, 28), "A", fill=red, font=font_rank)
draw_heart(cd, 68, 150, 55, red)

# Bottom-right corner (rotated)
br = Image.new("RGBA", (140, 150), (255, 255, 253, 255))
brd = ImageDraw.Draw(br)
brd.text((36, 10), "A", fill=red, font=font_rank)
draw_heart(brd, 66, 128, 55, red)
br = br.rotate(180, expand=False)
card.paste(br, (cw - 160, ch - 170), br)

# ── Shadow ──
shadow = Image.new("RGBA", (cw + 50, ch + 50), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
for i in range(12, 0, -1):
    a = int(50 * (1 - i / 12))
    sd.rounded_rectangle(
        [(25 - i, 28 - i), (cw + 24 + i, ch + 27 + i)],
        radius=40 + i, fill=(0, 0, 0, a)
    )

# Slight tilt — just 3 degrees
angle = 3
shadow_r = shadow.rotate(angle, expand=True, resample=Image.BICUBIC)
card_r = card.rotate(angle, expand=True, resample=Image.BICUBIC)

sx = (SIZE - shadow_r.width) // 2 + 5
sy = (SIZE - shadow_r.height) // 2 + 6
cx_pos = (SIZE - card_r.width) // 2
cy_pos = (SIZE - card_r.height) // 2

temp = img.convert("RGBA")
temp.paste(shadow_r, (sx, sy), shadow_r)
temp.paste(card_r, (cx_pos, cy_pos), card_r)

final = temp.convert("RGB")
out = "/Users/marco/.openclaw/workspace/projects/pluck/packages/client/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
final.save(out, "PNG")
print(f"✅ Saved {SIZE}x{SIZE} icon")
