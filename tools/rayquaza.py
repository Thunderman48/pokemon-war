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
    "mouth": (150, 84, 116), "gum": (214, 150, 186), "lip": (190, 74, 104), "fang": (250, 250, 250),
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
    """Long, clearly segmented body along a spline. radius(s) = half-thickness at s in [0, 1].
    Every segment gets a yellow oval ring; joints get a dark seam, and every other joint
    sprouts red-edged fin plates above and below (like the official figure)."""
    sp = catmull(spine_pts, 1200)
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

    def at(s0):
        return min(range(len(S)), key=lambda j: abs(S[j] - s0))

    # fin plates at every other joint (drawn first so the body covers their roots)
    for k in range(2, segments - 1, 2):
        i = at(k / segments)
        x, y, tx, ty, nx, ny = frame(i)
        r = radius(k / segments)
        for side in (1, -1):
            out = r + (4.2 if side > 0 else 3.4)
            bx, by = x + nx * side * (r - 0.5), y + ny * side * (r - 0.5)
            q = [(bx + tx * 2.2, by + ty * 2.2), (bx - tx * 2.2, by - ty * 2.2)]
            q += [(q[1][0] + nx * side * (out - r) - tx * 1.5, q[1][1] + ny * side * (out - r) - ty * 1.5),
                  (q[0][0] + nx * side * (out - r) - tx * 1.0, q[0][1] + ny * side * (out - r) - ty * 1.0)]
            cv.poly(q, pal["trim"])
            inner = [(q[0][0] - tx * 0.6 + nx * side * 0.2, q[0][1] - ty * 0.6 + ny * side * 0.2),
                     (q[1][0] + tx * 0.6, q[1][1] + ty * 0.6),
                     (q[2][0] + tx * 0.6 - nx * side * 1, q[2][1] + ty * 0.6 - ny * side * 1),
                     (q[3][0] - tx * 0.6 - nx * side * 1, q[3][1] - ty * 0.6 - ny * side * 1)]
            cv.poly(inner, pal["mid"] if side > 0 else pal["dark"])

    xs = [p[0] for p in sp]
    ys = [p[1] for p in sp]
    maxr = max(radius(s) for s in S)
    for py in range(int(min(ys) - maxr - 2), int(max(ys) + maxr + 3)):
        for px in range(int(min(xs) - maxr - 2), int(max(xs) + maxr + 3)):
            cx, cy = px + 0.5, py + 0.5
            best, bd = -1, 1e9
            for j in range(0, len(sp), 3):
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
            if v > 0.3:
                col = pal["light"]
            if v > 0.72:
                col = pal["hi"]
            if v < -0.3:
                col = pal["dark"]
            if v < -0.7:
                col = pal["shadow"]
            if black and black(s, v):
                col = pal["black"] if v < 0.3 else pal["blackhi"]
            if r >= 1.8 and 0.03 < s < 0.97:
                seglen = acc[-1] / segments
                # dark seam between segments
                if u * seglen < 0.9 or (1 - u) * seglen < 0.5:
                    col = pal["black"] if mega else pal["shadow"]
                elif not mega:
                    # a long yellow oval ring on every segment
                    e = ((u - 0.5) / 0.33) ** 2 + (v / 0.6) ** 2
                    if abs(e - 1) < 0.3:
                        col = pal["line"]
                else:
                    # Mega: glowing orbs on alternating segments, cream lines on the rest
                    e = ((u - 0.5) / 0.2) ** 2 + ((v - 0.1) / 0.55) ** 2
                    if k % 2 == 0 and e < 0.45:
                        col = pal["orbcore"]
                    elif k % 2 == 0 and e < 1.0:
                        col = pal["orb"]
                    elif k % 2 == 1 and abs(v - 0.15) < 0.17 and 0.15 < u < 0.85:
                        col = pal["line"]
            cv.set(px, py, col)
    return sp, S, tang


