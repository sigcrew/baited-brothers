#!/usr/bin/env python3
"""Audit downloaded FIELD 60 training candidates without deleting files.

The report records dimensions, exact hashes, a small perceptual hash, and
simple quality signals.  Biological identification and photo-type approval
remain manual review steps.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageStat


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--images",
        type=Path,
        default=Path("qa/fish-recognition/open-photo-candidates"),
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("qa/fish-recognition/open-photo-candidates.json"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("qa/fish-recognition/training-photo-audit.json"),
    )
    parser.add_argument(
        "--manual-sources",
        type=Path,
        default=Path("qa/fish-recognition/manual-photo-sources.json"),
        help="Metadata for licensed literature/public-sector images added manually.",
    )
    parser.add_argument("--minimum-short-edge", type=int, default=384)
    parser.add_argument("--near-duplicate-distance", type=int, default=2)
    return parser.parse_args()


def dhash(image: Image.Image) -> int:
    gray = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = np.asarray(gray, dtype=np.int16)
    bits = pixels[:, 1:] > pixels[:, :-1]
    value = 0
    for bit in bits.flatten():
        value = (value << 1) | int(bit)
    return value


def laplacian_variance(image: Image.Image) -> float:
    gray = np.asarray(
        image.convert("L").resize((256, 256), Image.Resampling.BILINEAR),
        dtype=np.float32,
    )
    center = gray[1:-1, 1:-1]
    laplacian = (
        gray[:-2, 1:-1]
        + gray[2:, 1:-1]
        + gray[1:-1, :-2]
        + gray[1:-1, 2:]
        - 4 * center
    )
    return float(np.var(laplacian))


def entropy(image: Image.Image) -> float:
    histogram = np.asarray(image.convert("L").histogram(), dtype=np.float64)
    probabilities = histogram / max(histogram.sum(), 1)
    probabilities = probabilities[probabilities > 0]
    return float(-(probabilities * np.log2(probabilities)).sum())


def hamming(left: int, right: int) -> int:
    return (left ^ right).bit_count()


def candidate_for_file(
    file: Path,
    species_manifest: dict[str, object] | None,
) -> dict[str, object] | None:
    if not species_manifest:
        return None
    candidates = species_manifest.get("candidates", [])
    if not isinstance(candidates, list):
        return None

    parts = file.stem.split("-", 2)
    if len(parts) == 3:
        _, provider, asset_id = parts
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            candidate_asset_id = re.sub(
                r"^-|-$",
                "",
                re.sub(
                    r"[^a-z0-9]+",
                    "-",
                    str(candidate.get("providerAssetId", "")).lower(),
                ),
            )
            if (
                str(candidate.get("provider", "")) == provider
                and (
                    candidate_asset_id == asset_id
                    or asset_id.startswith(f"{candidate_asset_id}-panel-")
                )
            ):
                return candidate

    # Legacy fallback for files created before asset IDs were embedded.
    try:
        index = int(file.name.split("-", 1)[0]) - 1
    except ValueError:
        return None
    if index < 0 or index >= len(candidates):
        return None
    candidate = candidates[index]
    return candidate if isinstance(candidate, dict) else None


def main() -> None:
    args = parse_args()
    root = Path.cwd()
    images_root = (root / args.images).resolve()
    manifest_path = (root / args.manifest).resolve()
    output_path = (root / args.output).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manual_sources_path = (root / args.manual_sources).resolve()
    manual_sources: dict[str, dict[str, object]] = {}
    if manual_sources_path.exists():
        manual_manifest = json.loads(
            manual_sources_path.read_text(encoding="utf-8")
        )
        manual_sources = {
            str(row["file"]): row
            for row in manual_manifest.get("sources", [])
            if row.get("file")
        }
    species_by_sort = {
        int(row["sort"]): row for row in manifest.get("species", [])
    }

    rows: list[dict[str, object]] = []
    sha_groups: dict[str, list[int]] = defaultdict(list)
    perceptual: list[tuple[int, int, int]] = []

    for directory in sorted(images_root.iterdir()):
        if not directory.is_dir():
            continue
        prefix = directory.name.split("-", 1)[0]
        if not prefix.isdigit():
            continue
        species_sort = int(prefix)
        species_manifest = species_by_sort.get(species_sort)
        for file in sorted(directory.iterdir()):
            if not file.is_file() or file.suffix.lower() not in IMAGE_SUFFIXES:
                continue
            data = file.read_bytes()
            sha256 = hashlib.sha256(data).hexdigest()
            warnings: list[str] = []
            try:
                with Image.open(file) as image:
                    image.load()
                    width, height = image.size
                    short_edge = min(width, height)
                    long_edge = max(width, height)
                    aspect_ratio = long_edge / max(short_edge, 1)
                    blur_score = laplacian_variance(image)
                    entropy_score = entropy(image)
                    perceptual_hash = dhash(image)
                    brightness = float(ImageStat.Stat(image.convert("L")).mean[0])
                if short_edge < args.minimum_short_edge:
                    warnings.append("low-resolution")
                if aspect_ratio > 4:
                    warnings.append("extreme-aspect-ratio")
                if blur_score < 20:
                    warnings.append("low-detail-or-blurry")
                if entropy_score < 3:
                    warnings.append("low-entropy")
                if brightness < 15 or brightness > 245:
                    warnings.append("extreme-brightness")
                status = "review" if warnings else "quality-pass"
                error = None
            except Exception as exception:
                width = height = 0
                aspect_ratio = blur_score = entropy_score = brightness = 0.0
                perceptual_hash = 0
                warnings.append("unreadable-image")
                status = "reject"
                error = str(exception)

            relative_file = str(file.relative_to(root))
            candidate = manual_sources.get(relative_file) or candidate_for_file(
                file, species_manifest
            )
            row = {
                "file": relative_file,
                "speciesSort": species_sort,
                "nameKo": species_manifest.get("nameKo") if species_manifest else None,
                "scientificName": (
                    species_manifest.get("scientificName")
                    if species_manifest
                    else None
                ),
                "provider": candidate.get("provider") if candidate else None,
                "providerAssetId": (
                    candidate.get("providerAssetId") if candidate else None
                ),
                "sourceUrl": candidate.get("sourceUrl") if candidate else None,
                "license": candidate.get("license") if candidate else None,
                "sha256": sha256,
                "dhash": f"{perceptual_hash:016x}",
                "bytes": len(data),
                "width": width,
                "height": height,
                "aspectRatio": round(aspect_ratio, 4),
                "blurScore": round(blur_score, 3),
                "entropy": round(entropy_score, 3),
                "brightness": round(brightness, 3),
                "autoStatus": status,
                "warnings": warnings,
                "biologicalReview": (
                    candidate.get("biologicalReview", "pending")
                    if candidate
                    else "pending"
                ),
                "photoTypeReview": (
                    candidate.get("photoTypeReview", "pending")
                    if candidate
                    else "pending"
                ),
                "error": error,
            }
            index = len(rows)
            rows.append(row)
            sha_groups[sha256].append(index)
            if status != "reject":
                perceptual.append((index, species_sort, perceptual_hash))

    exact_duplicate_sets = [indices for indices in sha_groups.values() if len(indices) > 1]
    for indices in exact_duplicate_sets:
        canonical = rows[indices[0]]["file"]
        for index in indices[1:]:
            rows[index]["autoStatus"] = "reject"
            rows[index]["warnings"].append("exact-duplicate")
            rows[index]["duplicateOf"] = canonical

    near_duplicate_pairs: list[dict[str, object]] = []
    for left_position, (left_index, left_sort, left_hash) in enumerate(perceptual):
        for right_index, right_sort, right_hash in perceptual[left_position + 1 :]:
            distance = hamming(left_hash, right_hash)
            if distance > args.near_duplicate_distance:
                continue
            warning = (
                "cross-species-near-duplicate"
                if left_sort != right_sort
                else "near-duplicate"
            )
            rows[left_index]["warnings"].append(warning)
            rows[right_index]["warnings"].append(warning)
            if rows[left_index]["autoStatus"] == "quality-pass":
                rows[left_index]["autoStatus"] = "review"
            if rows[right_index]["autoStatus"] == "quality-pass":
                rows[right_index]["autoStatus"] = "review"
            near_duplicate_pairs.append(
                {
                    "left": rows[left_index]["file"],
                    "right": rows[right_index]["file"],
                    "distance": distance,
                    "crossSpecies": left_sort != right_sort,
                }
            )

    per_species: list[dict[str, object]] = []
    for species_sort in range(1, 61):
        species_rows = [row for row in rows if row["speciesSort"] == species_sort]
        status_counts = Counter(str(row["autoStatus"]) for row in species_rows)
        species_manifest = species_by_sort.get(species_sort, {})
        per_species.append(
            {
                "sort": species_sort,
                "nameKo": species_manifest.get("nameKo"),
                "scientificName": species_manifest.get("scientificName"),
                "downloaded": len(species_rows),
                "qualityPass": status_counts["quality-pass"],
                "review": status_counts["review"],
                "reject": status_counts["reject"],
                "shortfallFrom20": max(0, 20 - len(species_rows)),
            }
        )

    report = {
        "generatedAt": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "policy": {
            "minimumShortEdge": args.minimum_short_edge,
            "nearDuplicateHammingDistance": args.near_duplicate_distance,
            "notice": (
                "자동 품질 통과는 종 동정 승인이 아닙니다. biologicalReview와 "
                "photoTypeReview를 사람이 승인해야 학습 데이터로 사용할 수 있습니다."
            ),
        },
        "summary": {
            "downloaded": len(rows),
            "qualityPass": sum(row["autoStatus"] == "quality-pass" for row in rows),
            "review": sum(row["autoStatus"] == "review" for row in rows),
            "reject": sum(row["autoStatus"] == "reject" for row in rows),
            "exactDuplicateSets": len(exact_duplicate_sets),
            "nearDuplicatePairs": len(near_duplicate_pairs),
            "speciesAt20Downloaded": sum(
                species["downloaded"] >= 20 for species in per_species
            ),
        },
        "species": per_species,
        "nearDuplicatePairs": near_duplicate_pairs,
        "images": rows,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"report={output_path}")


if __name__ == "__main__":
    main()
