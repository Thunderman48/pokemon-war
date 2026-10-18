#!/usr/bin/env python3
"""Generates the pixel-art PNG assets for Pokemon War.

All art is original pixel art drawn for this fan project. Sprites are
written as fill-only character grids; a 1px dark outline is added
automatically. Run:  python3 tools/make_assets.py
You can also edit the PNGs in assets/ directly with any pixel editor.
"""
import os
import random
import sys
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
OUTLINE = (34, 26, 44, 255)

PAL = {
    "k": (28, 24, 36), "w": (255, 255, 255), "x": (200, 200, 210),
    # charmander line
    "o": (240, 128, 48), "O": (196, 84, 30), "c": (250, 220, 120), "C": (220, 180, 80),
    "e": (222, 72, 48), "E": (170, 44, 34),
    "r": (232, 52, 32), "y": (250, 226, 64), "Y": (214, 170, 30),
    "q": (40, 136, 150), "Q": (24, 96, 112),
    # squirtle line
    "b": (110, 178, 238), "B": (60, 116, 196), "d": (72, 92, 190), "D": (44, 60, 140),
    "n": (186, 120, 54), "N": (128, 78, 36), "h": (170, 170, 182), "H": (110, 110, 124),
    # bulbasaur line
    "t": (124, 204, 172), "T": (70, 146, 120), "g": (90, 180, 66), "G": (46, 118, 46),
    "f": (236, 104, 130), "F": (186, 60, 92), "i": (240, 150, 186),
    "R": (200, 40, 40),
    # pikachu / raichu
    "u": (226, 140, 50), "U": (176, 98, 34), "p": (236, 90, 90),
    # machop
    "m": (156, 166, 188), "M": (108, 116, 142), "z": (170, 110, 70),
    # snorlax
    "s": (52, 92, 112), "S": (34, 62, 80), "a": (238, 226, 196), "A": (200, 186, 150),
    # rayquaza
    "v": (72, 170, 96), "V": (34, 104, 62), "l": (40, 44, 52), "j": (250, 206, 60),
    # misc
    "P": (240, 150, 200), "L": (140, 230, 120),
}