# ------------------------------------------------------------------ head (hand-placed pixels)
# Facing right. Drawn from the user's reference art: a compact wedge head with a crest spike
# above a long, angry almond eye, a yellow-outlined plate behind the eye, a thin snout that
# slopes to a small hooked fang, and a deep mouth that opens downward like a beak.
# K outline, H/L/M/D/S greens, Y yellow line, E iris, P pupil, R lip, O mouth, G tongue, W tooth.
HEAD_UPPER = [
    ".......K................",
    "......KHK...............",
    "...KKKLMMKKK............",
    "..KMMYYYMMMMKKK.........",
    ".KMMYMMMKKKKKKMKK.......",
    "KMMMYMMKKKKKKKKKMKK.....",
    "KMMMYMMMKKKKKKEPKHHKK...",
    "KMMMMYMMMMMMKKKMMMMMLHK.",
    ".KMMMMYMMMMMMMMMMMMMMMHK",
]
HEAD_JAW = {
    "open": [
        ".KDMMMYMRRRRRRRRRRRRRKWK",
        "..KDDMMROWOOWOOWOOOOK.K.",
        "..KDDDDROGGGOOOOOOOK....",
        "...KDDDROGGGGOOOOOK.....",
        "...KDDDDROGGOOOOOK......",
        "....KDDDDROOOOOWK.......",
        ".....KKDDDDRRRRK........",
        ".......KKKDDDDDK........",
        "..........KKKKK.........",
    ],
    "half": [
        ".KDMMMYMRRRRRRRRRRRRRKWK",
        "..KDDMMROWOOWOOWOOKK.K..",
        "..KDDDDROGGOOOOOKK......",
        "...KKDDDDRROOOWK........",
        ".....KKDDDDRRRRK........",
        ".......KKKKDDDDK........",
        "...........KKKK.........",
    ],
    "closed": [
        ".KDMMMYMSSSSSSSSSSSSSSWK",
        "..KDDDDDDDDDDDDDDDDDKK..",
        "...KKDDDDDDDDDDDDKK.....",
        ".....KKKKKKKKKKKK.......",
    ],
}
HEAD_NECK = (2, 12)  # grid pixel where the neck joins


def head(cv, hx, hy, pal, mega=False, open_=1.0):
    """Draw the head with its neck point at (hx, hy). Returns the horn tips (absolute)."""
    ox, oy = int(round(hx)) - HEAD_NECK[0], int(round(hy)) - HEAD_NECK[1]

    def A(x, y):
        return (ox + x, oy + y)

    h = 1.3 if mega else 1.0
    # horns first (head pixels overlap their roots): upright horn leaning forward,
    # long horn sweeping back, long jaw horn hanging back
    tip_v = A(12 * h, -11 * h)
    tip_b = A(-22 * h, -8 * h)
    tip_j = A(-14 * h, 23 * h)
    # far-side copy of the upright horn, then the broad flat upright horn leaning forward
    cv.poly([A(8, 2), A(11, 2), (tip_v[0] + 3, tip_v[1] + 2)], pal["shadow"])
    cv.poly([A(3, 3), A(10, 2), tip_v, A(8 * h, -8 * h)], pal["mid"])
    cv.line(*A(9.5, 2), *tip_v, pal["light"])
    cv.line(*A(3.5, 3), tip_v[0] - 2, tip_v[1] + 2, pal["dark"])
    # long horn sweeping back
    cv.poly([A(1, 8), A(4, 3), tip_b], pal["mid"])
    cv.line(*A(3.5, 3.4), *tip_b, pal["light"])
    cv.line(*A(1.5, 7.5), tip_b[0] + 1, tip_b[1] + 1, pal["dark"])
    # long jaw horn hanging back
    cv.poly([A(0, 12), A(4, 15), tip_j], pal["mid"])
    cv.line(*A(0.5, 12.5), *tip_j, pal["light"])
    cv.line(*A(3.5, 14.5), *tip_j, pal["dark"])

    jaw = "open" if open_ > 0.6 else "half" if open_ > 0.25 else "closed"
    rows = HEAD_UPPER + HEAD_JAW[jaw]
    cmap = {
        "K": OUT[:3], "H": pal["hi"], "L": pal["light"], "M": pal["mid"], "D": pal["dark"], "S": pal["shadow"],
        "Y": pal["line"], "E": pal["eye"], "P": pal["pupil"], "R": pal["lip"], "O": pal["mouth"], "G": pal["gum"],
        "W": pal["fang"],
    }
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            c = cmap[ch]
            if mega and ch == "D" and y >= 11:
                c = pal["black"]  # Mega's black chin
            cv.set(ox + x, oy + y, c)
    if mega:
        # golden delta on the forehead and a gold line from the lips back to the jaw horn
        for dx, dy in ((6, -1), (5, 0), (7, 0)):
            cv.set(ox + dx, oy + dy, pal["line"])
        cv.line(*A(2, 11), *A(-3, 13), pal["line"])
    return {"up": tip_v, "back": tip_b, "jaw": tip_j}


