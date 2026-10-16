"""Procedural pixel art for Rayquaza and Mega Rayquaza (original fan art).

Style notes taken from the official game sprites (used only as visual
reference, nothing is copied): teal-green slender serpent body, thin yellow
lines running along each segment, red-trimmed plates and rudder fins, a long
flat wedge-shaped head with two long straight horns swept back plus two
shorter jaw horns, a wide open mouth with red lips, pink gums and white
fangs, small yellow eyes under a sharp brow, little arms with white claws and
an arrow-shaped tail fin. Mega: darker body with black underside, gold lips
and teeth, red eyes, a forehead delta and long glowing golden filaments.
Every pixel is a hard pixel (no anti-aliasing).
"""
import math
from PIL import Image

OUT = (22, 30, 34, 255)


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
        x, y = int(math.floor(x)), int(math.floor(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = tuple(c) + ((255,) if len(c) == 3 else ())

    def poly(self, pts, c):
        ys = [p[1] for p in pts]
        for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
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

    def line(self, x0, y0, x1, y1, c):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            t = i / n
            self.set(x0 + (x1 - x0) * t + 0.5, y0 + (y1 - y0) * t + 0.5, c)

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


# -------------------------------------------------------------------- palettes
NORMAL = {
    "hi": (150, 232, 196), "light": (98, 204, 156), "mid": (64, 170, 124), "dark": (42, 130, 96), "shadow": (28, 94, 72),
    "line": (250, 218, 74), "trim": (224, 72, 84), "trimdark": (160, 40, 60),
    "mouth": (104, 22, 40), "gum": (240, 124, 146), "lip": (222, 60, 72), "fang": (250, 250, 250),
    "eye": (250, 222, 70), "pupil": (20, 20, 24), "claw": (244, 244, 248),
    "black": (34, 34, 42), "blackhi": (58, 58, 70),
}
MEGA = {
    "hi": (120, 210, 160), "light": (74, 176, 128), "mid": (44, 138, 98), "dark": (28, 100, 72), "shadow": (18, 70, 52),
    "line": (255, 214, 70), "trim": (255, 176, 50), "trimdark": (210, 120, 30),
    "mouth": (110, 20, 40), "gum": (255, 200, 70), "lip": (255, 196, 50), "fang": (255, 230, 120),
    "eye": (226, 40, 40), "pupil": (255, 236, 90), "claw": (244, 244, 248),
    "black": (30, 32, 40), "blackhi": (56, 60, 72), "orb": (255, 170, 40), "orbcore": (255, 245, 190),
}


def serpent(cv, spine_pts, radius, pal, segments=10, mega=False, black=None):
    """Slim shaded body along a spline. radius(s) = half-thickness at s in [0, 1]."""
    sp = catmull(spine_pts, 700)
    acc = [0.0]
    for i in range(1, len(sp)):
        acc.append(acc[-1] + math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]))
    S = [a / acc[-1] for a in acc]
    tang = []
    for i in range(len(sp)):
        a, b = sp[max(0, i - 3)], sp[min(len(sp) - 1, i + 3)]
        d = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
        tang.append(((b[0] - a[0]) / d, (b[1] - a[1]) / d))

    def frame(i):
        (x, y), (tx, ty) = sp[i], tang[i]
        nx, ny = -ty, tx
        if ny > 0:
            nx, ny = -nx, -ny
        return x, y, tx, ty, nx, ny

    # red-trimmed rudder fins on alternate segments (drawn first, body overlaps the base)
    for k in range(1, segments - 1, 2):
        s0 = (k + 0.5) / segments
        i = min(range(len(S)), key=lambda j: abs(S[j] - s0))
        x, y, tx, ty, nx, ny = frame(i)
        r = radius(s0)
        bx, by = x + nx * r * 0.5, y + ny * r * 0.5
        b1 = (bx + tx * r * 1.0, by + ty * r * 1.0)
        b2 = (bx - tx * r * 0.6, by - ty * r * 0.6)
        ap = (bx + nx * (r + 3) - tx * 3.5, by + ny * (r + 3) - ty * 3.5)
        cv.poly([b1, ap, b2], pal["mid"])
        m1 = (b1[0] + (ap[0] - b1[0]) * 0.55, b1[1] + (ap[1] - b1[1]) * 0.55)
        m2 = (b2[0] + (ap[0] - b2[0]) * 0.55, b2[1] + (ap[1] - b2[1]) * 0.55)
        cv.poly([m1, ap, m2], pal["trim"])
        cv.set(ap[0], ap[1], pal["trim"])

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
            x, y, tx, ty, nx, ny = frame(best)
            v = ((cx - x) * nx + (cy - y) * ny) / max(r, 0.01)  # +1 top edge, -1 bottom edge
            k = min(segments - 1, int(s * segments))
            u = s * segments - k
            col = pal["mid"]
            if v > 0.35:
                col = pal["light"]
            if v > 0.75:
                col = pal["hi"]
            if v < -0.3:
                col = pal["dark"]
            if v < -0.7:
                col = pal["shadow"]
            if black and black(s, v):
                col = pal["black"] if v < 0.3 else pal["blackhi"]
            if r >= 1.8 and 0.04 < s < 0.96:
                if not mega:
                    # thin yellow lines along each segment that close into a long oval
                    edge = 0.12 < u < 0.88
                    if edge and abs(abs(v) - 0.5) < 0.17 and k % 2 == 0:
                        col = pal["line"]
                    if k % 2 == 0 and (abs(u - 0.12) < 0.05 or abs(u - 0.88) < 0.05) and abs(v) < 0.55:
                        col = pal["line"]
                else:
                    # Mega: glowing orange orbs + thin gold line along the top
                    e = ((u - 0.5) / 0.22) ** 2 + ((v - 0.1) / 0.55) ** 2
                    if k % 2 == 0 and e < 0.4:
                        col = pal["orbcore"]
                    elif k % 2 == 0 and e < 1.0:
                        col = pal["orb"]
            cv.set(px, py, col)
    return sp, S, tang


