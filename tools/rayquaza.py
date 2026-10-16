"""Procedural pixel art for Rayquaza and Mega Rayquaza (original fan art).

The serpent body is built along a smooth spine curve with per-pixel shading,
then segment markings, fins, head, horns, claws (and Mega's filaments) are
painted on top. Every pixel is a hard pixel (no anti-aliasing).
"""
import math
from PIL import Image

OUT = (26, 22, 34, 255)


def catmull(points, n=400):
    """Sample a Catmull-Rom spline through points -> list of (x, y)."""
    pts = [points[0]] + points + [points[-1]]
    out = []
    segs = len(points) - 1
    for i in range(segs):
        p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
        steps = max(2, n // segs)
        for k in range(steps):
            t = k / steps
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(points[-1])
    return out


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()

    def set(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = tuple(c) + ((255,) if len(c) == 3 else ())

    def get(self, x, y):
        return self.px[x, y]

    def poly(self, pts, c):
        """Fill a polygon (even-odd scanline)."""
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            yc = y + 0.5
            xs = []
            for i in range(len(pts)):
                (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
                if (y1 <= yc < y2) or (y2 <= yc < y1):
                    xs.append(x1 + (yc - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(int(math.floor(a + 0.5)), int(math.floor(b + 0.5))):
                    self.set(x, y, c)

    def line(self, x0, y0, x1, y1, c, w=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n + 1):
            t = i / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            if w == 1:
                self.set(x, y, c)
            else:
                for dx in range(-(w // 2), w - w // 2):
                    for dy in range(-(w // 2), w - w // 2):
                        self.set(x + dx, y + dy, c)

    def disc(self, cx, cy, r, c):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                    self.set(x, y, c)

    def outline(self):
        src = self.img.copy()
        sp = src.load()
        for y in range(self.h):
            for x in range(self.w):
                if sp[x, y][3]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and sp[nx, ny][3] and sp[nx, ny] != OUT:
                        self.px[x, y] = OUT
                        break


def serpent(cv, spine_pts, radius, pal, segments=10, marking="ring", fins=True, black=None):
    """Draw a shaded serpent body. radius(s) gives half-thickness at arc position s in [0,1]."""
    sp = catmull(spine_pts, 600)
    # arc length
    acc = [0.0]
    for i in range(1, len(sp)):
        acc.append(acc[-1] + math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]))
    L = acc[-1]
    S = [a / L for a in acc]
    tang = []
    for i in range(len(sp)):
        a, b = sp[max(0, i - 2)], sp[min(len(sp) - 1, i + 2)]
        d = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
        tang.append(((b[0] - a[0]) / d, (b[1] - a[1]) / d))

    def seg_of(s):
        return min(segments - 1, int(s * segments))

    # fins first so the body covers their base
    if fins:
        for k in range(segments):
            if k % 2 == 0 or k == segments - 1:
                continue
            s0 = (k + 0.5) / segments
            i = min(range(len(S)), key=lambda j: abs(S[j] - s0))
            (x, y), (tx, ty) = sp[i], tang[i]
            r = radius(s0)
            # normal pointing "up" on screen
            nx, ny = -ty, tx
            if ny > 0:
                nx, ny = -nx, -ny
            for side, size in ((1, 1.0), (-1, 0.6)):
                bx, by = x + nx * r * side * 0.6, y + ny * r * side * 0.6
                base1 = (bx + tx * r * 0.9, by + ty * r * 0.9)
                base2 = (bx - tx * r * 0.7, by - ty * r * 0.7)
                apex = (bx + nx * side * r * 2.0 * size - tx * r * 1.6 * size, by + ny * side * r * 2.0 * size - ty * r * 1.6 * size)
                cv.poly([base1, apex, base2], pal["fin"])
                tipb1 = (base1[0] + (apex[0] - base1[0]) * 0.5, base1[1] + (apex[1] - base1[1]) * 0.5)
                tipb2 = (base2[0] + (apex[0] - base2[0]) * 0.5, base2[1] + (apex[1] - base2[1]) * 0.5)
                cv.poly([tipb1, apex, tipb2], pal["fintip"])

    # body pixels: nearest spine sample decides shading and markings
    xs = [p[0] for p in sp]
    ys = [p[1] for p in sp]
    maxr = max(radius(s) for s in S)
    for py in range(int(min(ys) - maxr - 2), int(max(ys) + maxr + 3)):
        for px in range(int(min(xs) - maxr - 2), int(max(xs) + maxr + 3)):
            cx, cy = px + 0.5, py + 0.5
            best, bd = -1, 1e9
            for j in range(0, len(sp), 2):
                d = (sp[j][0] - cx) ** 2 + (sp[j][1] - cy) ** 2
                if d < bd:
                    bd, best = d, j
            s = S[best]
            r = radius(s)
            if math.sqrt(bd) > r:
                continue
            (sx, sy), (tx, ty) = sp[best], tang[best]
            nx, ny = -ty, tx
            if ny > 0:
                nx, ny = -nx, -ny
            v = ((cx - sx) * nx + (cy - sy) * ny) / max(r, 0.01)  # +1 = top edge
            k = seg_of(s)
            u = s * segments - k
            col = pal["mid"]
            if v > 0.45:
                col = pal["light"]
            if v > 0.8:
                col = pal["hi"]
            if v < -0.35:
                col = pal["dark"]
            if v < -0.75:
                col = pal["shadow"]
            # belly stripe slightly lighter/different
            if black and black(s, v):
                col = pal["black"] if v < 0.4 else pal["blackhi"]
            # markings on alternating segments
            if k % 2 == 0 and r >= 2.5 and 0.08 < s < 0.97:
                if marking == "ring":
                    e = ((u - 0.5) / 0.42) ** 2 + (v / 0.58) ** 2
                    if abs(e - 1) < 0.36:
                        col = pal["mark"]
                    elif abs(e - 1) < 0.62 and v < 0:
                        col = pal["markdark"]
                    # thin centre line linking the ovals
                    if abs(v - 0.05) < 0.14 and (u < 0.13 or u > 0.87):
                        col = pal["mark"]
                elif marking == "orb":
                    e = ((u - 0.5) / 0.3) ** 2 + ((v - 0.05) / 0.5) ** 2
                    if e < 0.35:
                        col = pal["orbcore"]
                    elif e < 1.0:
                        col = pal["orb"]
                    elif e < 1.6 and v > -0.6:
                        col = pal["mark"]
            cv.set(px, py, col)
    return sp, S, tang


# -------------------------------------------------------------------- palettes
NORMAL = {
    "hi": (140, 222, 140), "light": (86, 190, 108), "mid": (52, 156, 86), "dark": (34, 116, 66), "shadow": (22, 82, 52),
    "mark": (250, 214, 62), "markdark": (196, 150, 30), "fin": (52, 156, 86), "fintip": (222, 56, 52),
    "black": (34, 34, 42), "blackhi": (60, 60, 72),
}
MEGA = {
    "hi": (120, 214, 128), "light": (64, 172, 92), "mid": (36, 130, 72), "dark": (24, 96, 56), "shadow": (16, 66, 42),
    "mark": (255, 226, 90), "markdark": (210, 160, 40), "fin": (36, 130, 72), "fintip": (255, 210, 60),
    "orb": (255, 214, 64), "orbcore": (255, 255, 210), "black": (30, 30, 38), "blackhi": (58, 58, 70),
}


def head(cv, hx, hy, pal, mega=False, k=1.0):
    """Head facing right. (hx, hy) is where the neck joins the back of the skull; k scales it."""
    G, L, D, S = pal["mid"], pal["light"], pal["dark"], pal["shadow"]
    Y = pal["mark"]
    P = lambda dx, dy: (hx + dx * k, hy + dy * k)  # noqa: E731

    def poly(pts, c):
        cv.poly([P(*q) for q in pts], c)

    def line(a, b, c, w=1):
        (x0, y0), (x1, y1) = P(*a), P(*b)
        cv.line(x0, y0, x1, y1, c, w)

    def dot(dx, dy, c):
        x, y = P(dx, dy)
        cv.set(x, y, c)

    h = 1.25 if mega else 1.0  # horn length
    # far-side horns (dark), forming the "X" with the near ones
    poly([(2, -3), (-9 * h, -10 * h), (-6 * h, -7 * h), (1, -1)], S)
    poly([(1, 3), (-8 * h, 8 * h), (-5 * h, 5 * h), (0, 1)], S)
    # skull and snout
    poly([(-1, -3), (4, -5), (8, -4.5), (15, -2.5), (16, 0), (15, 1.2), (7, 1.2), (2, 4), (-1, 2)], G)
    line((1, -4), (7, -4.6), L)
    line((8, -3.6), (14, -2), L)
    line((2, -3), (6, -3.6), pal["hi"])
    # open mouth: dark throat, gums, lower jaw
    gum = (220, 64, 76) if not mega else (236, 186, 50)
    poly([(6, 1.2), (15, 1.2), (13, 3.2), (6, 3.2)], (120, 24, 40))
    line((7, 1.2), (15, 1.2), gum)
    poly([(3, 3.2), (13, 3.2), (12, 5.5), (3, 5.2)], D)
    line((4, 3.4), (12, 3.4), gum)
    fang = (250, 250, 250) if not mega else (255, 224, 100)
    dot(13, 2, fang)
    dot(10, 2.2, fang)
    dot(11, 4.2, fang)
    dot(14, -1.2, S)  # nostril
    # sunken, heavy-lidded eye
    for dx in (5, 6, 7, 8):
        dot(dx, -3.4, S)
    iris, pupil = ((220, 40, 40), (255, 236, 90)) if mega else ((250, 214, 62), (24, 20, 26))
    dot(5.5, -2.3, iris)
    dot(6.5, -2.3, pupil)
    dot(7.5, -2.3, iris)
    # near-side horns with yellow stripes
    poly([(2, -3.5), (5, -5), (-10 * h, -13 * h), (-5 * h, -8 * h)], G)
    line((3, -4.3), (-9 * h, -12.2 * h), Y)
    poly([(1, 2), (3, 4), (-9 * h, 10 * h), (-4 * h, 5.5 * h)], D)
    line((2, 3), (-8 * h, 9.2 * h), Y)
    # yellow cheek marking
    line((0, 0), (5, -1), Y)
    if mega:
        poly([(3, 3.2), (12, 3.2), (11, 5.5), (3, 5.2)], pal["black"])
        line((4, 4.2), (11, 4.2), (255, 220, 90))
        line((3.5, -1.8), (1, -0.5), pal["black"])
        line((2, -1.2), (0, 0.4), pal["black"])
        # delta on the forehead
        dot(4, -5.4, Y)
        dot(3.3, -4.6, Y)
        dot(4.7, -4.6, Y)
        dot(4, -4.6, Y)


def arm(cv, x, y, pal, d=1):
    cv.line(x, y, x + 2 * d, y + 3, pal["dark"], 2)
    for k in range(3):
        cv.set(x + 2 * d + k - 1, y + 5, (236, 236, 240))
    cv.set(x + 2 * d, y + 4, pal["mid"])


def rayquaza():
    W, H = 66, 46
    cv = Canvas(W, H)
    spine = [(3, 32), (8, 39), (15, 38), (20, 30), (26, 23), (32, 26), (37, 34), (43, 36), (48, 29), (46, 22)]

    def rad(s):
        if s < 0.12:
            return 1.2 + s / 0.12 * 2.8
        return min(5.0, 4.0 + (s - 0.12) * 4) if s < 0.5 else 5.0 - (s - 0.5) * 1.6
    # tail fin
    cv.poly([(4, 31), (0, 23), (2, 30)], NORMAL["fin"])
    cv.poly([(1, 25), (0, 23), (2, 27)], NORMAL["fintip"])
    cv.poly([(4, 33), (0, 39), (3, 34)], NORMAL["fin"])
    cv.poly([(1, 37), (0, 39), (2, 36)], NORMAL["fintip"])
    serpent(cv, spine, rad, NORMAL)
    arm(cv, 44, 30, NORMAL)
    head(cv, 45, 19, NORMAL, k=1.25)
    cv.outline()
    return cv.img


def mega_rayquaza():
    W, H = 84, 60
    cv = Canvas(W, H)
    spine = [(4, 42), (9, 51), (17, 52), (23, 43), (29, 34), (36, 37), (42, 47), (50, 50), (57, 43), (61, 35), (59, 29)]

    def rad(s):
        if s < 0.1:
            return 1.2 + s / 0.1 * 3.3
        return min(5.6, 4.5 + (s - 0.1) * 4) if s < 0.5 else 5.6 - (s - 0.5) * 1.6

    def black(s, v):
        # black underside on alternating segments + neck/chin
        k = int(s * 12)
        return (v < -0.25 and k % 3 == 1) or (s > 0.9 and v < 0.1)
    # long yellow tail fins
    cv.poly([(5, 41), (0, 30), (2, 32), (3, 40)], MEGA["fintip"])
    cv.poly([(5, 43), (0, 54), (2, 52), (3, 44)], MEGA["fintip"])
    sp, S, tang = serpent(cv, spine, rad, MEGA, segments=12, marking="orb", black=black)
    # golden filaments trailing from the lower horns back along the body
    hx, hy = 58, 26
    k, hl = 1.35, 1.25  # head scale and horn length (must match head())
    lo_tip = (hx - 9 * hl * k, hy + 10 * hl * k)
    up_tip = (hx - 10 * hl * k, hy - 13 * hl * k)
    gold, goldl = (240, 190, 40), (255, 236, 140)
    pts = []
    for i in range(90):
        t = i / 89
        x = lo_tip[0] - t * 38
        y = lo_tip[1] + math.sin(t * math.pi * 2.2) * 3 - t * 10
        pts.append((x, y))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cv.line(x0, y0, x1, y1, gold)
    for x, y in pts[::6]:
        cv.set(x, y - 1, goldl)
    # filament end fin with ring pattern
    ex, ey = pts[-1]
    cv.poly([(ex + 2, ey), (ex - 4, ey - 4), (ex - 6, ey + 1), (ex - 3, ey + 3)], MEGA["mid"])
    cv.set(ex - 3, ey, MEGA["mark"])
    cv.set(ex - 2, ey - 1, MEGA["mark"])
    cv.set(ex - 4, ey + 1, MEGA["mark"])
    # upper horn filament ending in a spiked ring
    pts2 = []
    for i in range(50):
        t = i / 49
        pts2.append((up_tip[0] - t * 18, up_tip[1] + math.sin(t * math.pi) * 2 + t * 4))
    for (x0, y0), (x1, y1) in zip(pts2, pts2[1:]):
        cv.line(x0, y0, x1, y1, gold)
    rx, ry = pts2[-1]
    for a in range(0, 360, 45):
        cv.set(rx + math.cos(math.radians(a)) * 2.5, ry + math.sin(math.radians(a)) * 2.5, gold)
        cv.set(rx + math.cos(math.radians(a)) * 3.5, ry + math.sin(math.radians(a)) * 3.5, goldl)
    cv.set(rx, ry, (255, 255, 220))
    arm(cv, 56, 39, MEGA)
    head(cv, hx, hy, MEGA, mega=True, k=k)
    cv.outline()
    return cv.img


if __name__ == "__main__":
    import sys
    for name, fn in (("rayquaza", rayquaza), ("megarayquaza", mega_rayquaza)):
        im = fn()
        im.resize((im.width * 8, im.height * 8), Image.NEAREST).save(f"{sys.argv[1]}/{name}_big.png")
