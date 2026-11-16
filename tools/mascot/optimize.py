"""Convierte las animaciones originales del agente en versiones ligeras para la web.

Originales (pesados, fuera de git):  design/mascot/<situacion>.webp
Versiones web (las usa la página):   frontend/public/assets/mascot/<situacion>.webp

Todas salen en el MISMO lienzo y con el robot del mismo tamaño, con los pies alineados abajo y
el cuerpo centrado: al pasar de una animación a otra el robot no cambia de tamaño ni salta,
aunque los originales vengan en formatos distintos (horizontal 1280x720, vertical 720x1280…).

Pasos:
  1. Limpieza: se borran los restos sueltos del recorte de fondo (puntos de color alrededor);
     solo se conserva el robot (las manchas grandes de la imagen).
  2. Medida: el tamaño del robot es la altura típica (mediana) de su silueta en cada cuadro.
  3. Escala común: cada animación se escala para que el robot mida lo mismo en todas.
  4. Lienzo común: el más pequeño en que caben todas; pies abajo, cuerpo centrado.

Uso (desde la raíz del repo; necesita Pillow, numpy y scipy):
    python tools/mascot/optimize.py                  # convierte todas
    python tools/mascot/optimize.py --quality 70
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageSequence
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "design" / "mascot"
DST = ROOT / "frontend" / "public" / "assets" / "mascot"

ALPHA_MIN = 24        # por debajo, el píxel cuenta como transparente
KEEP_FRACTION = 0.02  # se conservan las manchas con al menos este % del área de la mayor
ROBOT_PX = 200        # altura del robot en la versión web (2x lo que se ve en pantalla)
PAD_PX = 8


@dataclass
class Clip:
    name: str
    frames: list[np.ndarray]   # RGBA limpios
    durations: list[int]
    body_h: float              # altura típica del robot (mediana de los cuadros)
    body_cx: float             # centro horizontal típico
    union: tuple[int, int, int, int]   # caja que contiene al robot en todos los cuadros


def _clean(rgba: np.ndarray) -> np.ndarray:
    """Deja solo el robot: borra las manchas pequeñas sueltas (restos del recorte de fondo)."""
    mask = rgba[..., 3] >= ALPHA_MIN
    labels, n = ndimage.label(mask, structure=np.ones((3, 3), bool))
    if n == 0:
        return rgba
    sizes = ndimage.sum_labels(mask, labels, index=np.arange(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= sizes.max() * KEEP_FRACTION
    out = rgba.copy()
    out[..., 3] = np.where(keep[labels], rgba[..., 3], 0)
    return out


def _bbox(rgba: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(rgba[..., 3] >= ALPHA_MIN)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def load(path: Path) -> Clip:
    im = Image.open(path)
    frames, durations, boxes = [], [], []
    for f in ImageSequence.Iterator(im):
        rgba = _clean(np.asarray(f.convert("RGBA")))
        frames.append(rgba)
        durations.append(int(f.info.get("duration") or im.info.get("duration") or 42))
        if (b := _bbox(rgba)) is not None:
            boxes.append(b)
    arr = np.array(boxes)
    union = (int(arr[:, 0].min()), int(arr[:, 1].min()), int(arr[:, 2].max()), int(arr[:, 3].max()))
    return Clip(path.stem, frames, durations,
                body_h=float(np.median(arr[:, 3] - arr[:, 1])),
                body_cx=float(np.median((arr[:, 0] + arr[:, 2]) / 2)), union=union)


def render(clip: Clip, canvas: tuple[int, int], quality: int) -> Path:
    s = ROBOT_PX / clip.body_h
    w, h = canvas
    x0, y0, x1, y1 = clip.union
    # Cuerpo centrado en el lienzo y pies (parte baja de la caja) a PAD_PX del borde inferior
    dx = round(w / 2 - (clip.body_cx - x0) * s)
    dy = round(h - PAD_PX - (y1 - y0) * s)
    size = (max(1, round((x1 - x0) * s)), max(1, round((y1 - y0) * s)))
    out_frames = []
    for rgba in clip.frames:
        sprite = Image.fromarray(rgba).crop(clip.union).resize(size, Image.LANCZOS)
        frame = Image.new("RGBA", canvas, (0, 0, 0, 0))
        frame.alpha_composite(sprite, (dx, dy))
        out_frames.append(frame)
    DST.mkdir(parents=True, exist_ok=True)
    out = DST / f"{clip.name}.webp"
    out_frames[0].save(out, save_all=True, append_images=out_frames[1:], duration=clip.durations,
                       loop=0, quality=quality, method=6)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--quality", type=int, default=72)
    args = ap.parse_args()
    sources = sorted(SRC.glob("*.webp"))
    if not sources:
        raise SystemExit(f"No hay animaciones en {SRC}")

    clips = []
    for path in sources:
        print(f"leyendo {path.name}…", flush=True)
        clips.append(load(path))

    # Lienzo común: el más pequeño en que caben todas, con el robot a la misma escala
    half_w, height = 0.0, 0.0
    for c in clips:
        s = ROBOT_PX / c.body_h
        x0, y0, x1, y1 = c.union
        half_w = max(half_w, (c.body_cx - x0) * s, (x1 - c.body_cx) * s)
        height = max(height, (y1 - y0) * s)
    canvas = (int(2 * half_w) + 2 * PAD_PX, int(height) + 2 * PAD_PX)
    print(f"lienzo común: {canvas[0]}x{canvas[1]} px, robot de {ROBOT_PX} px de alto")

    for c, src in zip(clips, sources):
        out = render(c, canvas, args.quality)
        print(f"  {c.name:11s} {len(c.frames):3d} cuadros  {src.stat().st_size / 1e6:5.1f} MB -> "
              f"{out.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