def head(cv, hx, hy, pal, mega=False):
    """Small, sharp, wedge-shaped head facing right with the jaw dropped wide open.
    (hx, hy) is where the neck meets the back of the skull."""
    def P(dx, dy):
        return (hx + dx, hy + dy)

    def poly(pts, c):
        cv.poly([P(*p) for p in pts], c)

    def line(a, b, c):
        (x0, y0), (x1, y1) = P(*a), P(*b)
        cv.line(x0, y0, x1, y1, c)

    def dot(dx, dy, c):
        cv.set(*P(dx, dy), c)

    h = 1.3 if mega else 1.0  # horn length
    # far-side horns, in shadow behind the head
    poly([(-1, -5), (3, -7), (-1 - 11 * h, -7 - 12 * h), (-2 - 11 * h, -6 - 11.5 * h)], pal["shadow"])
    poly([(0, 1), (3, 3), (-6 * h, 5 + 6 * h), (-7 * h, 4 + 5.5 * h)], pal["shadow"])
    # lower jaw dropped almost straight down under the eye
    poly([(3, 2), (6.5, 1.8), (12, 11.5), (11, 13), (9, 12.5), (3, 4.5)], pal["dark"])
    line((3.5, 4.2), (9.5, 12.3), pal["shadow"])
    # tall open mouth: dark throat, pink tongue, red lips
    poly([(6.5, 1.6), (15.5, 1.6), (11, 11.2)], pal["mouth"])
    poly([(7.5, 3), (10, 3.5), (11, 8.5), (9.5, 8.8)], pal["gum"])
    line((6.5, 1.4), (15.5, 1.4), pal["lip"])
    line((6.5, 2), (11, 11.2), pal["lip"])
    # skull: bulky brow tapering into a long, thick, pointed upper jaw
    poly([(-2, -2), (-1, -5), (3, -7), (7.5, -7.2), (11, -5.4), (16, -2.8), (21, 0.4), (18, 1.6),
          (15.5, 1.5), (6.5, 1.5), (2, 2), (-2, 1.5)], pal["mid"])
    line((-1, -4.6), (3, -6.6), pal["light"])
    line((3, -6.8), (7.5, -6.9), pal["hi"])
    line((8, -6.6), (16, -2.5), pal["hi"])
    line((8, -5.8), (15, -2.4), pal["light"])
    line((16, -2.4), (20.5, 0.4), pal["hi"])
    line((-1, 1), (6, 1.1), pal["dark"])
    line((15.5, 1.2), (19, 1.2), pal["dark"])
    # dark crease running from the eye down the snout to the nose
    line((12.5, -2.2), (19.5, 0.2), pal["dark"])
    dot(18.5, -0.4, pal["shadow"])
    # fangs: one hanging right at the snout tip, one further back
    dot(18.5, 2, pal["fang"])
    dot(18.5, 3, pal["fang"])
    dot(10, 2, pal["fang"])
    dot(10.6, 10, pal["fang"])
    # fierce eye: 2x2 yellow with the pupil in the front-bottom corner,
    # sunk in a dark socket under a brow that slants down toward the snout
    poly([(8.5, -5.2), (12.8, -4.2), (13, -1.8), (9, -1.8)], pal["shadow"])
    line((7.5, -6), (13.5, -3.6), pal["shadow"])
    dot(10, -4, pal["eye"])
    dot(11, -4, pal["eye"])
    dot(10, -3, pal["eye"])
    dot(11, -3, pal["pupil"])
    # yellow mark on the forehead
    line((2, -5.6), (5.5, -6.2), pal["line"])
    # near horns: broad flat blades, one rising almost vertically, one longer sweeping back
    tip_v = (4.5, -7 - 13 * h)
    poly([(2, -6.2), (6.5, -7), tip_v, (3, -7 - 12.5 * h)], pal["mid"])
    line((6, -7), tip_v, pal["light"])
    line((2.4, -6.4), (3.2, -7 - 12 * h), pal["dark"])
    tip_b = (-2 - 14 * h, -5.5 - 11.5 * h)
    poly([(-2.5, -3.5), (2, -6.5), tip_b, (-2.5 - 14 * h, -4 - 11 * h)], pal["mid"])
    line((1.5, -6.4), tip_b, pal["light"])
    line((-2.4, -3.8), (-2.2 - 13.5 * h, -4.4 - 10.8 * h), pal["dark"])
    # jaw horn sweeping back and down
    tip_j = (-1 - 10 * h, 6 + 3 * h)
    poly([(-1.5, 0), (2, 2.5), tip_j, (-1.5 - 10 * h, 4.5 + 2.5 * h)], pal["mid"])
    line((-1, 0.5), tip_j, pal["light"])
    if mega:
        # gold line from the lips to the jaw horn, black chin, delta on the forehead, eye marks
        line((6.5, 2), (-1, 3.5), pal["line"])
        poly([(9, 12.5), (12, 11.5), (12.5, 13.5), (10, 14)], pal["black"])
        line((4, -7.8), (3.2, -8.8), pal["line"])
        line((4, -7.8), (5, -8.6), pal["line"])
        dot(3, -8, pal["line"])
        line((6, -2.6), (3, -1.2), pal["black"])


