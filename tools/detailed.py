"""Detailed, shaded pixel art for the final evolutions (original fan art).

Drawn procedurally at native resolution with per-pixel lighting (light from the
upper left) plus hand-placed details. Every pixel is a hard pixel.
Run:  python3 tools/detailed.py <outdir>  to write enlarged previews.
"""
import math
import random
from PIL import Image

from rayquaza import Canvas, OUT

LIGHT = (-0.55, -0.75, 0.38)


class Shifted(Canvas):
    """Canvas whose drawing coordinates are shifted (adds margin without re-plotting)."""
    def __init__(self, w, h, ox=0, oy=0):
        super().__init__(w, h)
        self.ox, self.oy = ox, oy

    def set(self, x, y, c):
        super().set(x + self.ox, y + self.oy, c)

    def poly(self, pts, c):
        super().poly(pts, c)  # x, y (screen), z (towards viewer)


def ramp(c, n=5):
    """Five-step shade ramp around a base colour: shadow, dark, mid, light, highlight."""
    r, g, b = c
    f = [0.55, 0.75, 1.0, 1.18, 1.36]
    out = []
    for k in f:
        if k <= 1:
            out.append((int(r * k), int(g * k), int(b * k)))
        else:
            t = k - 1
            out.append((int(r + (255 - r) * t * 1.1), int(g + (255 - g) * t * 1.1), int(b + (255 - b) * t * 0.9)))
    return [tuple(max(0, min(255, v)) for v in col) for col in out]


def shade_level(nx, ny, nz):
    l = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
    if l > 0.62:
        return 4
    if l > 0.32:
        return 3
    if l > -0.05:
        return 2
    if l > -0.4:
        return 1
    return 0