def arm(cv, x, y, pal):
    cv.line(x, y, x + 1.5, y + 2.5, pal["dark"])
    cv.line(x + 1, y, x + 2.5, y + 2.5, pal["mid"])
    for dx, dy in ((0.5, 3.5), (1.5, 4.2), (2.5, 4.2), (3.5, 3.5)):
        cv.set(x + dx, y + dy, pal["claw"])


def tail_fin(cv, x, y, pal, mega=False):
    """Small fin at the pointed tail tip (pointing left)."""
    c1 = pal["trim"]
    cv.poly([(x + 1, y - 0.5), (x - 4, y - 5), (x - 2, y - 0.5)], c1)
    cv.poly([(x + 1, y + 0.5), (x - 4, y + 5), (x - 2, y + 0.5)], c1)
    cv.poly([(x + 1, y - 0.8), (x - 4, y), (x + 1, y + 0.8)], pal["mid"])


def slim(body, neck):
    """Thickness profile: needle-thin tail, steady body, slightly thinner neck."""
    def rad(s):
        if s < 0.12:
            return 0.7 + s / 0.12 * (body - 0.7)
        if s < 0.9:
            return body
        return body + (neck - body) * (s - 0.9) / 0.1
    return rad


FRAMES = 8  # flying animation frames


def wave(spine, phase, amp):
    """Send a ripple from the neck back to the tail: displace spine points
    perpendicular-ish (vertically), strongest at the tail, nearly still at the head."""
    n = len(spine)
    out = []
    for i, (x, y) in enumerate(spine):
        w = i / (n - 1)  # 0 = tail, 1 = neck
        env = 1 - 0.88 * w ** 1.5
        out.append((x, y + amp * env * math.sin(2 * math.pi * (w * 1.6 + phase))))
    return out


def rayquaza(phase=0.0, open_=0.2):
    W, H = 152, 70
    cv = Canvas(W, H)
    # big S-curves, like the official figure
    base = [(8, 29), (14, 39), (22, 49), (32, 55), (43, 54), (51, 47), (56, 37), (62, 28), (71, 22), (82, 23),
            (91, 30), (97, 40), (104, 49), (114, 53), (124, 48), (129, 39), (130, 31)]
    spine = wave(base, phase, 2.4)
    d = [p[1] - q[1] for p, q in zip(spine, base)]
    tail_fin(cv, spine[0][0], spine[0][1], NORMAL)
    serpent(cv, spine, slim(2.6, 2.2), NORMAL, segments=22)
    arm(cv, 123, 45 + d[-3], NORMAL)
    arm(cv, 127, 44 + d[-2], NORMAL)
    head(cv, 131, 31 + d[-1], NORMAL, open_=open_)
    cv.outline()
    return cv.img


