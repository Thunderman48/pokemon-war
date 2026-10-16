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


# ------------------------------------------------------------------ head
# Side profile facing right, modelled on the user's side-view references (official art + figure):
# the head is a thin, sharp beak tilted slightly down; a black almond eye sits near the top-front
# edge; the upper jaw has a red serrated lip and a small hooked fang at the tip; the lower jaw is a
# separate thin spike that drops away (a real gap between the jaws); a big broad crest horn sweeps
# up and back from the top of the head, with a second long horn behind it and a short cheek fin.
def head(cv, hx, hy, pal, mega=False, open_=1.0):
    """Draw the head with its neck point at (hx, hy). Returns the horn tips (absolute)."""
    # the whole head is tilted ~12 degrees nose-down around the neck point
    th = 0.21
    ct, st = math.cos(th), math.sin(th)

    def A(x, y):
        return (hx + x * ct - y * st, hy + x * st + y * ct)

    def px(x, y, c):
        X, Y = A(x + 0.5, y + 0.5)
        cv.set(X, Y, c)

    o = max(0.0, min(1.0, open_))
    h = 1.35 if mega else 1.0
    # horns (behind the head)
    if mega:
        tip_c = A(-16, -17)        # crest swept far back like Mega's
        tip_b = A(-30, -9)
    else:
        tip_c = A(-6, -20)         # big broad crest
        tip_b = A(-22, -11)        # second long horn behind it
    tip_j = A(-8 * h, 7 * h)       # short cheek fin
    cv.poly([A(-1, -4), A(3, -6.5), tip_b], pal["shadow"])                       # far horn
    cv.line(*A(2.5, -6.2), *tip_b, pal["dark"])
    cv.poly([A(0, -5), A(11, -6.3), tip_c], pal["mid"])                          # crest
    cv.line(*A(8.5, -6.6), *tip_c, pal["light"])
    cv.line(*A(7.5, -6.8), tip_c[0] + 0.5, tip_c[1] + 1.5, pal["hi"])
    cv.line(*A(1.5, -5.6), tip_c[0] + 0.3, tip_c[1] + 0.8, pal["dark"])
    cv.poly([A(-1.5, 0.5), A(3, 2), tip_j], pal["dark"])                         # cheek fin
    cv.line(*A(-1, 0.6), *tip_j, pal["mid"])

    # lower jaw: thin spike that swings from tucked-under (closed) to dropped (open)
    jx, jy = 20 + (16.5 - 20) * o, 2.2 + (9.5 - 2.2) * o
    cv.poly([A(4, 0.8), A(9, 1.0), A(jx, jy), A(jx - 1.6, jy + 0.9), A(4, 3.2)], pal["dark"])
    if o > 0.25:
        # throat at the corner of the mouth, red inner lip on the lower jaw
        cv.poly([A(7, 0.6), A(12, 0.9), A(8.5, 3.4)], pal["mouth"])
        cv.line(*A(8.5, 1.6), *A(jx - 0.6, jy - 0.4), pal["lip"])
        px(int(jx) - 2, int(jy) - 2, pal["fang"])

    # upper head: a thin beak tilted down, from the back of the skull to a hooked tip
    cv.poly([A(-2, -4.5), A(4, -6.8), A(10, -6), A(22, -1.8), A(24.2, 0.4), A(23, 1.8), A(21, 1.3),
             A(8, 1.0), A(0, 1.6)], pal["mid"])
    cv.line(*A(4, -6.4), *A(10, -5.6), pal["hi"])
    cv.line(*A(10, -5.6), *A(22, -1), pal["light"])
    cv.line(*A(-1, -4.2), *A(4, -6.2), pal["light"])
    cv.line(*A(0, 0.8), *A(8, 0.2), pal["dark"])
    # red lip with serrated teeth along the underside of the upper jaw
    if o > 0.25:
        # red lip on the jaw's bottom edge, with little serrated teeth attached to it
        cv.line(*A(8, 0.5), *A(21.5, 0.9), pal["lip"])
        for x in (11, 14, 17, 20):
            X, Y = A(x, 1.6)
            cv.set(X, Y, pal["lip"])
    else:
        cv.line(*A(8, 0.5), *A(21.5, 0.9), pal["shadow"])
    # small hooked fang at the tip
    X, Y = A(22.6, 2.1)
    cv.set(X, Y, pal["fang"])
    # black almond eye near the top-front edge, following the slope, yellow pupil toward the front
    for x0, y0 in ((10, -4), (11, -4), (12, -4), (13, -4), (14, -3), (15, -3), (16, -3), (17, -2),
                   (11, -3), (12, -3), (13, -3), (13, -2), (14, -2), (15, -2)):
        px(x0, y0, pal["black"])
    px(14, -3, pal["eye"])
    if mega:
        px(13, -3, pal["pupil"])
    # yellow line along the top of the head behind the crest
    cv.line(*A(2, -5.6), *A(-2, -3.8), pal["line"])
    cv.line(*A(-2, -3.8), *A(-3, -1), pal["line"])
    if mega:
        # gold lip line back to the cheek, black chin, forehead delta
        cv.line(*A(8, 1.6), *A(1, 2.4), pal["line"])
        cv.poly([A(jx - 3, jy - 1.5), A(jx, jy), A(jx - 1.6, jy + 0.9)], pal["black"])
        for dx, dy in ((7, -8), (6, -7), (8, -7)):
            px(dx, dy, pal["line"])
    return {"up": tip_c, "back": tip_b, "jaw": tip_j}


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
    W, H = 160, 70
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
    W, H = 180, 86
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


