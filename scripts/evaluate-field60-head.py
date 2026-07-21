#!/usr/bin/env python3
"""Evaluate a trained FIELD 60 head on an independent image manifest."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import torch
from PIL import Image
from torchvision.transforms import v2


CATALOG_PATTERN = re.compile(
    r'\["(?P<id>[^"]+)", "(?P<scientific>[^"]+)", '
    r'"(?P<ko>[^"]+)", "(?P<group>[^"]+)"\]'
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument(
        "--head",
        type=Path,
        action="append",
        required=True,
        help="Repeat to average logits from multiple FIELD 60 heads.",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("qa/fish-recognition/approved-holdout/manifest.json"),
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=Path("src/data/field60CatalogFallback.ts"),
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument(
        "--horizontal-flip-tta",
        action="store_true",
        help="Average logits from the original and horizontally flipped image.",
    )
    parser.add_argument(
        "--group-rerank",
        choices=(
            "none",
            "top1",
            "aggregate",
            "consensus",
            "backfill",
            "cephalopod",
        ),
        default="none",
        help=(
            "Optionally constrain Top-K candidates to a morphology group. "
            "top1 uses the unconstrained winner's group; aggregate uses the "
            "group with the largest summed class probability; consensus only "
            "constrains when the first two candidates agree on a group; "
            "backfill keeps the first two and fills the final slot from the "
            "winner's group."
        ),
    )
    parser.add_argument("--device", choices=("auto", "cpu", "mps"), default="auto")
    return parser.parse_args()


def normalize_name(value: str) -> str:
    return " ".join(value.split()[:2]).lower()


def choose_device(requested: str) -> torch.device:
    if requested == "mps":
        if not torch.backends.mps.is_available():
            raise RuntimeError("MPS was requested but is unavailable")
        return torch.device("mps")
    if requested == "auto" and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def transform() -> v2.Compose:
    return v2.Compose(
        [
            v2.Resize((154, 434), antialias=True),
            v2.ToImage(),
            v2.ToDtype(torch.float32, scale=True),
            v2.Normalize(
                mean=(0.485, 0.456, 0.406),
                std=(0.229, 0.224, 0.225),
            ),
        ]
    )


def main() -> None:
    args = parse_args()
    root = Path.cwd()
    catalog_source = (root / args.catalog).read_text(encoding="utf-8")
    catalog = [
        {
            "sort": index,
            "fishId": match.group("id"),
            "scientificName": normalize_name(match.group("scientific")),
            "nameKo": match.group("ko"),
            "group": match.group("group"),
        }
        for index, match in enumerate(
            CATALOG_PATTERN.finditer(catalog_source), start=1
        )
    ]
    if len(catalog) != 60:
        raise RuntimeError(f"Expected 60 catalog species, found {len(catalog)}")
    by_name = {row["scientificName"]: row for row in catalog}
    aliases = {
        "kareius bicoloratus": "platichthys bicoloratus",
        "lateolabrax maculatus": "lateolabrax spilonotus",
    }

    manifest_path = (root / args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    records: list[dict[str, object]] = []
    missing_cases: list[dict[str, str]] = []
    for case in manifest.get("cases", []):
        if case.get("kind") != "fish":
            continue
        normalized = normalize_name(str(case.get("expectedScientificName", "")))
        expected = by_name.get(aliases.get(normalized, normalized))
        if not expected:
            continue
        image_path = (manifest_path.parent / str(case["path"])).resolve()
        if not image_path.exists():
            missing_cases.append(
                {
                    "id": str(case.get("id")),
                    "path": str(image_path),
                    "expectedNameKo": str(expected["nameKo"]),
                }
            )
            continue
        records.append(
            {"id": case.get("id"), "path": image_path, "expected": expected}
        )

    device = choose_device(args.device)
    fishial = torch.jit.load(
        str(args.model.resolve()), map_location=device
    ).eval().to(device)
    heads = [
        torch.jit.load(str(path.resolve()), map_location=device).eval().to(device)
        for path in args.head
    ]
    image_transform = transform()
    rows: list[dict[str, object]] = []
    for offset in range(0, len(records), args.batch_size):
        batch_records = records[offset : offset + args.batch_size]
        images = []
        for record in batch_records:
            with Image.open(record["path"]) as image:
                images.append(image_transform(image.convert("RGB")))
        with torch.inference_mode():
            image_batch = torch.stack(images).to(device)
            embeddings, _ = fishial(image_batch)
            embeddings = torch.nn.functional.normalize(embeddings.float(), dim=1)
            logits = torch.stack([head(embeddings) for head in heads]).mean(dim=0)
            if args.horizontal_flip_tta:
                flipped_embeddings, _ = fishial(torch.flip(image_batch, dims=(-1,)))
                flipped_embeddings = torch.nn.functional.normalize(
                    flipped_embeddings.float(), dim=1
                )
                flipped_logits = torch.stack(
                    [head(flipped_embeddings) for head in heads]
                ).mean(dim=0)
                logits = (logits + flipped_logits) / 2
            probabilities = torch.softmax(logits, dim=1).cpu()
        for record, scores in zip(batch_records, probabilities):
            unconstrained = scores.argsort(descending=True).tolist()
            selected_group = None
            if args.group_rerank == "top1":
                selected_group = catalog[unconstrained[0]]["group"]
            elif args.group_rerank == "aggregate":
                group_scores: dict[str, float] = {}
                for index, score in enumerate(scores):
                    group = str(catalog[index]["group"])
                    group_scores[group] = group_scores.get(group, 0.0) + float(score)
                selected_group = max(group_scores, key=group_scores.get)
            elif args.group_rerank == "consensus":
                first_group = catalog[unconstrained[0]]["group"]
                if catalog[unconstrained[1]]["group"] == first_group:
                    selected_group = first_group
            elif args.group_rerank == "backfill":
                selected_group = catalog[unconstrained[0]]["group"]
            elif args.group_rerank == "cephalopod":
                first_group = catalog[unconstrained[0]]["group"]
                if first_group in {"squid", "octopus"}:
                    selected_group = first_group
            if args.group_rerank == "backfill":
                top_two = unconstrained[:2]
                group_fill = next(
                    (
                        index
                        for index in unconstrained[2:]
                        if catalog[index]["group"] == selected_group
                    ),
                    unconstrained[2],
                )
                ranking = top_two + [group_fill]
            elif selected_group is None:
                ranking = unconstrained[:3]
            else:
                in_group = [
                    index
                    for index in unconstrained
                    if catalog[index]["group"] == selected_group
                ]
                outside_group = [
                    index
                    for index in unconstrained
                    if catalog[index]["group"] != selected_group
                ]
                ranking = (in_group + outside_group)[:3]
            expected = record["expected"]
            predicted = [
                {
                    "sort": index + 1,
                    "fishId": catalog[index]["fishId"],
                    "nameKo": catalog[index]["nameKo"],
                    "scientificName": catalog[index]["scientificName"],
                    "confidence": round(float(scores[index]), 6),
                }
                for index in ranking
            ]
            expected_index = int(expected["sort"]) - 1
            rows.append(
                {
                    "id": record["id"],
                    "path": str(record["path"]),
                    "expectedSort": expected["sort"],
                    "expectedNameKo": expected["nameKo"],
                    "selectedGroup": selected_group,
                    "predicted": predicted,
                    "top1Match": ranking[0] == expected_index,
                    "top3Match": expected_index in ranking,
                }
            )

    count = len(rows)
    top1 = sum(row["top1Match"] for row in rows)
    top3 = sum(row["top3Match"] for row in rows)
    report = {
        "generatedAt": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "method": (
            "Fishial frozen embedding + FIELD 60 head"
            if len(heads) == 1
            else f"Fishial frozen embedding + {len(heads)}-head logit ensemble"
        ) + (" + horizontal-flip TTA" if args.horizontal_flip_tta else ""),
        "summary": {
            "cases": count,
            "missingCases": len(missing_cases),
            "top1": top1,
            "top1Accuracy": top1 / count if count else None,
            "top3": top3,
            "top3Accuracy": top3 / count if count else None,
        },
        "top3Misses": [
            row["expectedNameKo"] for row in rows if not row["top3Match"]
        ],
        "missing": missing_cases,
        "rows": rows,
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        output = (root / args.output).resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