def blob(cv, cx, cy, rx, ry, rmp, rot=0.0, levels=None, mask=None):
    """Shaded ellipse (like a sphere/egg). rmp is a 5-colour ramp."""
    ca, sa = math.cos(rot), math.sin(rot)
    R = max(rx, ry) + 1
    for y in range(int(cy - R - 1), int(cy + R + 2)):
        for x in range(int(cx - R - 1), int(cx + R + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            u = (dx * ca + dy * sa) / rx
            v = (-dx * sa + dy * ca) / ry
            d = u * u + v * v
            if d > 1:
                continue
            if mask and not mask(x, y):
                continue
            nz = math.sqrt(max(0.0, 1 - d))
            nx, ny = u * ca - v * sa, u * sa + v * ca
            lv = shade_level(nx, ny, nz)
            if levels:
                lv = levels(lv, x, y, u, v)
            cv.set(x, y, rmp[lv])


def flat(cv, pts, rmp, lv=2):
    cv.poly(pts, rmp[lv])


# ---------------------------------------------------------------- palettes
ORANGE = ramp((236, 128, 52))
CREAM = ramp((248, 214, 132))
TEAL = ramp((40, 132, 150))
FLAME_R, FLAME_O, FLAME_Y = (228, 50, 30), (250, 140, 30), (255, 232, 90)
CLAW = (246, 246, 240)
TAN = ramp((206, 176, 118))
BROWN = ramp((150, 104, 62))
ROCK = ramp((120, 132, 72))
SKIN = ramp((176, 148, 92))
RED = ramp((214, 70, 52))
YEL = ramp((246, 206, 72))
PINK = ramp((226, 150, 140))


# ---------------------------------------------------------------- Golem
def golem():
    W, H = 34, 30
    cv = Canvas(W, H)
    rnd = random.Random(76)
    # back legs and arms (behind the shell)
    blob(cv, 9, 25, 4.5, 3.5, SKIN)
    blob(cv, 21, 26, 5, 3.5, SKIN)
    # boulder shell made of plates: draw shaded sphere, then carve plate seams
    cx, cy, r = 15, 15, 12
    blob(cv, cx, cy, r, r - 1, ROCK)
    seeds = [(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.92) for d, n, off in ((0, 1, 0), (5.5, 6, 0.3), (10, 10, 0.0))
             for a in [off + i * 2 * math.pi / n for i in range(n)]]
    px = cv.px
    for y in range(H):
        for x in range(W):
            if not px[x, y][3] or ((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) / 0.92) ** 2) > r * r:
                continue
            ds = sorted((math.hypot(x + 0.5 - sx, y + 0.5 - sy), i) for i, (sx, sy) in enumerate(seeds))
            if ds[1][0] - ds[0][0] < 1.1:
                cv.set(x, y, ROCK[0])  # seam
            elif ds[1][0] - ds[0][0] < 2.0:
                # bevel: light on upper-left edge of each plate, dark on lower-right
                sx, sy = seeds[ds[0][1]]
                if (x - sx) + (y - sy) < 0:
                    cv.set(x, y, ROCK[min(4, [3, 4][rnd.random() < 0.3])])
    # head poking out front-right: reptilian, angry red eyes
    blob(cv, 26, 17, 5.5, 4.5, SKIN, rot=-0.2)
    cv.poly([(26, 18.5), (32.5, 18), (31.5, 21), (26, 21.5)], SKIN[2])  # jaw / snout
    cv.set(31, 18, SKIN[0])            # nostril
    # heavy angry brow, red eye
    cv.line(24, 13, 30, 15, SKIN[0])
    cv.line(24, 12, 29, 13.5, SKIN[1])
    for x, y, c in ((26, 15, RED[2]), (27, 15, RED[3]), (28, 16, (30, 20, 20)), (27, 16, RED[1])):
        cv.set(x, y, c)
    # open mouth with teeth
    cv.poly([(27, 19.5), (32.5, 19), (31, 21), (27.5, 21)], (120, 40, 40))
    cv.set(29, 19, CLAW)
    cv.set(31, 19, CLAW)
    # stubby front arm with claws
    blob(cv, 25, 24, 4, 3, SKIN)
    for x, y in ((28, 26), (29, 25), (29, 27)):
        cv.set(x, y, CLAW)
    for x, y in ((24, 28), (26, 28), (19, 28), (21, 28)):
        cv.set(x, y, CLAW)
    cv.outline()
    return cv.img


# ---------------------------------------------------------------- Charizard (flying, facing right)
def charizard():
    cv = Shifted(41, 37, 0, 3)
    # far wing (behind body, darker)
    cv.poly([(16, 14), (13, 2), (8, 4), (3, 9), (8, 10), (5, 15), (11, 15)], TEAL[0])
    cv.poly([(16, 14), (13, 2), (11, 3)], ORANGE[1])
    # tail curving down and back with the flame
    pts = [(14, 20), (10, 23), (6, 25), (3, 24)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for t in range(6):
            k = t / 5
            blob(cv, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 2.4 - 0.3 * (x0 < 10), 1.8, ORANGE)
    cv.poly([(3, 24), (0, 17), (2, 19), (3, 15), (5, 20), (6, 18), (5, 23)], (FLAME_R))
    cv.poly([(3, 23), (1.5, 19), (3, 18), (4.5, 21)], FLAME_O)
    cv.poly([(3, 22), (2.5, 20), (3.5, 20)], FLAME_Y)
    # body: leaning forward, cream belly
    blob(cv, 18, 19, 7, 8.5, ORANGE, rot=-0.5)
    blob(cv, 20, 21, 4.5, 6.5, CREAM, rot=-0.5, mask=lambda x, y: x + 0.6 * y > 31)
    # legs tucked back with claws
    blob(cv, 14, 25, 3.5, 3, ORANGE)
    blob(cv, 19, 27, 3, 2.5, ORANGE)
    for x, y in ((21, 29), (22, 28), (16, 28), (17, 28)):
        cv.set(x, y, CLAW)
    # neck and head
    blob(cv, 24, 11, 3, 4.5, ORANGE, rot=0.4)
    blob(cv, 29, 8, 5.6, 4.2, ORANGE, rot=0.15)
    cv.poly([(29, 8), (38.5, 8.5), (38, 11.4), (30, 12)], ORANGE[2])  # snout
    cv.line(31, 7, 37, 8, ORANGE[3])
    cv.line(30, 10.8, 38, 10.6, ORANGE[0])  # mouth line
    cv.set(37, 9, ORANGE[0])  # nostril
    cv.set(31, 11, CLAW)       # fang
    cv.poly([(26, 6), (22, 1), (24, 5.5)], ORANGE[2])  # horns swept back
    cv.poly([(27, 5.5), (24, 0), (26.5, 4.5)], ORANGE[3])
    for x, y, c in ((30, 7, (255, 255, 255)), (31, 7, (20, 30, 60)), (30, 6, ORANGE[0]), (31, 6, ORANGE[0]), (32, 7, ORANGE[0])):
        cv.set(x, y, c)
    # arm with claws
    blob(cv, 23, 18, 2, 3, ORANGE, rot=0.6)
    for x, y in ((25, 21), (26, 20)):
        cv.set(x, y, CLAW)
    # near wing: raised up and back, orange bones with teal membrane
    wing = [(20, 13), (22, 1), (17, 0), (11, 2), (7, 6), (12, 7), (9, 11), (15, 10), (14, 14)]
    cv.poly(wing, TEAL[2])
    cv.poly([(20, 13), (17, 3), (12, 4), (10, 7), (14, 8), (15, 12)], TEAL[3])
    for (x0, y0), (x1, y1) in (((20, 13), (22, 1)), ((22, 1), (17, 0)), ((20, 12), (12, 2)), ((19, 12), (8, 6)), ((18, 13), (10, 11))):
        cv.line(x0, y0, x1, y1, ORANGE[2])
    cv.line(21, 12, 22.5, 1.5, ORANGE[3])
    cv.set(22, 0, CLAW)
    cv.outline()
    return cv.img


# ---------------------------------------------------------------- Pidgeot (flying, facing right)
def pidgeot():
    cv = Shifted(41, 35, 0, 3)
    # far wing (up and back, darker)
    cv.poly([(18, 13), (12, 1), (7, 2), (4, 6), (9, 9), (6, 12), (13, 14)], BROWN[1])
    # tail feathers fanned out behind
    for i, (tx, ty) in enumerate(((1, 20), (2, 24), (4, 27))):
        cv.poly([(12, 19), (tx, ty), (tx + 2, ty + 1.5), (13, 21)], RED[2] if i % 2 == 0 else YEL[2])
        cv.line(12, 20, tx + 1, ty + 0.8, RED[1] if i % 2 == 0 else YEL[1])
    # body: plump, tan with cream breast
    blob(cv, 19, 19, 8, 6.5, TAN, rot=-0.25)
    blob(cv, 23, 21, 5, 4.5, CREAM, mask=lambda x, y: x + 0.5 * y > 30)
    # feet tucked
    for x, y in ((18, 26), (19, 27), (21, 26), (22, 27)):
        cv.set(x, y, PINK[2])
    cv.set(20, 27, PINK[1])
    # head
    blob(cv, 29, 11, 4.5, 4, TAN, rot=0.1)
    cv.poly([(32.5, 10.5), (38, 12), (33, 13.5)], PINK[2])  # beak
    cv.line(33, 12, 37, 12, PINK[0])
    cv.set(37, 12, PINK[1])
    # black eye stripe and eye
    cv.line(27, 10, 32, 10.5, (40, 32, 30))
    cv.set(30, 10, (255, 255, 255))
    cv.set(31, 10, (20, 20, 20))
    # long crest plumage streaming back: red then yellow
    for k, (col, dy) in enumerate(((RED[3], -1), (RED[2], 0), (YEL[3], 1), (YEL[2], 2))):
        pts = [(29 - i * 1.6, 7 + dy + math.sin(i * 0.55) * 1.2 + i * 0.35) for i in range(13)]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            cv.line(x0, y0, x1, y1, col)
    # near wing raised: layered feathers, tan with brown edges
    wing = [(22, 15), (25, 2), (20, 0), (13, 1), (8, 5), (12, 8), (9, 11), (15, 11), (16, 15)]
    cv.poly(wing, TAN[2])
    cv.poly([(22, 15), (24, 4), (19, 2), (14, 4), (17, 9), (17, 14)], TAN[3])
    for i, (x1, y1) in enumerate(((24, 1), (20, 0), (14, 1), (9, 5), (10, 10))):
        cv.line(21, 14, x1, y1, BROWN[2] if i % 2 else BROWN[1])
    cv.line(23, 14, 25, 2, TAN[4])
    cv.outline()
    return cv.img


if __name__ == "__main__":
    import sys
    out = Image.new("RGBA", (41 * 3 * 8 + 40, 37 * 8), (210, 210, 210, 255))
    x = 0
    for fn in (charizard, pidgeot, golem):
        im = fn()
        big = im.resize((im.width * 8, im.height * 8), Image.NEAREST)
        out.paste(big, (x, 0), big)
        x += big.width + 20
    out.save(sys.argv[1])
