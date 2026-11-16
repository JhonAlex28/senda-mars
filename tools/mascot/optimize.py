"""Convierte las animaciones originales del agente en versiones ligeras para la web.

Originales (pesados, fuera de git):  design/mascot/<situacion>.webp
Versiones web (las usa la página):   frontend/public/assets/mascot/<situacion>.webp

Recorta el espacio transparente sobrante (el mismo recorte en todos los cuadros, para que el
personaje no "salte"), reduce la altura y vuelve a comprimir. Conserva la duración de cada cuadro.

Uso (desde la raíz del repo; necesita Pillow):
    python tools/mascot/optimize.py              # convierte todas
    python tools/mascot/optimize.py saludo       # solo una
    python tools/mascot/optimize.py --height 240 --quality 70
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "design" / "mascot"
DST = ROOT / "frontend" / "public" / "assets" / "mascot"


def content_box(frames: list[Image.Image], pad: int) -> tuple[int, int, int, int]:
    """Caja que contiene al personaje en todos los cuadros (alfa > 8)."""
    box = None
    for f in frames:
        b = f.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    if box is None:
        return (0, 0, *frames[0].size)
    w, h = frames[0].size
    return (max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad))


def optimize(src: Path, height: int, quality: int) -> Path:
    im = Image.open(src)
    frames, durations = [], []
    for f in ImageSequence.Iterator(im):
        frames.append(f.convert("RGBA"))
        durations.append(f.info.get("duration") or im.info.get("duration") or 42)
    box = content_box(frames, pad=12)
    width = round((box[2] - box[0]) * height / (box[3] - box[1]))
    out_frames = [f.crop(box).resize((width, height), Image.LANCZOS) for f in frames]
    DST.mkdir(parents=True, exist_ok=True)
    out = DST / src.name
    out_frames[0].save(out, save_all=True, append_images=out_frames[1:], duration=durations,
                       loop=0, quality=quality, method=6)
    print(f"{src.name}: {len(frames)} cuadros, {width}x{height}px, "
          f"{src.stat().st_size / 1e6:.1f} MB -> {out.stat().st_size / 1e6:.2f} MB")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*", help="situaciones a convertir (sin .webp); vacío = todas")
    ap.add_argument("--height", type=int, default=240, help="alto en px (2x lo que se ve en pantalla)")
    ap.add_argument("--quality", type=int, default=72)
    args = ap.parse_args()
    sources = [SRC / f"{n}.webp" for n in args.names] if args.names else sorted(SRC.glob("*.webp"))
    if not sources:
        raise SystemExit(f"No hay animaciones en {SRC}")
    for s in sources:
        if not s.is_file():
            raise SystemExit(f"No existe {s}")
        optimize(s, args.height, args.quality)


if __name__ == "__main__":
    main()
