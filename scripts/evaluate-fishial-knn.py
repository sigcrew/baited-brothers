#!/usr/bin/env python3
"""Evaluate Fishial embeddings as a FIELD 60 closed-set classifier.

The Fishial classifier only contains a small subset of this app's Korean
coastal catalog.  This script therefore ignores Fishial's open-set logits and
uses its normalized 768-dimensional embedding as a feature extractor.  Each
FIELD 60 species is represented by a centroid built from local reference
photos, then approved query photos are evaluated with cosine similarity.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import torch
from PIL import Image
from torchvision.transforms import v2


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
CATALOG_PATTERN = re.compile(
    r'\["(?P<id>[^"]+)", "(?P<scientific>[^"]+)", '
    r'"(?P<ko>[^"]+)", "(?P<group>[^"]+)"\]'
)


@dataclass(frozen=True)
class CatalogSpecies:
    sort: int
    fish_id: str
    scientific_name: str
    name_ko: str
    group: str


@dataclass(frozen=True)
class ImageRecord:
    path: Path
    species_sort: int
    scientific_name: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument(
        "--catalog",
        type=Path,
        default=Path("src/data/field60CatalogFallback.ts"),
    )
    parser.add_argument(
        "--references",
        type=Path,
        default=Path("qa/fish-recognition/gbif-candidates"),
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("qa/fish-recognition/approved-manifest.json"),
    )
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--max-references-per-species", type=int, default=5)
    parser.add_argument(
        "--scoring",
        choices=("centroid", "max-reference", "top2-reference-mean"),
        default="centroid",
        help="How to aggregate reference-image cosine similarities per species.",
    )
    parser.add_argument(
        "--restrict-to-catalog-group",
        action="store_true",
        help=(
            "Evaluate the optimistic ceiling when the catalog group is known. "
            "Do not treat this as deployable accuracy without a group classifier."
        ),
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--device",
        choices=("auto", "cpu", "mps"),
        default="auto",
    )
    return parser.parse_args()


def normalize_scientific_name(value: str) -> str:
    return " ".join(value.split()[:2]).lower()


def load_catalog(path: Path) -> list[CatalogSpecies]:
    source = path.read_text(encoding="utf-8")
    species = [
        CatalogSpecies(
            sort=index,
            fish_id=match.group("id"),
            scientific_name=match.group("scientific"),
            name_ko=match.group("ko"),
            group=match.group("group"),
        )
        for index, match in enumerate(CATALOG_PATTERN.finditer(source), start=1)
    ]
    if len(species) != 60:
        raise ValueError(f"Expected 60 catalog species, found {len(species)}")
    return species


def choose_device(requested: str) -> torch.device:
    if requested == "mps":
        if not torch.backends.mps.is_available():
            raise RuntimeError("MPS was requested but is unavailable")
        return torch.device("mps")
    if requested == "auto" and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def build_transform() -> v2.Compose:
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


def load_tensor(path: Path, transform: v2.Compose) -> torch.Tensor:
    with Image.open(path) as image:
        return transform(image.convert("RGB"))


def embed_records(
    model: torch.jit.ScriptModule,
    records: list[ImageRecord],
    transform: v2.Compose,
    device: torch.device,
    batch_size: int,
) -> tuple[list[ImageRecord], np.ndarray, list[dict[str, str]]]:
    valid_records: list[ImageRecord] = []
    embeddings: list[np.ndarray] = []
    errors: list[dict[str, str]] = []

    for offset in range(0, len(records), batch_size):
        batch_records = records[offset : offset + batch_size]
        tensors: list[torch.Tensor] = []
        loaded_records: list[ImageRecord] = []
        for record in batch_records:
            try:
                tensors.append(load_tensor(record.path, transform))
                loaded_records.append(record)
            except Exception as error:  # corrupted and unsupported source files
                errors.append({"path": str(record.path), "error": str(error)})

        if not tensors:
            continue

        with torch.inference_mode():
            batch = torch.stack(tensors).to(device)
            embedded, _ = model(batch)
            embedded = torch.nn.functional.normalize(embedded.float(), dim=1)
        valid_records.extend(loaded_records)
        embeddings.append(embedded.cpu().numpy())
        print(
            f"embedded {min(offset + batch_size, len(records))}/{len(records)}",
            flush=True,
        )

    if not embeddings:
        raise RuntimeError("No images could be embedded")
    return valid_records, np.concatenate(embeddings, axis=0), errors


def collect_reference_records(
    references_root: Path,
    catalog: list[CatalogSpecies],
    max_per_species: int,
    excluded_paths: set[Path],
) -> list[ImageRecord]:
    records: list[ImageRecord] = []
    catalog_by_sort = {item.sort: item for item in catalog}
    for directory in sorted(references_root.iterdir()):
        if not directory.is_dir():
            continue
        prefix = directory.name.split("-", 1)[0]
        if not prefix.isdigit():
            continue
        species = catalog_by_sort.get(int(prefix))
        if not species:
            continue
        images = sorted(
            path
            for path in directory.iterdir()
            if (
                path.is_file()
                and path.suffix.lower() in IMAGE_SUFFIXES
                and path.resolve() not in excluded_paths
            )
        )[:max_per_species]
        records.extend(
            ImageRecord(
                path=image.resolve(),
                species_sort=species.sort,
                scientific_name=species.scientific_name,
            )
            for image in images
        )
    return records


def collect_query_records(
    manifest_path: Path,
    catalog: list[CatalogSpecies],
) -> list[ImageRecord]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    by_name = {
        normalize_scientific_name(item.scientific_name): item for item in catalog
    }
    aliases = {
        "kareius bicoloratus": "platichthys bicoloratus",
        "lateolabrax maculatus": "lateolabrax spilonotus",
    }
    records: list[ImageRecord] = []
    for case in manifest.get("cases", []):
        if case.get("kind") != "fish":
            continue
        normalized = normalize_scientific_name(
            str(case.get("expectedScientificName", ""))
        )
        normalized = aliases.get(normalized, normalized)
        species = by_name.get(normalized)
        if not species:
            continue
        records.append(
            ImageRecord(
                path=(manifest_path.parent / case["path"]).resolve(),
                species_sort=species.sort,
                scientific_name=species.scientific_name,
            )
        )
    return records


def normalized_centroid(vectors: np.ndarray) -> np.ndarray:
    centroid = vectors.mean(axis=0)
    norm = np.linalg.norm(centroid)
    return centroid / max(norm, 1e-12)


def score_species(
    query_vector: np.ndarray,
    reference_vectors: np.ndarray,
    reference_indices_by_sort: dict[int, np.ndarray],
    centroids: dict[int, np.ndarray],
    species_sorts: list[int],
    scoring: str,
) -> np.ndarray:
    if scoring == "centroid":
        centroid_matrix = np.stack([centroids[key] for key in species_sorts])
        return centroid_matrix @ query_vector

    reference_similarities = reference_vectors @ query_vector
    scores: list[float] = []
    for species_sort in species_sorts:
        values = reference_similarities[reference_indices_by_sort[species_sort]]
        ordered = np.sort(values)[::-1]
        if scoring == "max-reference":
            scores.append(float(ordered[0]))
        else:
            scores.append(float(ordered[: min(2, len(ordered))].mean()))
    return np.asarray(scores, dtype=np.float32)


def percentile(values: Iterable[float], quantile: float) -> float | None:
    array = np.asarray(list(values), dtype=np.float32)
    return float(np.quantile(array, quantile)) if array.size else None


def main() -> None:
    args = parse_args()
    root = Path.cwd()
    catalog_path = (root / args.catalog).resolve()
    references_root = (root / args.references).resolve()
    manifest_path = (root / args.manifest).resolve()
    model_path = args.model.resolve()
    device = choose_device(args.device)

    catalog = load_catalog(catalog_path)
    query_records = collect_query_records(manifest_path, catalog)
    reference_records = collect_reference_records(
        references_root,
        catalog,
        args.max_references_per_species,
        {record.path for record in query_records},
    )
    print(
        f"device={device.type}, references={len(reference_records)}, "
        f"queries={len(query_records)}",
        flush=True,
    )

    model = torch.jit.load(str(model_path), map_location=device).eval().to(device)
    transform = build_transform()
    all_records = reference_records + query_records
    embedded_records, vectors, errors = embed_records(
        model,
        all_records,
        transform,
        device,
        max(1, args.batch_size),
    )

    reference_count = sum(record in reference_records for record in embedded_records)
    embedded_references = embedded_records[:reference_count]
    reference_vectors = vectors[:reference_count]
    embedded_queries = embedded_records[reference_count:]
    query_vectors = vectors[reference_count:]

    centroids: dict[int, np.ndarray] = {}
    reference_counts: dict[int, int] = {}
    reference_indices_by_sort: dict[int, np.ndarray] = {}
    for species in catalog:
        indices = [
            index
            for index, record in enumerate(embedded_references)
            if record.species_sort == species.sort
        ]
        reference_counts[species.sort] = len(indices)
        if indices:
            reference_indices_by_sort[species.sort] = np.asarray(indices)
            centroids[species.sort] = normalized_centroid(
                reference_vectors[np.asarray(indices)]
            )

    centroid_sorts = sorted(centroids)
    catalog_by_sort = {item.sort: item for item in catalog}
    rows: list[dict[str, object]] = []
    top1 = 0
    top3 = 0

    for record, vector in zip(embedded_queries, query_vectors):
        candidate_sorts = centroid_sorts
        if args.restrict_to_catalog_group:
            expected_group = catalog_by_sort[record.species_sort].group
            candidate_sorts = [
                species_sort
                for species_sort in centroid_sorts
                if catalog_by_sort[species_sort].group == expected_group
            ]
        similarities = score_species(
            vector,
            reference_vectors,
            reference_indices_by_sort,
            centroids,
            candidate_sorts,
            args.scoring,
        )
        ranking = np.argsort(-similarities)[:3]
        predicted_sorts = [candidate_sorts[index] for index in ranking]
        predicted = [
            {
                "sort": species_sort,
                "scientificName": catalog_by_sort[species_sort].scientific_name,
                "score": round(float(similarities[index]), 6),
            }
            for index, species_sort in zip(ranking, predicted_sorts)
        ]
        top1_match = predicted_sorts[0] == record.species_sort
        top3_match = record.species_sort in predicted_sorts
        top1 += int(top1_match)
        top3 += int(top3_match)
        rows.append(
            {
                "path": str(record.path),
                "expectedSort": record.species_sort,
                "expectedScientificName": record.scientific_name,
                "predicted": predicted,
                "top1Match": top1_match,
                "top3Match": top3_match,
            }
        )

    query_count = len(rows)
    correct_top1_scores = [
        float(row["predicted"][0]["score"])
        for row in rows
        if row["top1Match"]
    ]
    incorrect_top1_scores = [
        float(row["predicted"][0]["score"])
        for row in rows
        if not row["top1Match"]
    ]
    report = {
        "model": {
            "name": "Fishial DinoV2-224 + ViT v0.10.2",
            "inputSize": [154, 434],
            "embeddingSize": 768,
            "device": device.type,
        },
        "method": (
            f"FIELD 60 {args.scoring} cosine similarity"
            + (
                " with oracle catalog-group restriction"
                if args.restrict_to_catalog_group
                else ""
            )
        ),
        "summary": {
            "catalogSpecies": len(catalog),
            "coveredSpecies": len(centroids),
            "referenceImages": len(embedded_references),
            "queryImages": query_count,
            "top1Accuracy": top1 / query_count if query_count else None,
            "top3Accuracy": top3 / query_count if query_count else None,
            "embeddingErrors": len(errors),
        },
        "scoreDiagnostics": {
            "correctTop1P10": percentile(correct_top1_scores, 0.1),
            "incorrectTop1P90": percentile(incorrect_top1_scores, 0.9),
        },
        "referenceCounts": {
            catalog_by_sort[key].scientific_name: value
            for key, value in reference_counts.items()
        },
        "errors": errors,
        "rows": rows,
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
