#!/usr/bin/env python3
"""Render recent fish candidates as labeled contact sheets for human review."""

from __future__ import annotations

import argparse
import time
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--images",
        type=Path,
        default=Path("qa/fish-recognition/open-photo-candidates"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("qa/fish-recognition/review-contact-sheets"),
    )
    parser.add_argument("--since-minutes", type=int, default=120)
    parser.add_argument("--columns", type=int, default=4)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cutoff = time.time() - args.since_minutes * 60
    grouped: dict[str, list[Path]] = defaultdict(list)
    for path in sorted(args.images.rglob("*")):
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        if path.stat().st_mtime >= cutoff:
            grouped[path.parent.name].append(path)

    args.output.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default()
    tile_width, tile_height, label_height = 260, 190, 36
    for species, paths in grouped.items():
        rows = (len(paths) + args.columns - 1) // args.columns
        sheet = Image.new(
            "RGB",
            (args.columns * tile_width, rows * (tile_height + label_height)),
            "white",
        )
        draw = ImageDraw.Draw(sheet)
        for index, path in enumerate(paths):
            column = index % args.columns
            row = index // args.columns
            x = column * tile_width
            y = row * (tile_height + label_height)
            try:
                with Image.open(path) as source:
                    preview = ImageOps.contain(
                        source.convert("RGB"), (tile_width - 8, tile_height - 8)
                    )
                px = x + (tile_width - preview.width) // 2
                py = y + (tile_height - preview.height) // 2
                sheet.paste(preview, (px, py))
            except Exception as error:
                draw.text((x + 8, y + 8), f"ERROR: {error}", fill="red", font=font)
            draw.rectangle(
                (x, y, x + tile_width - 1, y + tile_height + label_height - 1),
                outline="#b7c8ca",
            )
            label = path.name
            if len(label) > 38:
                label = label[:35] + "..."
            draw.text(
                (x + 6, y + tile_height + 8), label, fill="#062b34", font=font
            )
        output = args.output / f"{species}.jpg"
        sheet.save(output, quality=88, optimize=True)
        print(f"{species}: {len(paths)} -> {output}")


if __name__ == "__main__":
    main()