SPRITES = {
    "machop": [
        "....z.z.z....",
        "....zzzzz....",
        "...mmmmmmm...",
        "...mmmmmkmm..",
        "...mmmmmkmmm.",
        "....mmmmmmm..",
        "....mMmmmm...",
        "..mmmmmmmmmm.",
        ".mmm.mmmmm.mm",
        ".mm..mmmmm.mm",
        ".Mm..mmmmm.Mm",
        "......MmmM...",
        ".....mm..mm..",
        ".....mm..mm..",
        "....MMM.MMM..",
    ],
    "charmander": [
        "........oooo...",
        ".......oooooo..",
        ".......ooooowo.",
        ".r.....oooookoo",
        "ryr....oooooooo",
        "ryyr...Ooooooo.",
        "ryyr....ooooo..",
        ".rr...oocccoo..",
        "..o..ooccccoo..",
        "..o.oooccccoo..",
        "..oooooccccO...",
        "...Oooooooo....",
        ".....ooo.oo....",
        ".....OOO.OOO...",
    ],
    "charmeleon": [
        ".........ee.....",
        "........eeeee...",
        ".......eeeeeee..",
        ".......eeeewkee.",
        ".r.....eeeekeeee",
        "ryr....eeeeeeeee",
        "ryyr...Eeeeeeee.",
        "ryyr....eeeeee..",
        ".rr...eecccceE..",
        "..e..eecccccee..",
        "..e..eeccccceee.",
        "..eeeeecccccE...",
        "...Eeeeeccce....",
        "....eeeeeeee....",
        ".....eee..ee....",
        ".....eee..eee...",
        ".....EEE..EEE...",
    ],
    "charizard": [
        "..QQ...............oo..",
        "..Qqq.............ooo..",
        "..Qqqq..........oooooo.",
        "..Qqqqq.........ooowkoo",
        "..Qqqqqo.......oooookooo",
        "...Qqqqoo......ooooooooo",
        "...Qqqqqoo.....Oooooooo.",
        "....Qqqqqoo...ooooooo...",
        "....Qqqqqqoo.ooccccoo...",
        ".....Qqqqqqoooccccccoo..",
        "......QQqqqooocccccooo..",
        ".r.......oooocccccccoo..",
        "ryr.....ooooocccccco....",
        "ryyr...oooooocccccoo....",
        "ryyr..oooooooccccoo.....",
        ".rr..oooooooooooooo.....",
        "..o.ooOoooooooooooo.....",
        "..ooooO.ooooooooooo.....",
        "...OOO...oooo...ooo.....",
        ".........oooo...oooo....",
        ".........OOOO...OOOO....",
    ],
    "squirtle": [
        "........bbbb...",
        ".......bbbbbb..",
        ".......bbbbwkb.",
        ".......bbbbbkbb",
        ".......bbbbbbbb",
        "........Bbbbbb.",
        "...nnn.cccbb...",
        "..nnNnncccccbb.",
        ".nnNNnncccccbb.",
        "bnnNNnnccccc...",
        "bBnnnnnccccc...",
        ".bbnnnnccccB...",
        "....bbbbbbb....",
        "....bbb.bbb....",
        "....BBB.BBB....",
    ],
    "wartortle": [
        ".......x.x......",
        "......xbbxx.....",
        ".......bbbbb....",
        "......bbbbbbb...",
        "......bbbbbwkb..",
        "......bbbbbbkbb.",
        "......bbbbbbbbb.",
        "x......Bbbbbbb..",
        "xx.nnnn.cccbbb..",
        "xxnnNnnncccccbb.",
        ".xnNNnnnccccc...",
        "xxnNNnnnccccc...",
        "xxnnnnnncccccB..",
        ".x.bbnnnccccB...",
        "....bbbbbbbbb...",
        ".....bbb..bbb...",
        ".....BBB..BBB...",
    ],
    "blastoise": [
        "...............ddd.....",
        "..............dddddd...",
        ".....hh......dddddddd..",
        ".....hhhh....dddddwkd..",
        "......hhhh...ddddddkdd.",
        ".....nnHhhh..dddddddddd",
        "...nnnnnnHh..Dddddddd..",
        "..nnnnnnnnnn..ddddddd..",
        ".nnNnnnnnnncccccdddd...",
        ".nnNNnnnnnccccccccdd...",
        "nnNNNnnnnncccccccccdd..",
        "nnNNNnnnnnccccccccdddd.",
        "nnNNNnnnnnccccccccdddd.",
        "nnNNnnnnnnccccccccdD...",
        ".nnnnnnnnncccccccc.....",
        ".dnnnnnnnnccccccc......",
        "..ddnnnnnnccccccD......",
        "....ddddddddddddd......",
        "....dddddd...dddddd....",
        "....DDDDDD...DDDDDD....",
    ],
    "bulbasaur": [
        "....gg..........",
        "...gggg.........",
        "..gggGgg..tt....",
        ".ggGgggggtttt...",
        ".gGgggggtttttt..",
        "..ggggGtttttrkt.",
        "...ggTtttttttwtt",
        "..tTtttttttttttt",
        ".ttttTtttttTttt.",
        ".ttttttTTtttt...",
        "..tttt...ttt....",
        "..ttwt...twt....",
        "..TTT....TTT....",
    ],
    "ivysaur": [
        "....i...i........",
        "...iiiiiii.......",
        "..iiFiiiFii......",
        "..gggiiiggg......",
        ".gggggggggg......",
        "gggGggggGggg.tt..",
        "ggGgggggggGgtttt.",
        ".gggGgggGggtttttt",
        "..ggggggTtttttrkt",
        "...ggTttttttttwtt",
        "..tTtttttttttttt.",
        ".ttttTtttttTtttt.",
        ".ttttttTTttttt...",
        "..tttt....ttt....",
        "..ttwt....twt....",
        "..TTT.....TTT....",
    ],
    "venusaur": [
        "......fff..fff..........",
        ".....fffffffffff........",
        "....fffyfffffyfff.......",
        "...fffffFfyyfFfffff.....",
        "....ffffffyyfffffff.....",
        "...gggfffffffffggg......",
        "..ggggggfffffgggggg.....",
        ".ggGggggggggggggGggg....",
        "gggGgggggggggggggGgggt..",
        "ggGggggggggggggggggGtttt",
        ".gggGGggggggggGGgggttttt",
        "..ggggggggggggggTttttrkt",
        "...TTTTggggggTtttttttttw",
        "..tttttttttttttttttttttt",
        ".ttttttTtttttttTtttttTt.",
        "ttttttttTTTTTTTtttttt...",
        "tttttt.......tttttt.....",
        ".tttwt........ttwtt.....",
        ".TTTTT........TTTTT.....",
    ],
    "pikachu": [
        "..........k....",
        "..........yk...",
        ".........yyy.k.",
        "Y........yyyyk.",
        "YY.......yyyy..",
        ".YY.....yyyyyy.",
        "..YY....yyywky.",
        ".YY.....yyyyky.",
        "..YY....pyyyyy.",
        "...Y...yyyyyy..",
        "...UY.yyyyyy...",
        "....Uyyyyyyy...",
        ".....yyyyyyy...",
        "......yy..yy...",
        "......YY..YY...",
    ],
    "raichu": [
        "..........U.......",
        "..........UU....U.",
        "..........uU...UU.",
        "..........uu..uU..",
        "..........uu..uu..",
        "..........uuuuuu..",
        ".........uuuuuuu..",
        ".........uuuwkuuu.",
        "yy.......uuuukuyuu",
        "yyy......uuuuuuuu.",
        ".yk.......uuuuu...",
        "...k....uucccuu...",
        "....k..uucccccuu..",
        ".....kuuucccccu...",
        "......uuucccccu...",
        ".......uuuuuuu....",
        ".......uuu..uuu...",
        ".......UUU..UUU...",
    ],
    "snorlax": [
        "........ss......ss....",
        "........sss....sss....",
        ".......ssssssssssss...",
        "......ssssaaaaaasss...",
        "......sssaaaaaaaass...",
        "......ssakkaaakkaas...",
        "......ssaaaaaaaaaas...",
        "......ssaawwwwwaass...",
        ".....sssaaaaaaaaasss..",
        "...sssssaaaaaaaaaassss",
        "..ssssaaaaaaaaaaaaasss",
        ".ssssaaaaaaaaaaaaaaass",
        ".sssaaaaaaaaaaaaaaaass",
        "ssssaaaaaaaaaaaaaaaass",
        "sssaaaaaaaaaaaaaaaaass",
        "sssaaaaaaaaaaaaaaaaaSs",
        "SssaaaaaaaaaaaaaaaaSS.",
        ".SsAaaaaaaaaaaaaaaAS..",
        "..SsAAaaaaaaaaaaAAS...",
        "..aaaa.SSSSSSS..aaaa..",
        "..aAAa.........aAAa...",
    ],
    "eevee": [
        "..........N...N.",
        "..........nN.Nn.",
        "..........nnnnn.",
        ".cc.......nnnnnn",
        "cccn.....nnnkwnn",
        "ccnnn....nnnknnn",
        ".nnnnn..ccnnnnN.",
        "..nnnn.cccccnn..",
        "...nnnnccccc....",
        "....nnnnccc.....",
        "....nnnnnnn.....",
        "....nn.n.nn.....",
        "....NN.N.NN.....",
    ],
    "vaporeon": [
        "...........xx.....",
        "..........xbbx....",
        "dd........xbbbb...",
        "dDd......bbbbbbb..",
        ".dDd.....bbbbwkb..",
        "..dd....xxbbbkbbb.",
        "...b...xxxbbbbbb..",
        "...bb.xxxxbbbbB...",
        "....bbbbbbbbbb....",
        "....bbbbbbbbbb....",
        ".....bbbbbbbbb....",
        ".....bB.bB.bB.....",
        ".....BB.BB.BB.....",
    ],
    "jolteon": [
        "..........y...y...",
        "..........yy.yy...",
        "..........yyyyy...",
        ".y.......yyyywky..",
        "yyy......yyyyykyy.",
        ".yyy....xxyyyyyy..",
        "yyyyy..xxxyyyY....",
        ".yyyyyxxxxyyy.....",
        "..yyyyyyyyyyy.....",
        "...yyyyyyyyyy.....",
        "....yy.y..yy......",
        "....YY.Y..YY......",
    ],
    "flareon": [
        "..........o...o...",
        "..........oo.oo...",
        ".cc.......ooooo...",
        "cccc.....oooowko..",
        "ccccc....oooookoo.",
        "cccccc..cccooooo..",
        ".ccccc.ccccooo....",
        "..ccccoccccooo....",
        "....ooooooooo.....",
        "....ooooooooo.....",
        "....oo.o..oo......",
        "....OO.O..OO......",
    ],
    "pidgey": [
        "......nnn....",
        ".....nnnnn...",
        "....nnnckn...",
        "....nnccccnh.",
        "...nnnccccc..",
        ".nnnnnncccc..",
        "NnnnNnnccc...",
        ".NNnnnnccc...",
        "..NNnnnnn....",
        "....p..p.....",
    ],
    "pidgeotto": [
        ".......rr.......",
        "......rrnn......",
        ".....rnnnnn.....",
        ".....nnnncknn...",
        "....nnnncccchh..",
        "....nnnccccc....",
        "..nnnnnncccc....",
        "nnNnnnnnccc.....",
        "NnNNnnnnccc.....",
        ".NNNNnnnnn......",
        "...NNNnnn.......",
        "......p.p.......",
        "......p.p.......",
    ],
    "pidgeot": [
        "..........ry..........",
        "........rryy..........",
        "......rryynnn.........",
        ".........nnnnnn.......",
        ".........nnncknhh.....",
        "nn......nnnnccchhh....",
        "Nnnn....nnnccccc......",
        ".NNnnn.nnnccccc.......",
        "..NNnnnnnnccccc.......",
        "...NNNnnnnnccc........",
        ".....NNNnnnnn.........",
        "......NNNnnn..........",
        "....yyNN..p.p.........",
        "...ryy.....p.p........",
    ],
    "geodude": [
        ".......hhhh........",
        ".....hhhhhhhh......",
        "....hhhhhhhhhh.....",
        "...hhhhkhhhkhhh....",
        "hh.hhhhkhhhkhhh.hh.",
        "hhHhhhhhhhhhhhhHhh.",
        ".hhHhhhhHHhhhhHhh..",
        "..HhhhhhhhhhhhhH...",
        "...HhhhhhhhhhhH....",
        ".....HHhhhhHH......",
    ],
    "graveler": [
        ".......hhhhh.......",
        ".....hhhhhhhhh.....",
        "..hh.hhhkhhkhh.hh..",
        ".hhhhhhhkhhkhhhhhh.",
        ".hhHhhhhhhhhhhhHhh.",
        "..hhhhHHhhhHHhhhh..",
        ".hh.hhhhhhhhhhh.hh.",
        "hhh.HhhhhhhhhhH.hhh",
        ".H...hhhhhhhhh...H.",
        ".....hhHhhHhhh.....",
        "....hhh.....hhh....",
        "....HHH.....HHH....",
    ],
    "golem": [
        "......nnnnnnn........",
        "....nnnNnnnNnnn......",
        "...nnNnnnnnnnNnn.....",
        "..nnnnnnnnnnnnnnn....",
        ".nnNnnnnnnhhhhnnnn...",
        ".nnnnnnnnhhkhkhhnn...",
        "nnnnNnnnnhhhhhhhnnn..",
        "nnnnnnnnnnhhhhhnnnnhh",
        "nNnnnnnnnnnnnnnnnnhhh",
        ".nnnnNnnnnnnnnNnnnn..",
        "..nnnnnnnnnnnnnnnn...",
        "...hhnnnnnnnnnnhh....",
        "...hhh........hhh....",
        "...HHH........HHH....",
    ],
    "berry": [
        ".....gg.gg.....",
        "...ggggggggg...",
        "..gggpggGgggg..",
        ".ggpRpgggpgggg.",
        ".ggggpggpRpggg.",
        "gggGgggggpgGggg",
        "ggggggpgggggggg",
        "gpggGpRpgggpggG",
        "pRpggGpggggRpgg",
        ".pgggggggGgpgg.",
        ".ggGggpggggggg.",
        "..gggpRpgGggG..",
        "...GgGpGgGGG...",
    ],
    "crystal": [
        "......w.......",
        ".....wbb......",
        ".....wbbd.....",
        "..w..wbbd.....",
        ".wbb.wbbd..w..",
        ".wbbdwbbd.wbd.",
        ".wbbdwbbddwbd.",
        "..bbdwbbddwbd.",
        "..hbdwbbdhbbd.",
        ".hhhhbbbdhhhhh",
        "hhHhhhhhhhHhhh",
        ".HHhhhHHhhhHH.",
    ],
}


