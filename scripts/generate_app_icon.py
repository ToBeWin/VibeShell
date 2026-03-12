from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ICONS_DIR = ROOT / "src-tauri" / "icons"
ICONSET_DIR = ICONS_DIR / "icon.iconset"
BASE_SIZE = 1024


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def color_lerp(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(lerp(c1[i], c2[i], t)) for i in range(3))


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def vertical_gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGBA", (size, size))
    pixels = image.load()
    for y in range(size):
        t = y / (size - 1)
        row = color_lerp(top, bottom, t)
        for x in range(size):
            pixels[x, y] = (*row, 255)
    return image


def radial_glow(size: int, center: tuple[float, float], radius: float, color: tuple[int, int, int], intensity: float) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = image.load()
    cx, cy = center
    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            distance = math.sqrt(dx * dx + dy * dy)
            factor = max(0.0, 1.0 - distance / radius)
            alpha = int(255 * intensity * factor * factor)
            if alpha > 0:
                pixels[x, y] = (*color, alpha)
    return image


def make_icon(size: int = BASE_SIZE) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    radius = int(size * 0.235)

    background = vertical_gradient(size, (3, 7, 18), (17, 24, 39))
    aurora = radial_glow(size, (size * 0.24, size * 0.18), size * 0.52, (49, 214, 255), 0.30)
    depth = radial_glow(size, (size * 0.82, size * 0.86), size * 1.02, (2, 4, 12), 0.96)
    rim = radial_glow(size, (size * 0.70, size * 0.74), size * 0.34, (88, 95, 255), 0.18)
    panel = Image.alpha_composite(background, depth)
    panel = Image.alpha_composite(panel, aurora)
    panel = Image.alpha_composite(panel, rim)

    vignette = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    vignette_draw = ImageDraw.Draw(vignette)
    inset = int(size * 0.03)
    vignette_draw.rounded_rectangle(
        (inset, inset, size - inset, size - inset),
        radius=radius - inset,
        outline=(255, 255, 255, 26),
        width=max(4, size // 128),
    )
    panel = Image.alpha_composite(panel, vignette)

    mask = rounded_mask(size, radius)
    canvas.paste(panel, (0, 0), mask)

    draw = ImageDraw.Draw(canvas)
    stroke = max(18, size // 34)
    chevron = [
        (size * 0.31, size * 0.34),
        (size * 0.43, size * 0.50),
        (size * 0.31, size * 0.66),
    ]
    draw.line(chevron, fill=(235, 251, 255, 248), width=stroke, joint="curve")

    underline_width = max(18, size // 42)
    draw.line(
        (size * 0.55, size * 0.66, size * 0.74, size * 0.66),
        fill=(235, 251, 255, 236),
        width=underline_width,
    )

    dot_radius = size * 0.05
    dot_bbox = (
        size * 0.60 - dot_radius,
        size * 0.34 - dot_radius,
        size * 0.60 + dot_radius,
        size * 0.34 + dot_radius,
    )
    draw.ellipse(dot_bbox, fill=(103, 232, 249, 238))

    accent_width = max(10, size // 90)
    draw.line(
        (size * 0.55, size * 0.27, size * 0.72, size * 0.27),
        fill=(103, 232, 249, 125),
        width=accent_width,
    )

    glow = canvas.filter(ImageFilter.GaussianBlur(radius=size * 0.022))
    glow = ImageChops.multiply(glow, Image.new("RGBA", (size, size), (56, 189, 248, 120)))
    canvas = Image.alpha_composite(glow, canvas)

    return canvas


def save_png(image: Image.Image, path: Path, size: int) -> None:
    resized = image.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(path, format="PNG")


def build_iconset(image: Image.Image) -> None:
    ICONSET_DIR.mkdir(parents=True, exist_ok=True)
    iconset_sizes = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }
    for name, size in iconset_sizes.items():
        save_png(image, ICONSET_DIR / name, size)


def main() -> None:
    image = make_icon()

    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    save_png(image, ICONS_DIR / "app-icon-source-tight.png", 1024)
    save_png(image, ICONS_DIR / "icon.png", 512)
    save_png(image, ICONS_DIR / "128x128.png", 128)
    save_png(image, ICONS_DIR / "128x128@2x.png", 256)
    save_png(image, ICONS_DIR / "64x64.png", 64)
    save_png(image, ICONS_DIR / "32x32.png", 32)
    save_png(image, ICONS_DIR / "Square30x30Logo.png", 30)
    save_png(image, ICONS_DIR / "Square44x44Logo.png", 44)
    save_png(image, ICONS_DIR / "Square71x71Logo.png", 71)
    save_png(image, ICONS_DIR / "Square89x89Logo.png", 89)
    save_png(image, ICONS_DIR / "Square107x107Logo.png", 107)
    save_png(image, ICONS_DIR / "Square142x142Logo.png", 142)
    save_png(image, ICONS_DIR / "Square150x150Logo.png", 150)
    save_png(image, ICONS_DIR / "Square284x284Logo.png", 284)
    save_png(image, ICONS_DIR / "Square310x310Logo.png", 310)
    save_png(image, ICONS_DIR / "StoreLogo.png", 50)

    image.resize((256, 256), Image.Resampling.LANCZOS).save(
        ICONS_DIR / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    build_iconset(image)


if __name__ == "__main__":
    main()
