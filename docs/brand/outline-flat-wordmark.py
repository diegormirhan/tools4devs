import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / "tmp" / "brand-fonttools"))
text = sys.argv[1] if len(sys.argv) > 1 else "Tools4Devs"
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

font = TTFont(root.parent / "toolhaven-desktop-landing" / "assets" / "fonts" / "inter-tight-600.woff2")
glyphs = font.getGlyphSet()
characters = font.getBestCmap()
advance = 0
paths = []
for letter in text:
    name = characters[ord(letter)]
    pen = SVGPathPen(glyphs)
    glyphs[name].draw(pen)
    paths.append({"letter": letter, "x": advance, "path": pen.getCommands()})
    advance += font["hmtx"].metrics[name][0] - 12

(Path(__file__).parent / "flat-wordmark-paths.json").write_text(
    json.dumps({"unitsPerEm": font["head"].unitsPerEm, "width": advance + 12, "paths": paths}),
    encoding="utf-8",
)