def arm(cv, x, y, pal):
    cv.line(x, y, x + 1.5, y + 2.5, pal["dark"])
    cv.line(x + 1, y, x + 2.5, y + 2.5, pal["mid"])
    for dx, dy in ((0.5, 3.5), (1.5, 4.2), (2.5, 4.2), (3.5, 3.5)):
        cv.set(x + dx, y + dy, pal["claw"])


def tail_fin(cv, x, y, pal, mega=False):
    """Arrow-shaped tail fin pointing left from (x, y)."""
    fin = pal["trim"] if mega else pal["mid"]
    cv.poly([(x, y - 0.5), (x - 5, y - 6), (x - 3.5, y - 0.5)], fin)
    cv.poly([(x, y + 0.5), (x - 5, y + 6), (x - 3.5, y + 0.5)], pal["dark"] if not mega else pal["trimdark"])
    cv.poly([(x + 1, y - 1), (x - 5, y), (x + 1, y + 1)], fin)
    if not mega:
        cv.line(x - 1, y - 1, x - 5, y - 6, pal["trim"])
        cv.line(x - 1, y + 1, x - 5, y + 6, pal["trim"])
        cv.set(x - 5, y, pal["trim"])


def slim(tail, body, neck):
    """Thickness profile: thin tail tip, slender body, slightly thinner neck."""
    def rad(s):
        if s < 0.1:
            return 0.8 + s / 0.1 * (body - 0.8)
        if s < 0.88:
            return body + math.sin((s - 0.1) / 0.78 * math.pi) * 0.25
        return body + (neck - body) * (s - 0.88) / 0.12
    return rad


