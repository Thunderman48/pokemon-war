#!/usr/bin/env python3
"""Clean 3/4-view pixel-art buildings + resource nodes for Pokemon War.

Original art, drawn procedurally from simple shapes so it stays tidy and is
easy to tweak. Light comes from the top-left; every sprite gets a 1px dark
outline. Sizes keep the footprint widths the game expects (TILE = 16):
  center/gym/lab/skypillar = 48px wide (3x3), mart/tower = 32px wide (2x2).
Sprites are bottom-aligned to the footprint, so height can vary freely.

Run:  python3 tools/buildings_v2.py
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
OUT = (34, 26, 44)

# --- palette: 3-4 step ramps, light -> dark --------------------------------
CREAM = [(255, 250, 238), (242, 232, 212), (214, 198, 176), (176, 158, 140)]
RED = [(255, 132, 112), (232, 84, 76), (190, 52, 62), (138, 36, 54)]
BLUE = [(132, 196, 255), (82, 146, 232), (58, 100, 186), (42, 66, 132)]
SLATE = [(150, 160, 196), (112, 120, 160), (82, 88, 126), (58, 60, 92)]
STONE = [(226, 210, 178), (200, 180, 146), (164, 142, 114), (122, 102, 86)]
GREY = [(214, 216, 222), (176, 180, 192), (136, 140, 156), (100, 102, 120)]
WHITE = [(248, 250, 255), (226, 232, 242), (192, 200, 216), (150, 158, 180)]
GLASS = [(222, 246, 255), (138, 210, 246), (84, 156, 216), (56, 104, 168)]
WOOD = [(184, 126, 82), (148, 96, 64), (112, 70, 50), (78, 48, 40)]
GOLD = [(255, 236, 128), (246, 192, 62), (204, 136, 40), (150, 92, 34)]
TEAL = [(126, 230, 206), (64, 186, 170), (40, 134, 136), (30, 92, 104)]
JADE = [(184, 214, 186), (142, 178, 150), (104, 138, 118), (74, 100, 92)]
MOSS = [(150, 206, 96), (100, 162, 72), (64, 116, 64)]
LEAF = [(120, 200, 92), (76, 156, 70), (46, 112, 62), (34, 76, 56)]
PANEL = [(98, 132, 214), (62, 88, 170), (42, 58, 120)]
BRONZE = [(236, 182, 112), (196, 128, 72), (146, 86, 56), (98, 58, 48)]
PINK = [(255, 170, 190), (240, 96, 128), (180, 50, 92)]


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.p = self.im.load()

    def px(self, x, y, c, a=255):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.p[x, y] = tuple(c[:3]) + (a,)

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.p[x, y]
        return (0, 0, 0, 0)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)

    def box(self, x0, y0, x1, y1, c, edge=OUT):
        """filled rect with a 1px border"""
        self.rect(x0, y0, x1, y1, edge)
        self.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, c)

    def hl(self, x0, x1, y, c):
        self.rect(min(x0, x1), y, max(x0, x1), y, c)

    def vl(self, x, y0, y1, c):
        self.rect(x, min(y0, y1), x, max(y0, y1), c)

    def trap(self, y0, y1, l0, r0, l1, r1, c):
        """horizontal-band trapezoid: row y0 spans l0..r0, row y1 spans l1..r1"""
        for y in range(y0, y1 + 1):
            t = (y - y0) / max(1, y1 - y0)
            self.hl(round(l0 + (l1 - l0) * t), round(r0 + (r1 - r0) * t), y, c)

    def disc(self, cx, cy, r, c):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.6:
                    self.px(x, y, c)

    def outline(self):
        """turn the outermost ring of opaque pixels into the outline colour"""
        edge = []
        for y in range(self.h):
            for x in range(self.w):
                if self.p[x, y][3] == 0:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if self.get(x + dx, y + dy)[3] == 0:
                        edge.append((x, y))
                        break
        for x, y in edge:
            self.px(x, y, OUT)

    def save(self, rel):
        path = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.im.save(path)
        return path


# --- shared parts ----------------------------------------------------------
def window(c, x0, y0, x1, y1, frame=OUT, sill=None, split=True):
    c.box(x0, y0, x1, y1, GLASS[2], frame)
    c.rect(x0 + 1, y0 + 1, x1 - 1, y0 + 1, GLASS[1])
    c.vl(x0 + 1, y0 + 1, y1 - 1, GLASS[1])
    c.px(x0 + 2, y0 + 2, GLASS[0])
    c.px(x0 + 3, y0 + 2, GLASS[0])
    c.px(x0 + 2, y0 + 3, GLASS[0])
    c.hl(x0 + 1, x1 - 1, y1 - 1, GLASS[3])
    if split and x1 - x0 >= 6:
        mx = (x0 + x1) // 2
        c.vl(mx, y0 + 1, y1 - 1, frame)
    if sill:
        c.hl(x0 - 1, x1 + 1, y1 + 1, sill[0])
        c.hl(x0 - 1, x1 + 1, y1 + 2, sill[2])


def glass_door(c, x0, y0, x1, y1):
    c.box(x0, y0, x1, y1 + 1, GREY[2])
    c.rect(x0 + 1, y0 + 1, x1 - 1, y1, GLASS[1])
    c.vl((x0 + x1) // 2, y0 + 1, y1, GREY[3])
    c.vl((x0 + x1) // 2 + 1, y0 + 1, y1, GREY[3]) if (x1 - x0) % 2 else None
    # diagonal glint
    for i in range(4):
        c.px(x0 + 2 + i, y0 + 6 - i, GLASS[0])
        c.px(x0 + 2 + i, y0 + 7 - i, GLASS[0])
    c.hl(x0 + 1, x1 - 1, y0 + 1, GLASS[0])


def foundation(c, x0, x1, y0, y1, ramp=GREY):
    c.rect(x0, y0, x1, y1, ramp[2])
    c.hl(x0, x1, y0, ramp[1])
    for x in range(x0 + 3, x1, 7):
        c.vl(x, y0 + 1, y1, ramp[3])


def roof_tiles(c, y0, y1, l0, r0, l1, r1, ramp, step=3):
    """sloped front roof face with tile rows, ridge highlight and eave lip"""
    c.trap(y0, y1, l0, r0, l1, r1, ramp[1])
    for y in range(y0 + step, y1 - 2, step):
        t = (y - y0) / max(1, y1 - y0)
        l = round(l0 + (l1 - l0) * t); r = round(r0 + (r1 - r0) * t)
        c.hl(l, r, y, ramp[2])
        c.hl(l, l + 1, y - 1, ramp[0])  # lit left edge
    c.hl(l0, r0, y0, ramp[0]); c.hl(l0, r0, y0 + 1, ramp[0])
    # side slopes: light on left, dark on right
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        l = round(l0 + (l1 - l0) * t); r = round(r0 + (r1 - r0) * t)
        c.px(l + 1, y, ramp[0]); c.px(l + 2, y, ramp[0])
        c.px(r - 1, y, ramp[2]); c.px(r - 2, y, ramp[2])
    # eave lip
    c.hl(l1, r1, y1 - 1, ramp[0])
    c.hl(l1, r1, y1, ramp[3])


# --- buildings -------------------------------------------------------------
def center():
    """HQ: healing centre - cream walls, coral roof, heart badge, glass doors"""
    c = Canvas(48, 58)
    roof_tiles(c, 8, 29, 7, 40, 0, 47, RED)
    # wall
    c.rect(2, 30, 45, 52, CREAM[1])
    c.hl(2, 45, 30, CREAM[3]); c.hl(2, 45, 31, CREAM[2])  # eave shadow
    c.vl(3, 32, 52, CREAM[0])
    c.vl(44, 32, 52, CREAM[2])
    # red stripe band
    c.rect(2, 45, 45, 46, RED[1]); c.hl(2, 45, 45, RED[0])
    foundation(c, 1, 46, 53, 57)
    # entrance canopy + sign
    c.box(13, 33, 34, 37, RED[1])
    c.hl(14, 33, 34, RED[0])
    c.hl(16, 31, 35, CREAM[0])
    glass_door(c, 16, 38, 31, 52)
    # step
    c.rect(14, 53, 33, 54, GREY[0]); c.hl(14, 33, 55, GREY[1])
    window(c, 5, 36, 12, 43, sill=CREAM)
    window(c, 35, 36, 42, 43, sill=CREAM)
    # roof badge: white disc with heart
    c.disc(23.5, 17.5, 7.2, OUT)
    c.disc(23.5, 17.5, 6.2, WHITE[0])
    for x in range(18, 30):
        for y in range(19, 25):
            if c.get(x, y)[:3] == WHITE[0] and (x - 23.5) ** 2 + (y - 17.5) ** 2 > 20:
                c.px(x, y, WHITE[2])
    heart = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."]
    for j, row in enumerate(heart):
        for i, ch in enumerate(row):
            if ch == "#":
                c.px(20 + i, 14 + j, PINK[1])
    c.px(21, 15, PINK[0]); c.px(22, 15, PINK[0]); c.px(21, 16, PINK[0])
    for i, ch in enumerate(heart[-1]):
        pass
    c.px(26, 16, PINK[2]); c.px(25, 18, PINK[2]); c.px(24, 19, PINK[2])
    # little shrubs either side of the door
    for bx in (6, 37):
        c.rect(bx, 49, bx + 4, 52, LEAF[1]); c.hl(bx + 1, bx + 3, 48, LEAF[1])
        c.px(bx + 1, 49, LEAF[0]); c.px(bx + 2, 49, LEAF[0]); c.hl(bx, bx + 4, 52, LEAF[2])
    c.outline()
    return c


def mart():
    """supply shop: blue roof, striped awning, display window"""
    c = Canvas(32, 42)
    roof_tiles(c, 6, 21, 5, 26, 0, 31, BLUE, step=3)
    c.rect(2, 22, 29, 37, CREAM[1])
    c.hl(2, 29, 22, CREAM[3]); c.vl(3, 23, 37, CREAM[0]); c.vl(28, 23, 37, CREAM[2])
    foundation(c, 1, 30, 38, 41)
    # striped awning over the front
    c.rect(1, 23, 30, 26, OUT)
    for x in range(2, 30):
        col = BLUE[1] if (x // 3) % 2 == 0 else WHITE[0]
        c.vl(x, 24, 26, col)
        c.px(x, 24, BLUE[0] if col == BLUE[1] else WHITE[0])
    for x in range(1, 31):  # scalloped edge
        if (x // 3) % 2 == 0:
            c.px(x, 27, OUT)
            if 2 <= x <= 29 and x % 3 == 1:
                c.px(x, 27, BLUE[2])
    # shadow under awning
    c.hl(2, 29, 28, CREAM[2])
    window(c, 4, 29, 15, 36, sill=None)
    # goods on the shelf behind glass
    for i, col in enumerate((RED[1], GOLD[1], LEAF[1], PINK[1])):
        c.rect(6 + i * 2, 34, 6 + i * 2, 35, col)
    c.hl(5, 14, 36, WOOD[1])
    glass_door(c, 19, 29, 27, 38)
    # roof sign: coin
    c.disc(15.5, 13, 4.4, OUT)
    c.disc(15.5, 13, 3.4, GOLD[1])
    c.px(14, 11, GOLD[0]); c.px(15, 11, GOLD[0]); c.px(14, 12, GOLD[0])
    c.vl(16, 11, 15, GOLD[2]); c.px(15, 12, GOLD[2]); c.px(17, 14, GOLD[2])
    c.outline()
    return c


def gym():
    """training hall: barrel roof, stone facade, columns, big doors, gold emblem"""
    c = Canvas(48, 58)
    # barrel roof (rounded top seen from the front)
    for y in range(6, 30):
        t = (y - 6) / 9
        inset = 0 if t >= 1 else round(9 * (1 - (1 - (1 - t) ** 2) ** 0.5) + 0.0)
        c.hl(inset, 47 - inset, y, SLATE[1])
    for x in range(2, 46, 5):  # standing-seam ribs
        for y in range(6, 28):
            if c.get(x, y)[3]:
                c.px(x, y, SLATE[2])
                if c.get(x - 1, y)[3]:
                    c.px(x - 1, y, SLATE[0])
    for y in range(6, 15):  # top highlight band
        for x in range(0, 48):
            if c.get(x, y)[3] and y < 9:
                c.px(x, y, SLATE[0])
    c.hl(0, 47, 27, SLATE[0]); c.hl(0, 47, 28, SLATE[3]); c.hl(0, 47, 29, SLATE[3])
    # stone facade
    c.rect(2, 30, 45, 52, STONE[1])
    c.hl(2, 45, 30, STONE[3])
    for y in range(34, 52, 5):
        c.hl(2, 45, y, STONE[2])
        off = 0 if (y // 5) % 2 else 4
        for x in range(2 + off, 46, 8):
            c.vl(x, y + 1, min(y + 4, 52), STONE[2])
            c.px(x + 1, y + 1, STONE[0])
    # columns
    for cx in (8, 36):
        c.rect(cx, 31, cx + 3, 52, CREAM[1])
        c.vl(cx, 31, 52, CREAM[0]); c.vl(cx + 3, 31, 52, CREAM[3])
        c.rect(cx - 1, 31, cx + 4, 32, CREAM[0]); c.hl(cx - 1, cx + 4, 33, CREAM[3])
        c.rect(cx - 1, 51, cx + 4, 52, CREAM[2])
    # banners
    for bx in (3, 41):
        c.rect(bx, 34, bx + 3, 44, RED[1]); c.vl(bx, 34, 44, RED[0]); c.vl(bx + 3, 34, 44, RED[2])
        c.px(bx, 45, RED[2]); c.px(bx + 3, 45, RED[2])
        c.rect(bx + 1, 38, bx + 2, 39, GOLD[1])
    # arched double door
    c.rect(15, 38, 32, 53, OUT)
    c.hl(17, 30, 36, OUT); c.hl(16, 31, 37, OUT)
    c.rect(16, 39, 31, 52, WOOD[1]); c.hl(18, 29, 38, WOOD[1]); c.hl(17, 30, 38, WOOD[1])
    c.vl(23, 38, 52, OUT); c.vl(24, 38, 52, WOOD[2])
    for x in (18, 21, 27, 30):
        c.vl(x, 40, 52, WOOD[2])
    c.vl(16, 39, 52, WOOD[0]); c.vl(25, 39, 52, WOOD[0])
    c.rect(16, 44, 31, 44, WOOD[3])
    c.px(22, 46, GOLD[0]); c.px(26, 46, GOLD[0])
    foundation(c, 1, 46, 53, 57, STONE)
    c.rect(14, 53, 33, 55, GREY[0]); c.hl(14, 33, 56, GREY[1])
    # gold emblem on roof
    c.disc(23.5, 18, 7.2, OUT)
    c.disc(23.5, 18, 6.2, GOLD[1])
    c.disc(23.5, 18, 4.2, GOLD[2])
    star = ["...#...", "...#...", "#######", ".#####.", "..###..", ".##.##.", ".#...#."]
    for j, row in enumerate(star):
        for i, ch in enumerate(row):
            if ch == "#":
                c.px(20 + i, 15 + j, GOLD[0])
    c.px(19, 13, (255, 255, 255)); c.px(20, 13, GOLD[0])
    c.outline()
    return c


def lab():
    """research lab: flat roof with dish + solar panels, glass band, teal trim"""
    c = Canvas(48, 60)
    # roof deck (seen from above)
    c.rect(0, 14, 47, 29, GREY[1])
    c.hl(0, 47, 14, GREY[0]); c.hl(0, 47, 15, GREY[0]); c.vl(0, 14, 29, GREY[0]); c.vl(1, 14, 29, GREY[0])
    c.rect(2, 16, 45, 27, GREY[2])  # recessed deck
    c.hl(2, 45, 16, GREY[3])
    c.hl(0, 47, 28, GREY[0]); c.hl(0, 47, 29, GREY[3])
    # solar panels
    for px0 in (27, 36):
        c.box(px0, 18, px0 + 8, 25, PANEL[1])
        c.hl(px0 + 1, px0 + 7, 21, PANEL[2]); c.vl(px0 + 4, 19, 24, PANEL[2])
        c.px(px0 + 1, 19, PANEL[0]); c.px(px0 + 2, 19, PANEL[0]); c.px(px0 + 1, 20, PANEL[0])
    # vent box
    c.box(17, 17, 23, 25, GREY[1]); c.hl(18, 22, 18, GREY[0])
    for y in (20, 22, 24):
        c.hl(18, 22, y, GREY[3])
    # observatory dome with an open slit
    c.rect(3, 19, 15, 26, OUT); c.rect(4, 20, 14, 25, GREY[2]); c.hl(4, 14, 20, GREY[0])
    c.disc(9, 18, 6.6, OUT)
    c.disc(9, 18, 5.6, WHITE[1])
    for y in range(11, 19):
        for x in range(3, 16):
            if c.get(x, y)[:3] == WHITE[1] and (x - 7) ** 2 + (y - 15) ** 2 < 9:
                c.px(x, y, WHITE[0])
    c.hl(3, 15, 19, OUT)
    c.rect(10, 13, 11, 18, TEAL[3]); c.px(10, 14, TEAL[1])
    c.vl(12, 14, 18, WHITE[2])
    # antenna light
    c.vl(43, 6, 13, OUT); c.px(43, 5, RED[0]); c.px(42, 5, RED[1]); c.px(44, 5, RED[1]); c.px(43, 4, RED[1])
    # facade
    c.rect(2, 30, 45, 54, WHITE[1])
    c.hl(2, 45, 30, WHITE[3])
    c.vl(3, 31, 54, WHITE[0]); c.vl(44, 31, 54, WHITE[2])
    c.rect(2, 32, 45, 33, TEAL[1]); c.hl(2, 45, 32, TEAL[0])
    # long glass band
    c.box(5, 36, 42, 43, GLASS[2])
    c.rect(6, 37, 41, 37, GLASS[1])
    c.hl(6, 41, 42, GLASS[3])
    for x in (14, 23, 33):
        c.vl(x, 37, 42, OUT)
    for x0 in (6, 15, 24, 34):
        c.px(x0 + 1, 38, GLASS[0]); c.px(x0 + 2, 38, GLASS[0]); c.px(x0 + 1, 39, GLASS[0])
    c.hl(4, 43, 44, WHITE[0]); c.hl(4, 43, 45, WHITE[3])
    # door + teal canopy
    glass_door(c, 27, 46, 37, 54)
    c.rect(25, 46, 39, 46, TEAL[2])
    # wall vent + sign plate
    c.box(7, 47, 21, 52, TEAL[2])
    c.hl(8, 20, 48, TEAL[1])
    for i in range(3):  # tiny flask icon
        pass
    c.rect(10, 49, 11, 50, WHITE[0]); c.rect(14, 49, 15, 50, GOLD[0]); c.rect(18, 49, 19, 50, PINK[0])
    foundation(c, 1, 46, 55, 59)
    c.rect(25, 55, 39, 56, GREY[0])
    c.outline()
    return c


def tower():
    """defence tower: stone keep, crenellated top, bronze launcher"""
    c = Canvas(32, 54)
    # body
    c.rect(6, 24, 25, 50, STONE[1])
    c.vl(6, 24, 50, STONE[0]); c.vl(7, 24, 50, STONE[0])
    c.vl(24, 24, 50, STONE[2]); c.vl(25, 24, 50, STONE[2])
    for y in range(28, 50, 5):
        c.hl(6, 25, y, STONE[2])
        off = 0 if (y // 5) % 2 else 3
        for x in range(8 + off, 24, 6):
            c.vl(x, y + 1, min(y + 4, 50), STONE[2])
    # flared base
    c.rect(4, 46, 27, 53, STONE[2]); c.hl(4, 27, 46, STONE[1]); c.hl(4, 27, 47, STONE[1])
    c.vl(4, 46, 53, STONE[1])
    for x in range(8, 27, 6):
        c.vl(x, 48, 53, STONE[3])
    # door
    c.rect(13, 43, 18, 53, OUT); c.rect(14, 44, 17, 52, WOOD[1]); c.vl(14, 44, 52, WOOD[0])
    c.px(13, 43, STONE[1]); c.px(18, 43, STONE[1])
    c.vl(16, 45, 52, WOOD[2])
    # arrow slit
    c.rect(15, 31, 16, 36, OUT); c.px(15, 32, GLASS[3])
    # parapet: top face + front face with merlons
    c.rect(2, 14, 29, 18, STONE[0])  # walkway seen from above
    c.rect(4, 15, 27, 17, STONE[2])
    c.rect(2, 19, 29, 24, STONE[1])
    c.hl(2, 29, 19, STONE[0]); c.hl(2, 29, 24, STONE[3]); c.hl(6, 25, 25, STONE[3])
    c.vl(29, 19, 24, STONE[2]); c.vl(28, 19, 24, STONE[2])
    for mx in (2, 10, 18, 25):  # merlons
        w = 4 if mx != 25 else 5
        c.rect(mx, 10, mx + w, 14, STONE[1])
        c.hl(mx, mx + w, 10, STONE[0]); c.vl(mx + w, 11, 14, STONE[2])
    for mx in (2, 10, 18, 25):  # carve gaps
        pass
    for gx in (7, 15, 23):
        c.rect(gx, 10, gx + 2, 13, (0, 0, 0))
        for y in range(10, 14):
            for x in range(gx, gx + 3):
                c.p[x, y] = (0, 0, 0, 0)
        c.hl(gx, gx + 2, 14, STONE[0])
    # launcher: bronze dome turret with a barrel aimed out to the side
    c.rect(19, 6, 28, 11, OUT)
    c.rect(20, 7, 27, 10, BRONZE[1]); c.hl(20, 27, 7, BRONZE[0]); c.hl(20, 27, 10, BRONZE[2])
    c.rect(26, 5, 29, 12, OUT); c.rect(27, 6, 28, 11, BRONZE[2]); c.vl(27, 6, 11, BRONZE[1])
    c.disc(14.5, 11, 6.4, OUT)
    c.disc(14.5, 11, 5.4, BRONZE[1])
    c.disc(13, 9.5, 2.6, BRONZE[0])
    c.px(12, 8, (255, 236, 200))
    for x in range(9, 21):
        for y in range(12, 18):
            if c.get(x, y)[:3] == BRONZE[1] and (x - 14.5) ** 2 + (y - 11) ** 2 > 12:
                c.px(x, y, BRONZE[2])
    c.rect(8, 14, 21, 16, OUT); c.rect(9, 14, 20, 15, BRONZE[3]); c.hl(9, 20, 14, BRONZE[2])
    c.outline()
    return c


def skypillar():
    """ancient spire: tiered jade stone, glowing runes, floating crystal"""
    c = Canvas(48, 78)
    # base steps
    c.rect(0, 70, 47, 77, JADE[2]); c.hl(0, 47, 70, JADE[1]); c.hl(0, 47, 71, JADE[1])
    c.rect(3, 64, 44, 69, JADE[1]); c.hl(3, 44, 64, JADE[0]); c.vl(44, 64, 69, JADE[2])
    c.hl(3, 44, 69, JADE[3])
    # tier 1
    c.rect(6, 46, 41, 63, JADE[1])
    c.vl(6, 46, 63, JADE[0]); c.vl(7, 46, 63, JADE[0]); c.vl(40, 46, 63, JADE[2]); c.vl(41, 46, 63, JADE[2])
    c.rect(4, 44, 43, 46, JADE[0]); c.hl(4, 43, 47, JADE[3])
    # tier 2
    c.rect(11, 28, 36, 43, JADE[1])
    c.vl(11, 28, 43, JADE[0]); c.vl(35, 28, 43, JADE[2]); c.vl(36, 28, 43, JADE[2])
    c.rect(9, 26, 38, 28, JADE[0]); c.hl(9, 38, 29, JADE[3])
    # tier 3 / spire
    c.rect(15, 15, 32, 25, JADE[1])
    c.vl(15, 15, 25, JADE[0]); c.vl(31, 15, 25, JADE[2]); c.vl(32, 15, 25, JADE[2])
    c.trap(9, 15, 22, 25, 14, 33, JADE[0])
    c.trap(9, 15, 24, 25, 24, 33, JADE[2])
    c.hl(13, 34, 15, JADE[0]); c.hl(13, 34, 16, JADE[3])
    # block seams
    for y in (52, 58):
        c.hl(8, 39, y, JADE[2])
    for x in (14, 33):
        c.vl(x, 48, 51, JADE[2]); c.vl(x, 59, 63, JADE[2])
    c.vl(24, 53, 57, JADE[2])
    c.hl(12, 34, 35, JADE[2])
    # arched doorway with inner glow
    c.rect(18, 52, 29, 64, OUT)
    c.hl(20, 27, 50, OUT); c.hl(19, 28, 51, OUT)
    c.rect(19, 53, 28, 64, TEAL[3]); c.hl(20, 27, 52, TEAL[3]); c.hl(21, 26, 51, TEAL[3])
    c.rect(21, 57, 26, 64, TEAL[2]); c.rect(22, 60, 25, 64, TEAL[1])
    c.hl(18, 29, 64, JADE[3])
    # glowing runes
    for (x, y) in ((10, 50), (10, 56), (37, 50), (37, 56), (17, 33), (30, 33), (23, 19)):
        c.px(x, y, TEAL[0]); c.px(x, y + 1, TEAL[1]); c.px(x, y + 2, TEAL[0])
    c.hl(13, 34, 38, TEAL[1]); c.hl(14, 33, 38, TEAL[0])
    # moss
    for (x, y, w) in ((6, 46, 4), (34, 46, 3), (9, 28, 3), (33, 28, 2), (3, 64, 3), (40, 64, 4), (15, 25, 2)):
        c.hl(x, x + w, y, MOSS[0]); c.hl(x, x + w - 1, y + 1, MOSS[1]); c.px(x + 1, y + 2, MOSS[2])
    c.outline()
    # floating crystal (drawn after outline so its own outline is separate)
    gem = ["...#...", "..#a#..", ".#aab#.", "#aaabb#", "#aabbb#", ".#bbc#.", "..#c#..", "...#..."]
    pal = {"a": TEAL[0], "b": TEAL[1], "c": TEAL[2], "#": OUT}
    for j, row in enumerate(gem):
        for i, ch in enumerate(row):
            if ch in pal:
                c.px(20 + i, 0 + j, pal[ch])
    c.px(22, 3, (255, 255, 255))
    for (x, y) in ((19, 4), (28, 4), (24, 9)):  # sparkle
        c.px(x, y, TEAL[0])
    return c


# --- resources -------------------------------------------------------------
def berry():
    c = Canvas(18, 16)
    c.disc(8.5, 9, 6.8, LEAF[1])
    c.disc(5, 8, 3.6, LEAF[1]); c.disc(12.5, 8.5, 3.6, LEAF[1])
    for (x, y) in ((4, 6), (5, 5), (6, 5), (7, 4), (8, 4), (4, 7), (9, 4)):
        c.px(x, y, LEAF[0])
    for y in range(12, 16):
        for x in range(18):
            if c.get(x, y)[3]:
                c.px(x, y, LEAF[2])
    for (x, y) in ((11, 6), (13, 9), (12, 11), (6, 12), (9, 13), (14, 12)):
        c.px(x, y, LEAF[2])
    c.outline()
    for (x, y) in ((5, 8), (10, 6), (13, 10), (7, 11), (11, 12), (3, 11)):
        c.rect(x, y, x + 1, y + 1, PINK[1]); c.px(x, y, PINK[0]); c.px(x + 1, y + 1, PINK[2])
    return c


def crystal():
    c = Canvas(18, 17)
    # rock base
    c.rect(2, 12, 15, 16, GREY[2]); c.hl(3, 14, 12, GREY[1]); c.hl(1, 16, 16, GREY[3])
    c.rect(1, 13, 16, 15, GREY[2]); c.hl(1, 3, 13, GREY[1])

    def prism(xc, top, hw, bottom):
        # outline pass, then fill: pointed tip, lit left face, darker right face
        for pad, fill in ((1, None), (0, True)):
            for y in range(top - pad, bottom + 1):
                d = y - top
                w = min(hw, d // 1 + 1) + pad
                for x in range(xc - w, xc + w):
                    if fill is None:
                        c.px(x, y, OUT)
                    else:
                        c.px(x, y, GLASS[0] if x < xc - 1 else (GLASS[1] if x < xc else BLUE[1]))
        c.vl(xc - 2, top + 3, bottom - 1, (255, 255, 255)) if hw > 2 else None
        c.vl(xc + hw - 1, top + hw, bottom, BLUE[2])
    prism(4, 7, 2, 13)
    prism(14, 5, 2, 13)
    prism(9, 1, 3, 14)
    c.outline()
    return c


ALL = {
    "buildings/center.png": center, "buildings/mart.png": mart, "buildings/gym.png": gym,
    "buildings/lab.png": lab, "buildings/tower.png": tower, "buildings/skypillar.png": skypillar,
    "res/berry.png": berry, "res/crystal.png": crystal,
}

BOLD = True  # 2px "bold" outline; set False for the thin 1px look


def bolden(c):
    """add a second outline ring outside the sprite (canvas grows by 1px each side)"""
    big = Canvas(c.w + 2, c.h + 2)
    big.im.alpha_composite(c.im, (1, 1))
    ring = []
    for y in range(big.h):
        for x in range(big.w):
            if big.p[x, y][3]:
                continue
            if any(big.get(x + dx, y + dy)[3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                ring.append((x, y))
    for x, y in ring:
        big.px(x, y, OUT)
    return big


if __name__ == "__main__":
    for rel, fn in ALL.items():
        im = fn()
        if BOLD:
            im = bolden(im)
        print("wrote", im.save(rel), im.im.size)