ICONS = {
    "thunderstone": [
        "...LLLL...",
        "..LLLyLL..",
        ".LLLyyLLL.",
        ".LLyyyyLL.",
        ".LLLLyyLL.",
        ".LLLyyLLL.",
        "..LLyLLL..",
        "...LLLL...",
    ],
    "waterstone": [
        "...bbbb...",
        "..bbwbbb..",
        ".bbwbbbbb.",
        ".bbbbbbBb.",
        ".bbbbbBBb.",
        ".bbbbBBbb.",
        "..bbBBbb..",
        "...bbbb...",
    ],
    "firestone": [
        "...oooo...",
        "..ooyooo..",
        ".ooyyrooo.",
        ".oyyrrroo.",
        ".oorryyoo.",
        ".ooorryoo.",
        "..oooroo..",
        "...oooo...",
    ],
}


def color(ch):
    r, g, b = PAL[ch]
    return (r, g, b, 255)


def sprite_image(rows):
    w = max(len(r) for r in rows)
    h = len(rows)
    img = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                if ch not in PAL:
                    sys.exit(f"unknown color {ch!r}")
                px[x + 1, y + 1] = color(ch)
    # auto outline
    out = img.copy()
    op = out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w + 2 and 0 <= ny < h + 2 and px[nx, ny][3]:
                    op[x, y] = OUTLINE
                    break
    return out


