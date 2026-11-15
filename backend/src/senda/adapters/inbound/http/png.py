"""Codificador PNG mínimo (stdlib) para capas ráster del mapa: sin Pillow."""
from __future__ import annotations

import struct
import zlib

import numpy as np

MAX_SIDE = 1024


def _chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def encode_rgba(rgba: np.ndarray) -> bytes:
    h, w, _ = rgba.shape
    raw = b"".join(b"\x00" + rgba[r].astype(np.uint8).tobytes() for r in range(h))
    return (b"\x89PNG\r\n\x1a\n"
            + _chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + _chunk(b"IDAT", zlib.compress(raw, 6))
            + _chunk(b"IEND", b""))


def _downsample(a: np.ndarray) -> np.ndarray:
    step = max(1, int(np.ceil(max(a.shape) / MAX_SIDE)))
    return a[::step, ::step]


def field_png(values: np.ndarray, vmax: float, alpha: int = 170) -> bytes:
    """Verde (retorno barato) → amarillo → rojo (caro). Transparente donde no hay retorno."""
    v = _downsample(values)
    ok = np.isfinite(v)
    t = np.zeros(v.shape)
    if vmax > 0:
        t[ok] = np.clip(v[ok] / vmax, 0, 1)
    rgba = np.zeros(v.shape + (4,), dtype=np.uint8)
    rgba[..., 0] = np.where(t < 0.5, 2 * t * 255, 255)
    rgba[..., 1] = np.where(t < 0.5, 200, (1 - 2 * (t - 0.5)) * 200)
    rgba[..., 2] = 60
    rgba[..., 3] = np.where(ok, alpha, 0)
    return encode_rgba(rgba)


def mask_png(mask: np.ndarray, rgb=(124, 217, 146), alpha: int = 110) -> bytes:
    m = _downsample(mask)
    rgba = np.zeros(m.shape + (4,), dtype=np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = rgb
    rgba[..., 3] = np.where(m, alpha, 0)
    return encode_rgba(rgba)
