#!/usr/bin/env python3
"""Build the five-image App Store screenshot set from real simulator captures."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "store-assets" / "raw"
OUT = ROOT / "store-assets" / "final"
BACKGROUND = ROOT / "store-assets" / "brand-background.png"
FONT_HEAD = ROOT / "node_modules/@expo-google-fonts/black-han-sans/400Regular/BlackHanSans_400Regular.ttf"
FONT_BODY = ROOT / "node_modules/@expo-google-fonts/noto-sans-kr/500Medium/NotoSansKR_500Medium.ttf"
FONT_MONO = ROOT / "node_modules/@expo-google-fonts/noto-sans-kr/700Bold/NotoSansKR_700Bold.ttf"

CANVAS = (1320, 2868)  # Apple-supported 6.9-inch screenshot size.
NAVY = "#082E37"
TEAL = "#167D74"
ORANGE = "#F05423"
FOAM = "#F7F4EC"

SCREENS = [
    ("01-home.png", "01-home.png", "출조부터 조과까지,\n낚시의 모든 순간을", "계획하고, 촬영하고, 한곳에 기록하세요"),
    ("02-journal.png", "02-journal.png", "다음 출조도,\n지난 손맛도 한눈에", "예정·완료·취소 기록을 시간순으로"),
    ("03-collection.png", "03-collection.png", "잡을수록 채워지는\n나만의 60종 도감", "미발견 실루엣부터 컬러 일러스트까지"),
    ("04-fish-detail.png", "04-fish-detail.png", "금어기·미끼·특징까지\n현장에서 바로 확인", "어종별 필드 가이드를 한 화면에"),
    ("05-badge-detail.png", "05-badge-detail.png", "출조의 순간이\n특별한 배지가 되다", "기록을 이어가며 새로운 성취를 해금하세요"),
    ("06-catch-card-detail.png", "06-catch-card-detail.png", "한 번의 손맛을\n한 장의 카드로", "사진·크기·장소·메모를 오래 간직하세요"),
]


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def build_one(index: int, source_name: str, output_name: str, title: str, subtitle: str) -> Path:
    background = cover(Image.open(BACKGROUND).convert("RGB"), CANVAS)
    background = ImageEnhance.Color(background).enhance(0.83)

    # Keep headline area calm while preserving the generated maritime texture.
    wash = Image.new("RGBA", CANVAS, (249, 247, 239, 0))
    wash_mask = Image.new("L", CANVAS, 0)
    gradient = wash_mask.load()
    for y in range(CANVAS[1]):
        alpha = max(0, 224 - int(y * 0.12))
        for x in range(CANVAS[0]):
            gradient[x, y] = alpha
    background = Image.composite(wash.convert("RGB"), background, wash_mask)
    canvas = background.convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    head = ImageFont.truetype(str(FONT_HEAD), 104)
    body = ImageFont.truetype(str(FONT_BODY), 40)
    kicker = ImageFont.truetype(str(FONT_MONO), 25)

    draw.text((92, 104), f"FIELD NOTE  ·  0{index}", font=kicker, fill=TEAL, spacing=8)
    draw.rounded_rectangle((1138, 96, 1228, 186), radius=45, fill=ORANGE)
    draw.text((1183, 140), f"{index}", font=kicker, fill="white", anchor="mm")
    if index == 4:
        # Black Han Sans has no visible middle-dot glyph. Draw the separators
        # geometrically so they remain centered and legible at store scale.
        x = 88
        title_y = 205
        dot_gap = 22
        for part_index, part in enumerate(("금어기", "미끼", "특징까지")):
            draw.text((x, title_y), part, font=head, fill=NAVY)
            bbox = draw.textbbox((x, title_y), part, font=head)
            x = bbox[2]
            if part_index < 2:
                dot_x = x + dot_gap
                dot_y = title_y + 58
                draw.ellipse((dot_x - 8, dot_y - 8, dot_x + 8, dot_y + 8), fill=NAVY)
                x = dot_x + 8 + dot_gap
        draw.text((88, title_y + 112), "현장에서 바로 확인", font=head, fill=NAVY)
    else:
        draw.multiline_text((88, 205), title, font=head, fill=NAVY, spacing=8)
    draw.text((92, 470), subtitle, font=body, fill="#42656A")

    # Ruler motif from the product's field-guide visual language.
    ruler_y = 555
    draw.line((92, ruler_y, 1228, ruler_y), fill="#9ABCC0", width=2)
    for tick in range(13):
        x = 92 + tick * (1136 / 12)
        length = 26 if tick % 3 == 0 else 14
        draw.line((x, ruler_y, x, ruler_y + length), fill="#9ABCC0", width=2)

    screenshot = Image.open(RAW / source_name).convert("RGB")
    phone_w = 930
    phone_h = round(phone_w * CANVAS[1] / CANVAS[0])
    screenshot = screenshot.resize((phone_w, phone_h), Image.Resampling.LANCZOS)
    mask = rounded_mask((phone_w, phone_h), 92)

    frame_pad = 18
    frame_size = (phone_w + frame_pad * 2, phone_h + frame_pad * 2)
    phone_x = (CANVAS[0] - frame_size[0]) // 2
    phone_y = 665

    shadow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    shadow_shape = Image.new("RGBA", frame_size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow_shape).rounded_rectangle(
        (0, 0, frame_size[0] - 1, frame_size[1] - 1), radius=108, fill=(7, 34, 40, 165)
    )
    shadow_shape = shadow_shape.filter(ImageFilter.GaussianBlur(30))
    shadow.alpha_composite(shadow_shape, (phone_x + 8, phone_y + 28))
    canvas.alpha_composite(shadow)

    frame = Image.new("RGBA", frame_size, NAVY)
    frame_mask = rounded_mask(frame_size, 108)
    canvas.paste(frame, (phone_x, phone_y), frame_mask)
    canvas.paste(screenshot, (phone_x + frame_pad, phone_y + frame_pad), mask)

    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / output_name
    canvas.convert("RGB").save(target, "PNG", optimize=True)
    return target


def build_contact_sheet(paths: list[Path]) -> Path:
    thumb_w = 194
    thumb_h = round(thumb_w * CANVAS[1] / CANVAS[0])
    gap = 16
    margin = 26
    sheet = Image.new(
        "RGB",
        (margin * 2 + thumb_w * len(paths) + gap * (len(paths) - 1), thumb_h + margin * 2),
        FOAM,
    )
    for i, path in enumerate(paths):
        image = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(image, (margin + i * (thumb_w + gap), margin))
    target = OUT / "00-contact-sheet.png"
    sheet.save(target, "PNG", optimize=True)
    return target


def main() -> None:
    paths = [build_one(i, *screen) for i, screen in enumerate(SCREENS, start=1)]
    contact = build_contact_sheet(paths)
    for path in [contact, *paths]:
        with Image.open(path) as image:
            print(f"{path.relative_to(ROOT)}\t{image.width}x{image.height}\t{image.mode}")


if __name__ == "__main__":
    main()
