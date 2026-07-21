#!/usr/bin/env python3
"""Copy approved evaluation images into a stable, rebuild-safe holdout folder."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("qa/fish-recognition/approved-manifest.json"),
    )
    parser.add_argument(
        "--candidate-root",
        type=Path,
        default=Path("qa/fish-recognition/open-photo-candidates"),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("qa/fish-recognition/approved-holdout"),
    )
    return parser.parse_args()


def candidate_suffix(filename: str) -> str | None:
    match = re.match(r"^\d+-(gbif|inaturalist)-(.+)$", filename)
    return f"{match.group(1)}-{match.group(2)}" if match else None


def recover_moved_candidate(candidate_root: Path, original: Path) -> Path | None:
    suffix = candidate_suffix(original.name)
    if not suffix:
        return None
    matches = sorted(candidate_root.rglob(f"*-{suffix}"))
    return matches[0] if len(matches) == 1 else None


def main() -> None:
    args = parse_args()
    root = Path.cwd()
    manifest_path = (root / args.manifest).resolve()
    candidate_root = (root / args.candidate_root).resolve()
    output_dir = (root / args.output_dir).resolve()
    image_dir = output_dir / "images"
    image_dir.mkdir(parents=True, exist_ok=True)

    source = json.loads(manifest_path.read_text(encoding="utf-8"))
    preserved_cases: list[dict[str, object]] = []
    missing: list[dict[str, str]] = []
    recovered = 0

    for case in source.get("cases", []):
        original = (manifest_path.parent / str(case["path"])).resolve()
        resolved = original if original.exists() else recover_moved_candidate(
            candidate_root, original
        )
        if resolved is None or not resolved.exists():
            missing.append(
                {
                    "id": str(case.get("id", "")),
                    "path": str(case.get("path", "")),
                    "expectedScientificName": str(
                        case.get("expectedScientificName", "")
                    ),
                }
            )
            continue
        if resolved != original:
            recovered += 1
        destination = image_dir / f"{case['id']}{resolved.suffix.lower()}"
        shutil.copy2(resolved, destination)
        sha256 = hashlib.sha256(destination.read_bytes()).hexdigest()
        preserved_cases.append(
            {
                **case,
                "path": destination.relative_to(output_dir).as_posix(),
                "originalPath": str(case["path"]),
                "sha256": sha256,
            }
        )

    output = {
        **source,
        "generatedAt": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "notes": (
            "후보 재수집과 무관한 고정 홀드아웃 복사본입니다. missing 항목은 "
            "동일 원본을 복구하거나 사람이 새 사진을 승인하기 전까지 평가에서 제외합니다."
        ),
        "summary": {
            "sourceCases": len(source.get("cases", [])),
            "preservedCases": len(preserved_cases),
            "recoveredMovedCandidates": recovered,
            "missingCases": len(missing),
        },
        "cases": preserved_cases,
        "missing": missing,
    }
    output_path = output_dir / "manifest.json"
    output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(output["summary"], ensure_ascii=False, indent=2))
    if missing:
        print("missing=" + ", ".join(row["id"] for row in missing))
    print(f"manifest={output_path}")


if __name__ == "__main__":
    main()