def fast_spine(x0, x1, y, phase, amp, n=18, rise=4):
    """Nearly straight body for fast flight: a long, quick ribbon ripple that is
    strongest at the tail and almost still at the neck (like Rayquaza in Pokemon GO)."""
    pts = []
    for i in range(n):
        w = i / (n - 1)  # 0 = tail, 1 = neck
        x = x0 + (x1 - x0) * w
        env = 1 - 0.8 * w
        pts.append((x, y - rise * w + amp * env * math.sin(2 * math.pi * (w * 1.15 + phase))))
    return pts


def rayquaza_fast(phase=0.0):
    W, H = 188, 52
    cv = Canvas(W, H)
    spine = fast_spine(10, 156, 34, phase, 4.0)
    nx, ny = spine[-1]
    tail_fin(cv, spine[0][0], spine[0][1], NORMAL)
    serpent(cv, spine, slim(2.6, 2.2), NORMAL, segments=22)
    arm(cv, nx - 9, ny + 3, NORMAL)
    head(cv, nx + 1, ny, NORMAL, open_=0.0)
    cv.outline()
    return cv.img


def mega_rayquaza_fast(phase=0.0):
    W, H = 214, 64
    cv = Canvas(W, H)
    spine = fast_spine(10, 176, 42, phase, 4.5)
    nx, ny = spine[-1]

    def black(s, v):
        k = int(s * 26)
        return (v < -0.2 and k % 2 == 1) or (s > 0.92 and v < 0)
    tail_fin(cv, spine[0][0], spine[0][1], MEGA, mega=True)
    tips = head(Canvas(W, H), nx + 1, ny, MEGA, mega=True, open_=0.0)
    gold, glow = (255, 186, 48), (255, 236, 150)
    ph = 2 * math.pi * phase
    # filaments stream straight back in the wind
    for (sx, sy), length, amp, off in ((tips["jaw"], 110, 2.5, 0.0), (tips["back"], 70, 2.0, 1.3)):
        pts = [(sx - t * length, sy + 2 * t + math.sin(t * math.pi * 4 - ph * 2 + off) * amp * t) for t in [i / 199 for i in range(200)]]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            cv.line(x0, y0, x1, y1, gold)
        for x, y in pts[::9]:
            cv.set(x, y - 1, glow)
    serpent(cv, spine, slim(3.0, 2.5), MEGA, segments=26, mega=True, black=black)
    arm(cv, nx - 10, ny + 3, MEGA)
    head(cv, nx + 1, ny, MEGA, mega=True, open_=0.0)
    cv.outline()
    return cv.img


def fast_sheet(fn):
    """One row of FRAMES fast-flight frames."""
    frames = [fn(i / FRAMES) for i in range(FRAMES)]
    w, h = frames[0].size
    out = Image.new("RGBA", (w * FRAMES, h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f, (i * w, 0))
    return out


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