def rayquaza():
    W, H = 108, 46
    cv = Canvas(W, H)
    spine = [(8, 30), (12, 36), (18, 37), (23, 31), (27, 25), (32, 22), (37, 26), (41, 32), (46, 36), (52, 35),
             (57, 29), (61, 24), (66, 22), (71, 26), (75, 32), (80, 33), (84, 28), (86, 22)]
    tail_fin(cv, 8, 30, NORMAL)
    serpent(cv, spine, slim(0.8, 2.3, 2.0), NORMAL, segments=16)
    arm(cv, 81, 29, NORMAL)
    arm(cv, 84, 28, NORMAL)
    head(cv, 86, 22, NORMAL)
    cv.outline()
    return cv.img


def mega_rayquaza():
    W, H = 128, 62
    cv = Canvas(W, H)
    spine = [(9, 42), (13, 49), (20, 51), (26, 45), (31, 37), (37, 33), (43, 37), (48, 45), (54, 50), (61, 49),
             (67, 42), (72, 35), (78, 32), (84, 36), (89, 43), (95, 46), (100, 40), (103, 32)]

    def black(s, v):
        k = int(s * 18)
        return (v < -0.2 and k % 2 == 1) or (s > 0.9 and v < 0)
    tail_fin(cv, 9, 42, MEGA, mega=True)
    hx, hy = 103, 32
    h = 1.3
    up_tip = (hx + 4.5, hy - 7 - 13 * h)
    back_tip = (hx - 2 - 14 * h, hy - 5.5 - 11.5 * h)
    lo_tip = (hx - 1 - 10 * h, hy + 6 + 3 * h)
    gold, glow = (255, 186, 48), (255, 236, 150)
    # long golden filaments from the jaw horns, rippling back over the body
    pts = []
    for i in range(160):
        t = i / 159
        pts.append((lo_tip[0] - t * 60, lo_tip[1] - 8 * t + math.sin(t * math.pi * 3) * 3.5))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cv.line(x0, y0, x1, y1, gold)
    for x, y in pts[::8]:
        cv.set(x, y - 1, glow)
    ex, ey = pts[-1]
    cv.poly([(ex + 1, ey), (ex - 4, ey - 4), (ex - 3, ey), (ex - 4, ey + 4)], MEGA["mid"])
    cv.set(ex - 2, ey, gold)
    # filament from the swept-back horn ending in a spiked ring
    pts2 = []
    for i in range(70):
        t = i / 69
        pts2.append((back_tip[0] - t * 22, back_tip[1] + math.sin(t * math.pi) * -2 + t * 5))
    for (x0, y0), (x1, y1) in zip(pts2, pts2[1:]):
        cv.line(x0, y0, x1, y1, gold)
    rx, ry = pts2[-1]
    for a in range(0, 360, 45):
        cv.set(rx + math.cos(math.radians(a)) * 2.2, ry + math.sin(math.radians(a)) * 2.2, gold)
        cv.set(rx + math.cos(math.radians(a)) * 3.4, ry + math.sin(math.radians(a)) * 3.4, glow)
    cv.set(rx, ry, glow)
    # small glowing tip on the upright horn
    cv.set(up_tip[0], up_tip[1] - 1, glow)
    serpent(cv, spine, slim(0.8, 2.7, 2.3), MEGA, segments=18, mega=True, black=black)
    arm(cv, 98, 38, MEGA)
    arm(cv, 101, 37, MEGA)
    head(cv, hx, hy, MEGA, mega=True)
    cv.outline()
    return cv.img


if __name__ == "__main__":
    import sys
    for name, fn in (("rayquaza", rayquaza), ("megarayquaza", mega_rayquaza)):
        im = fn()
        im.resize((im.width * 8, im.height * 8), Image.NEAREST).save(f"{sys.argv[1]}/{name}_big.png")
