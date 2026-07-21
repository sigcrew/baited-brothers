#!/usr/bin/env python3
"""Extract species-labelled Lateolabrax maculatus panels from CC BY figures.

Source: Yokogawa K. (2019), ZooKeys 859: 69-115, CC BY 4.0.
The downloaded Commons figures contain multiple Lateolabrax species, so only
the panels explicitly labelled as L. maculatus are usable for FIELD 60.
"""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path.cwd()
FOLDER = ROOT / "qa/fish-recognition/open-photo-candidates/23-lateolabrax-spilonotus"
FIGURE_1 = FOLDER / "02-wikimedia-c4e44d1c83bf6601dd2f146770e459b198156f71.jpg"
FIGURE_2 = FOLDER / "08-wikimedia-21ed3aa86ca238260e4df768f54d2e27b82c50e2.jpg"


def save_panel(
    source: Path,
    crop: tuple[int, int, int, int],
    output: Path,
    clear_label: tuple[int, int, int, int] | None = None,
) -> None:
    with Image.open(source) as image:
        panel = image.convert("RGB").crop(crop)
    if clear_label:
        ImageDraw.Draw(panel).rectangle(clear_label, fill="white")
    panel.save(output, format="JPEG", quality=94, optimize=True)
    print(output.relative_to(ROOT))


def main() -> None:
    # Figure 1 panels C and D are juvenile/adult L. maculatus whole-body views.
    save_panel(
        FIGURE_1,
        (0, 270, 620, 570),
        FOLDER / "90-wikimedia-c4e44d1c83bf6601dd2f146770e459b198156f71-panel-c.jpg",
        clear_label=(0, 0, 86, 76),
    )
    save_panel(
        FIGURE_1,
        (620, 270, 1280, 570),
        FOLDER / "91-wikimedia-c4e44d1c83bf6601dd2f146770e459b198156f71-panel-d.jpg",
        clear_label=(0, 0, 88, 76),
    )
    # Figure 2 panel B shows the diagnostic lateral spots of L. maculatus.
    save_panel(
        FIGURE_2,
        (145, 650, 1280, 1320),
        FOLDER / "92-wikimedia-21ed3aa86ca238260e4df768f54d2e27b82c50e2-panel-b.jpg",
    )


if __name__ == "__main__":
    main()