# ---------------------------------------------------------------- buildings
def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (255,)


def pokeball(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(230, 40, 40), outline=OUTLINE)
    d.rectangle([cx - r + 1, cy, cx + r - 1, cy + r - 1], fill=(250, 250, 250))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=OUTLINE)
    d.line([cx - r, cy, cx + r, cy], fill=OUTLINE)
    d.rectangle([cx - 1, cy - 1, cx + 1, cy + 1], fill=(250, 250, 250), outline=OUTLINE)


def house(w, h, wall, roof, roof_h, extra_top=0):
    img = Image.new("RGBA", (w, h + extra_top), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    top = extra_top
    wall_top = top + roof_h
    # wall
    d.rectangle([1, wall_top, w - 2, h + extra_top - 2], fill=wall, outline=OUTLINE)
    d.line([2, h + extra_top - 3, w - 3, h + extra_top - 3], fill=shade(wall, 0.8))
    # roof
    d.polygon([(0, wall_top + 2), (4, top), (w - 5, top), (w - 1, wall_top + 2)],
              fill=roof, outline=OUTLINE)
    for yy in range(top + 3, wall_top + 2, 3):
        d.line([3, yy, w - 4, yy], fill=shade(roof, 0.85))
    d.line([1, wall_top + 2, w - 2, wall_top + 2], fill=shade(roof, 0.6))
    return img, d, wall_top


def windows(d, xs, y, w=5, h=5):
    for x in xs:
        d.rectangle([x, y, x + w, y + h], fill=(120, 190, 240), outline=OUTLINE)
        d.line([x + 1, y + 1, x + 2, y + 1], fill=(220, 240, 255))


def door(d, cx, bottom, w=8, h=10, col=(150, 210, 245)):
    d.rectangle([cx - w // 2, bottom - h, cx + w // 2 - 1, bottom], fill=col, outline=OUTLINE)
    d.line([cx, bottom - h + 1, cx, bottom - 1], fill=OUTLINE)


def build_center():
    img, d, wt = house(48, 48, (248, 244, 236), (232, 64, 64), 16, extra_top=6)
    pokeball(d, 24, 12, 7)
    windows(d, [5, 37], wt + 8)
    door(d, 24, 51, 12, 12)
    d.rectangle([14, wt + 5, 33, wt + 9], fill=(232, 64, 64), outline=OUTLINE)
    d.line([16, wt + 7, 31, wt + 7], fill=(255, 255, 255))
    return img


def build_mart():
    img, d, wt = house(32, 32, (248, 244, 236), (60, 120, 220), 11, extra_top=4)
    windows(d, [4], wt + 6, 6, 5)
    door(d, 22, 33, 8, 10)
    d.rectangle([5, wt + 1, 26, wt + 4], fill=(60, 120, 220), outline=OUTLINE)
    return img


def build_gym():
    img, d, wt = house(48, 48, (190, 176, 150), (120, 90, 70), 14, extra_top=8)
    # stone blocks
    for yy in range(wt + 4, 54, 5):
        off = 0 if (yy // 5) % 2 else 4
        for xx in range(2 + off, 46, 8):
            d.line([xx, yy, xx, yy + 4], fill=(150, 136, 112))
        d.line([2, yy, 45, yy], fill=(150, 136, 112))
    # badge emblem
    d.polygon([(24, 9), (30, 14), (24, 19), (18, 14)], fill=(250, 210, 60), outline=OUTLINE)
    door(d, 24, 53, 14, 14, (90, 70, 60))
    d.rectangle([4, wt + 3, 10, wt + 15], fill=(200, 60, 60), outline=OUTLINE)
    d.rectangle([37, wt + 3, 43, wt + 15], fill=(200, 60, 60), outline=OUTLINE)
    return img


def build_lab():
    img, d, wt = house(48, 48, (226, 230, 236), (110, 120, 140), 10, extra_top=10)
    # satellite dish
    d.line([38, 12, 38, 4], fill=OUTLINE)
    d.ellipse([31, 0, 45, 8], fill=(240, 240, 250), outline=OUTLINE)
    d.rectangle([2, wt + 1, 45, wt + 3], fill=(80, 170, 120), outline=None)
    windows(d, [5, 14, 30, 39], wt + 8, 4, 6)
    door(d, 24, 57, 10, 12, (170, 220, 250))
    d.rectangle([6, 2, 14, 12], fill=(170, 175, 190), outline=OUTLINE)  # chimney/vent
    return img


def build_tower():
    w, h = 32, 48
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([6, 14, 25, 46], fill=(176, 170, 160), outline=OUTLINE)
    for yy in range(18, 46, 4):
        d.line([7, yy, 24, yy], fill=(140, 134, 124))
    d.rectangle([3, 10, 28, 16], fill=(150, 144, 134), outline=OUTLINE)
    for xx in (3, 11, 19, 25):
        d.rectangle([xx, 7, xx + 3, 10], fill=(150, 144, 134), outline=OUTLINE)
    pokeball(d, 16, 6, 5)
    d.rectangle([13, 36, 18, 46], fill=(90, 70, 60), outline=OUTLINE)
    d.rectangle([14, 22, 17, 27], fill=(40, 40, 50))
    return img


def build_skypillar():
    w, h = 48, 72
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    stone, dark, moss = (170, 176, 160), (120, 126, 112), (96, 150, 90)
    # base steps
    d.rectangle([1, 60, 46, 70], fill=dark, outline=OUTLINE)
    d.rectangle([5, 52, 42, 61], fill=stone, outline=OUTLINE)
    # pillar
    d.rectangle([10, 10, 37, 53], fill=stone, outline=OUTLINE)
    for yy in range(16, 52, 6):
        d.line([11, yy, 36, yy], fill=dark)
    for yy in range(16, 52, 12):
        d.line([20, yy, 20, yy + 6], fill=dark)
        d.line([29, yy + 6, 29, min(52, yy + 12)], fill=dark)
    # broken top
    d.polygon([(10, 10), (14, 4), (18, 8), (23, 2), (28, 7), (33, 3), (37, 10)], fill=stone, outline=OUTLINE)
    # moss
    for (x0, y0, x1, y1) in ((11, 20, 16, 24), (30, 34, 36, 39), (12, 44, 18, 47), (24, 9, 30, 12)):
        d.ellipse([x0, y0, x1, y1], fill=moss)
    # glowing door with green emblem
    d.rectangle([19, 40, 28, 53], fill=(40, 60, 50), outline=OUTLINE)
    d.ellipse([20, 26, 27, 33], fill=(90, 220, 130), outline=OUTLINE)
    d.point((23, 28), fill=(240, 255, 240))
    return img


# ---------------------------------------------------------------- tiles
def tiles():
    rnd = random.Random(7)
    names = ["grass", "grass2", "flowers", "sand", "water", "tree", "rock", "tallgrass"]
    sheet = Image.new("RGBA", (16 * len(names), 16), (0, 0, 0, 0))
    G1, G2, G3 = (112, 192, 88), (96, 172, 76), (136, 210, 104)

    def grass_base(img, seed):
        r = random.Random(seed)
        p = img.load()
        for y in range(16):
            for x in range(16):
                p[x, y] = G1 + (255,)
        for _ in range(9):
            x, y = r.randrange(16), r.randrange(1, 16)
            p[x, y] = G2 + (255,)
            if y > 0:
                p[x, y - 1] = G3 + (255,)

    for i, n in enumerate(names):
        t = Image.new("RGBA", (16, 16))
        d = ImageDraw.Draw(t)
        if n in ("grass", "grass2", "flowers", "tree", "rock", "tallgrass"):
            grass_base(t, i * 13 + (5 if n == "grass2" else 0))
        if n == "grass2":
            p = t.load()
            for _ in range(6):
                x, y = rnd.randrange(1, 15), rnd.randrange(2, 15)
                p[x, y] = (84, 160, 70, 255)
                p[x - 1, y - 1] = (84, 160, 70, 255)
                p[x + 1, y - 1] = (84, 160, 70, 255)
        if n == "flowers":
            p = t.load()
            for (x, y, c) in ((3, 4, (250, 250, 250)), (11, 3, (250, 220, 60)),
                              (7, 10, (250, 120, 150)), (13, 12, (250, 250, 250)),
                              (2, 13, (250, 220, 60))):
                for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                    p[x + dx, y + dy] = c + (255,)
                p[x, y] = (240, 160, 40, 255)
        if n == "tallgrass":
            for x in range(0, 16, 3):
                d.polygon([(x, 15), (x + 1, 6 + (x * 7) % 5), (x + 3, 15)], fill=(64, 150, 60))
                d.line([x + 1, 8 + (x * 7) % 5, x + 1, 14], fill=(140, 214, 110))
        if n == "sand":
            d.rectangle([0, 0, 15, 15], fill=(236, 214, 150))
            p = t.load()
            for _ in range(14):
                p[rnd.randrange(16), rnd.randrange(16)] = (214, 190, 126, 255)
        if n == "water":
            d.rectangle([0, 0, 15, 15], fill=(72, 140, 232))
            d.line([2, 4, 6, 4], fill=(130, 190, 250))
            d.line([9, 10, 13, 10], fill=(130, 190, 250))
            d.line([4, 13, 6, 13], fill=(100, 166, 244))
        if n == "tree":
            d.rectangle([7, 12, 8, 15], fill=(120, 76, 40))
            d.polygon([(8, 0), (15, 9), (11, 9), (14, 13), (1, 13), (4, 9), (0, 9)],
                      fill=(36, 112, 60), outline=(20, 60, 36))
            d.line([8, 2, 4, 8], fill=(70, 150, 80))
            d.line([8, 9, 5, 12], fill=(70, 150, 80))
        if n == "rock":
            d.polygon([(2, 14), (1, 9), (4, 4), (10, 3), (14, 7), (15, 14)],
                      fill=(150, 146, 156), outline=(70, 66, 80))
            d.line([5, 6, 9, 5], fill=(200, 196, 206))
            d.line([3, 13, 14, 13], fill=(110, 106, 120))
        sheet.paste(t, (i * 16, 0))
    return sheet, names


def save(img, *parts):
    path = os.path.join(ROOT, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


def main():
    # V3 Pokémon (tools/new_sprites.py) and Mega Evolutions painted on top of final forms (tools/mega_sprites.py)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega_sprites
    import new_sprites
    PAL.update(new_sprites.PAL_EXTRA)
    SPRITES.update(new_sprites.SPRITES)
    SPRITES.update(mega_sprites.build(SPRITES))
    SPRITES.update(new_sprites.build(SPRITES))
    units = [k for k in SPRITES if k not in ("berry", "crystal")]
    imgs = {}
    for k in units:
        imgs[k] = sprite_image(SPRITES[k])
        save(imgs[k], "units", k + ".png")
    # Rayquaza and Mega Rayquaza are drawn procedurally (see tools/rayquaza.py)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import rayquaza as rq
    for k, fn in (("rayquaza", rq.rayquaza), ("megarayquaza", rq.mega_rayquaza)):
        imgs[k] = fn()
        save(imgs[k], "units", k + ".png")
        save(rq.sheet(fn), "units", k + "_anim.png")  # idle hover frames (mouth closed / open rows)
    save(rq.fast_sheet(rq.rayquaza_fast), "units", "rayquaza_fast.png")  # fast flight frames
    save(rq.fast_sheet(rq.mega_rayquaza_fast), "units", "megarayquaza_fast.png")
    for k in ("berry", "crystal"):
        imgs[k] = sprite_image(SPRITES[k])
        save(imgs[k], "res", k + ".png")
    for k, rows in ICONS.items():
        imgs["i_" + k] = sprite_image(rows)
        save(imgs["i_" + k], "icons", k + ".png")
    # held items and the Key Stone
    import item_icons
    PAL.update(item_icons.EXTRA)
    for k, rows in item_icons.ITEMS.items():
        imgs["i_" + k] = sprite_image(rows)
        save(imgs["i_" + k], "icons", k + ".png")
    blds = {"center": build_center(), "mart": build_mart(), "gym": build_gym(),
            "lab": build_lab(), "tower": build_tower(), "skypillar": build_skypillar()}
    for k, im in blds.items():
        save(im, "buildings", k + ".png")
        imgs["b_" + k] = im
    # app icon: pokeball with a crossed sword-ish stripe
    icon = Image.new("RGBA", (32, 32), (27, 23, 48, 255))
    d = ImageDraw.Draw(icon)
    pokeball(d, 16, 16, 12)
    big = icon.resize((192, 192), Image.NEAREST)
    big.save(os.path.join(ROOT, "icon.png"))
    imgs["icon"] = icon
    sheet, names = tiles()
    save(sheet, "tiles.png")
    imgs["tiles"] = sheet

    # contact sheet for review
    if len(sys.argv) > 1:
        scale = 6
        pad = 6
        x = pad
        rowh = 0
        y = pad
        sheet_w = 1400
        canvas = Image.new("RGBA", (sheet_w, 2400), (90, 160, 80, 255))
        for k, im in imgs.items():
            big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            if x + big.width > sheet_w:
                x = pad
                y += rowh + pad
                rowh = 0
            canvas.paste(big, (x, y), big)
            x += big.width + pad
            rowh = max(rowh, big.height)
        canvas = canvas.crop((0, 0, sheet_w, y + rowh + pad))
        canvas.save(sys.argv[1])
    print("assets written to", os.path.normpath(ROOT))


if __name__ == "__main__":
    main()
