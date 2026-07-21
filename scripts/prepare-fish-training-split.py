#!/usr/bin/env python3
"""Create deterministic FIELD 60 train/validation/test manifests.

By default only biologically and photographically approved images are used.
The provisional flag is for local experiments only and never marks a dataset
as release eligible.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--audit",
        type=Path,
        default=Path("qa/fish-recognition/training-photo-audit.json"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("qa/fish-recognition/training-split-manifest.json"),
    )
    parser.add_argument(
        "--holdout-manifest",
        type=Path,
        default=Path("qa/fish-recognition/approved-holdout/manifest.json"),
        help="Images in this manifest are excluded from every training split.",
    )
    parser.add_argument(
        "--review-decisions",
        type=Path,
        default=Path("qa/fish-recognition/targeted-photo-review.json"),
        help="Optional manual photo-type/biological review decisions.",
    )
    parser.add_argument("--minimum-per-species", type=int, default=20)
    parser.add_argument(
        "--maximum-per-origin",
        type=int,
        default=4,
        help="Cap images from one observation/specimen to prevent source bias.",
    )
    parser.add_argument("--provisional-quality-pass", action="store_true")
    return parser.parse_args()


def origin_key(row: dict[str, object]) -> str:
    """Return a stable original observation/specimen identity.

    GBIF media IDs append an image index after a colon. iNaturalist images
    collected directly share an observation URL. Keeping these groups intact
    prevents alternate views of one animal leaking across train/val/test.
    """
    source_url = str(row.get("sourceUrl") or "")
    if "/observations/" in source_url:
        return source_url.split("?", 1)[0]
    provider_asset_id = str(row.get("providerAssetId") or "")
    if ":" in provider_asset_id:
        return f"{row.get('provider') or 'provider'}:{provider_asset_id.split(':', 1)[0]}"
    if provider_asset_id:
        return f"{row.get('provider') or 'provider'}:{provider_asset_id}"
    return f"image:{row.get('sha256') or row.get('file')}"


def stable_key(value: object) -> str:
    return hashlib.sha256(f"field60-v2:{value}".encode("utf-8")).hexdigest()


def normalize_asset_token(value: object) -> str:
    """Normalize provider asset IDs across filename-safe representations."""
    return "".join(character for character in str(value).lower() if character.isalnum())


def review_asset_key_from_file(value: object) -> str | None:
    """Recover a stable provider/asset key from a downloaded candidate filename.

    Candidate ordering can change after a collection refresh, so the numeric
    filename prefix is deliberately ignored. Derived paper panels keep exact
    path-only decisions because several labels can share one source asset.
    """
    stem = Path(str(value)).stem
    parts = stem.split("-", 2)
    if len(parts) != 3 or "-panel-" in parts[2]:
        return None
    provider = parts[1]
    if provider not in {"gbif", "inaturalist", "wikimedia"}:
        return None
    return f"{provider}:{normalize_asset_token(parts[2])}"


def review_asset_key_from_row(row: dict[str, object]) -> str | None:
    provider = str(row.get("provider") or "")
    provider_asset_id = row.get("providerAssetId")
    if provider not in {"gbif", "inaturalist", "wikimedia"} or not provider_asset_id:
        return None
    return f"{provider}:{normalize_asset_token(provider_asset_id)}"


def cap_origin_rows(
    rows: list[dict[str, object]], maximum_per_origin: int
) -> tuple[list[dict[str, object]], int]:
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        grouped[origin_key(row)].append(row)

    retained: list[dict[str, object]] = []
    capped = 0
    for group_key, group_rows in grouped.items():
        ordered = sorted(group_rows, key=lambda row: stable_key(row.get("sha256")))
        retained.extend(ordered[:maximum_per_origin])
        capped += max(0, len(ordered) - maximum_per_origin)
    return retained, capped


def group_stable_key(item: tuple[str, list[dict[str, object]]]) -> str:
    group_key, rows = item
    value = f"{rows[0]['speciesSort']}:{group_key}"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def split_species(rows: list[dict[str, object]]) -> dict[str, list[dict[str, object]]]:
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        grouped[origin_key(row)].append(row)
    ordered_groups = sorted(grouped.items(), key=group_stable_key)
    count = len(rows)
    if count < 3:
        return {"train": rows, "validation": [], "test": []}

    targets = {
        "train": max(1, count - max(1, round(count * 0.15)) * 2),
        "validation": max(1, round(count * 0.15)),
        "test": max(1, round(count * 0.15)),
    }
    splits: dict[str, list[dict[str, object]]] = {
        "train": [],
        "validation": [],
        "test": [],
    }
    for _, group_rows in ordered_groups:
        destination = max(
            splits,
            key=lambda name: (targets[name] - len(splits[name])) / targets[name],
        )
        splits[destination].extend(group_rows)
    return splits


def main() -> None:
    args = parse_args()
    root = Path.cwd()
    audit_path = (root / args.audit).resolve()
    output_path = (root / args.output).resolve()
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    holdout_path = (root / args.holdout_manifest).resolve()
    holdout = json.loads(holdout_path.read_text(encoding="utf-8"))
    holdout_files = {
        (holdout_path.parent / str(case["path"])).resolve()
        for case in holdout.get("cases", [])
        if case.get("path")
    }
    holdout_hashes = {
        str(case["sha256"])
        for case in holdout.get("cases", [])
        if case.get("sha256")
    }
    review_path = (root / args.review_decisions).resolve()
    review_decisions: dict[str, dict[str, object]] = {}
    review_decisions_by_asset: dict[str, dict[str, object]] = {}
    if review_path.exists():
        review = json.loads(review_path.read_text(encoding="utf-8"))
        review_decisions = {
            str(row["file"]): row
            for row in review.get("decisions", [])
            if row.get("file")
        }
        for row in review.get("decisions", []):
            asset_key = review_asset_key_from_file(row.get("file"))
            if asset_key:
                review_decisions_by_asset[asset_key] = row

    eligible: list[dict[str, object]] = []
    holdout_excluded = 0
    review_rejected = 0
    for row in audit.get("images", []):
        if (
            (root / str(row["file"])).resolve() in holdout_files
            or str(row.get("sha256", "")) in holdout_hashes
        ):
            holdout_excluded += 1
            continue
        decision = review_decisions.get(str(row.get("file")))
        if decision is None:
            asset_key = review_asset_key_from_row(row)
            decision = review_decisions_by_asset.get(asset_key or "", {})
        biological_review = decision.get(
            "biologicalReview", row.get("biologicalReview")
        )
        photo_type_review = decision.get(
            "photoTypeReview", row.get("photoTypeReview")
        )
        if "rejected" in (biological_review, photo_type_review):
            review_rejected += 1
            continue
        if row.get("autoStatus") != "quality-pass" and not (
            row.get("autoStatus") == "review" and photo_type_review == "approved"
        ):
            continue
        if not args.provisional_quality_pass and not (
            biological_review == "approved" and photo_type_review == "approved"
        ):
            continue
        eligible.append(
            {
                **row,
                "biologicalReview": biological_review,
                "photoTypeReview": photo_type_review,
            }
        )

    species_reports: list[dict[str, object]] = []
    output_splits = {"train": [], "validation": [], "test": []}
    for species_sort in range(1, 61):
        species_rows = [
            row for row in eligible if int(row["speciesSort"]) == species_sort
        ]
        species_rows, origin_capped = cap_origin_rows(
            species_rows, args.maximum_per_origin
        )
        splits = split_species(species_rows)
        for split_name, split_rows in splits.items():
            output_splits[split_name].extend(
                {
                    "file": row["file"],
                    "speciesSort": row["speciesSort"],
                    "nameKo": row["nameKo"],
                    "scientificName": row["scientificName"],
                    "sha256": row["sha256"],
                    "sourceUrl": row["sourceUrl"],
                    "license": row["license"],
                    "originKey": origin_key(row),
                }
                for row in split_rows
            )
        species_reports.append(
            {
                "sort": species_sort,
                "nameKo": species_rows[0].get("nameKo") if species_rows else None,
                "eligible": len(species_rows),
                "train": len(splits["train"]),
                "validation": len(splits["validation"]),
                "test": len(splits["test"]),
                "meetsMinimum": len(species_rows) >= args.minimum_per_species,
                "shortfall": max(0, args.minimum_per_species - len(species_rows)),
                "originCapped": origin_capped,
            }
        )

    all_species_ready = all(row["meetsMinimum"] for row in species_reports)
    provisional = args.provisional_quality_pass
    report = {
        "generatedAt": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "provisional": provisional,
        "releaseEligible": all_species_ready and not provisional,
        "minimumPerSpecies": args.minimum_per_species,
        "maximumPerOrigin": args.maximum_per_origin,
        "notice": (
            "provisional=true 데이터는 자동 품질 조건만 통과했으며 종 동정 승인이 "
            "없으므로 실배포 모델 학습 승인에 사용할 수 없습니다."
            if provisional
            else "모든 행은 종 동정과 사진 유형 수동 승인을 요구합니다."
        ),
        "summary": {
            "eligibleImages": len(eligible),
            "holdoutExcluded": holdout_excluded,
            "reviewRejected": review_rejected,
            "originCapped": sum(row["originCapped"] for row in species_reports),
            "speciesMeetingMinimum": sum(
                row["meetsMinimum"] for row in species_reports
            ),
            "train": len(output_splits["train"]),
            "validation": len(output_splits["validation"]),
            "test": len(output_splits["test"]),
        },
        "species": species_reports,
        "splits": output_splits,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"releaseEligible={report['releaseEligible']}")
    print(f"report={output_path}")


if __name__ == "__main__":
    main()
