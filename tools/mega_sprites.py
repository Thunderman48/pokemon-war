"""Mega Evolution sprites, built from the final-evolution sprites plus painted-on Mega features.

Run through make_assets.py (it imports `build`)."""


def place(base, w, h, ox, oy, overlays=(), erase=()):
    """Base sprite rows placed at (ox, oy) on a w x h canvas, then overlays drawn on top.
    erase: list of (x, y, w, h) rectangles (canvas coords) cleared before the overlays."""
    grid = [["."] * w for _ in range(h)]
    for y, row in enumerate(base):
        for x, ch in enumerate(row):
            if ch != ".":
                grid[y + oy][x + ox] = ch
    for (ex, ey, ew, eh) in erase:
        for y in range(ey, ey + eh):
            for x in range(ex, ex + ew):
                if 0 <= x < w and 0 <= y < h:
                    grid[y][x] = "."
    for (px, py, rows) in overlays:
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch not in ". ":
                    if 0 <= x + px < w and 0 <= y + py < h:
                        grid[y + py][x + px] = "." if ch == "_" else ch
    return ["".join(r) for r in grid]


def build(S):
    out = {}
    # Mega Charizard Y: swept-back horns, huge clawed wings, a bigger tail flame
    out["megacharizard"] = place(S["charizard"], 32, 27, 6, 5, overlays=[
        # two long horns sweeping back from the head, a small one in front
        (20, 0, [
            "O.........",
            ".OO....O..",
            "..oO..Oo..",
            "...oOoO...",
            "....oo....",
        ]),
        # bigger wing reaching up and back, with a claw at the joint
        (0, 0, [
            "...QQ.......",
            "..Qqqk......",
            ".Qqqqqk.....",
            "Qqqqqqq.....",
            "Qqqqqqqq....",
            ".Qqqqqqqq...",
            "..Qqqqqqqq..",
            "...QQqqqqqq.",
            ".....QQqqqq.",
        ]),
        (4, 0, ["k", "w"]),
        # tail flame
        (4, 13, [
            ".y.....",
            "yry....",
            "ryyr...",
            "ryyyr..",
            "ryywyr.",
            ".ryyr..",
            "..rr...",
        ]),
        # arm wing-spikes
        (25, 16, ["ooo", ".oO", "..o"]),
    ])
    # Mega Blastoise: one giant cannon over the shell, cannons on both arms
    out["megablastoise"] = place(S["blastoise"], 30, 25, 4, 4, erase=[(9, 6, 6, 5)], overlays=[
        (2, 0, [
            "...........HHHHH.",
            "..hhhhhhhhhhxxxxH",
            ".hhhhhhhhhhhhxxxH",
            ".hhhhhhhhhhhhhhhH",
            "..HHHHHHhhhhhHHH.",
            "......Hhhh.......",
            ".....HHhh........",
            ".....Hhhh........",
            "....HHhhH........",
        ]),
        # arm cannons
        (22, 15, ["hhhH", "hxxH", "hhhH"]),
        (0, 14, ["Hhh", "Hxh", "Hhh"]),
        # shell spikes
        (3, 11, ["w.", "ww"]),
        (2, 15, ["w.", "ww"]),
    ])
    # Mega Venusaur: a huge flower, a flower on its forehead, thicker leaves
    out["megavenusaur"] = place(S["venusaur"], 30, 24, 3, 5, overlays=[
        (0, 0, [
            "......fff....fff.........",
            "....ffffff..ffffff.......",
            "..fffffffffffffffffff....",
            ".fffffFffyyyffFffffff....",
            "ffffffFfyyYyyfFffffffff..",
            ".fffffffyyyyyffffffffff..",
            "...fffffffyyfffffffff....",
        ]),
        # leaves hanging lower
        (1, 12, ["G...", "gG..", "ggG."]),
        (19, 12, ["..G", ".Gg", "Ggg"]),
        # flower on the forehead
        (22, 11, [".i.", "iyi", ".i."]),
    ])
    # Mega Pidgeot: a long streaming crest, a dark mask and coloured tail feathers
    out["megapidgeot"] = place(S["pidgeot"], 34, 20, 9, 4, erase=[(15, 4, 8, 3)], overlays=[
        (0, 3, [
            "........rrryyy.........",
            "...rrryyyyyrryyrr......",
            "rryyyyrrrrrrrryyyyrrn..",
            ".yyrr........rrryyyynn.",
            "..............nnnnnnnn.",
        ]),
        (21, 8, ["kk"]),
        # tail feathers with red and blue tips
        (4, 9, ["rr...", "Brrn.", ".BBrn", "..bbN"]),
    ])
    return out
