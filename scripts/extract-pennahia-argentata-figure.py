#!/usr/bin/env python3
"""Download and crop the CC BY white-croaker panel from Yang & Herrmann (2025).

The paper explicitly identifies the animals in Figure 2 as fresh white croaker
(Pennahia argentata). The complete figure is mostly a mesh template, so only
the fish cluster is retained as one source observation.
"""

import argparse
from pathlib import Path

from PIL import Image


ROOT = Path.cwd()
URL = (
    "https://pub.mdpi-res.com/fishes/fishes-10-00622/article_deploy/html/"
    "images/fishes-10-00622-g002.png"
)
OUTPUT = ROOT / (
    "qa/fish-recognition/open-photo-candidates/25-pennahia-argentata/"
    "90-literature-mdpi-fishes-10-00622-g002-crop.jpg"
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        required=True,
        help=f"Figure 2 downloaded from {URL}",
    )
    args = parser.parse_args()
    with Image.open(args.source) as image:
        source = image.convert("RGB")
    panel = source.crop((1680, 70, 2170, 790))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    panel.save(OUTPUT, format="JPEG", quality=94, optimize=True)
    print(OUTPUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