def mega_rayquaza(phase=0.0, open_=0.2):
    W, H = 172, 86
    cv = Canvas(W, H)
    base = [(8, 40), (14, 51), (23, 61), (34, 67), (46, 66), (55, 58), (61, 47), (68, 37), (78, 31), (90, 32),
            (100, 40), (107, 51), (115, 61), (126, 65), (137, 59), (143, 49), (145, 41)]
    spine = wave(base, phase, 2.8)
    d = [p[1] - q[1] for p, q in zip(spine, base)]

    def black(s, v):
        k = int(s * 26)
        return (v < -0.2 and k % 2 == 1) or (s > 0.92 and v < 0)
    tail_fin(cv, spine[0][0], spine[0][1], MEGA, mega=True)
    hx, hy = 146, 41 + d[-1]
    # draw the head first on a scratch canvas just to get the horn tips
    tips = head(Canvas(W, H), hx, hy, MEGA, mega=True)
    gold, glow = (255, 186, 48), (255, 236, 150)
    ph = 2 * math.pi * phase
    # long golden filaments from the jaw horn, rippling back over the body
    jx, jy = tips["jaw"]
    pts = []
    for i in range(200):
        t = i / 199
        pts.append((jx - t * 70, jy + 4 * t + math.sin(t * math.pi * 3 + ph) * 3.5 * t + math.sin(t * math.pi * 3) * 1.5))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cv.line(x0, y0, x1, y1, gold)
    for i, (x, y) in enumerate(pts[::8]):
        if (i + int(phase * FRAMES)) % 3 == 0:
            cv.set(x, y - 1, glow)
    ex, ey = pts[-1]
    cv.poly([(ex + 1, ey), (ex - 4, ey - 4), (ex - 3, ey), (ex - 4, ey + 4)], MEGA["mid"])
    # filament from the swept-back horn ending in a spiked ring
    bx, by = tips["back"]
    pts2 = []
    for i in range(80):
        t = i / 79
        pts2.append((bx - t * 22, by - math.sin(t * math.pi) * 2 + t * 3 + math.sin(t * math.pi * 2 + ph) * 1.5 * t))
    for (x0, y0), (x1, y1) in zip(pts2, pts2[1:]):
        cv.line(x0, y0, x1, y1, gold)
    rx, ry = pts2[-1]
    for a in range(0, 360, 45):
        a2 = a + phase * 45
        cv.set(rx + math.cos(math.radians(a2)) * 2.2, ry + math.sin(math.radians(a2)) * 2.2, gold)
        cv.set(rx + math.cos(math.radians(a2)) * 3.4, ry + math.sin(math.radians(a2)) * 3.4, glow)
    cv.set(rx, ry, glow)
    serpent(cv, spine, slim(3.0, 2.5), MEGA, segments=26, mega=True, black=black)
    arm(cv, 138, 55 + d[-3], MEGA)
    arm(cv, 142, 54 + d[-2], MEGA)
    head(cv, hx, hy, MEGA, mega=True, open_=open_)
    cv.outline()
    return cv.img


def sheet(fn):
    """Sprite sheet: row 0 = flying with the mouth mostly closed (it opens and closes
    a little as it flies), row 1 = the same frames with the jaw wide open (attacking)."""
    rows = []
    for row in range(2):
        frames = []
        for i in range(FRAMES):
            ph = i / FRAMES
            o = 0.05 + 0.4 * (0.5 - 0.5 * math.cos(2 * math.pi * ph)) if row == 0 else 1.0
            frames.append(fn(ph, open_=o))
        rows.append(frames)
    w, h = rows[0][0].size
    out = Image.new("RGBA", (w * FRAMES, h * 2), (0, 0, 0, 0))
    for r, frames in enumerate(rows):
        for i, f in enumerate(frames):
            out.paste(f, (i * w, r * h))
    return out


if __name__ == "__main__":
    import sys
    for name, fn in (("rayquaza", rayquaza), ("megarayquaza", mega_rayquaza)):
        im = fn()
        im.resize((im.width * 6, im.height * 6), Image.NEAREST).save(f"{sys.argv[1]}/{name}_big.png")
        sh = sheet(fn)
        sh.save(f"{sys.argv[1]}/{name}_anim.png")
