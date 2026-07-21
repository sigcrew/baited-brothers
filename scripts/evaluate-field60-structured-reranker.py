#!/usr/bin/env python3
"""Build and evaluate the FIELD 60 fish/cephalopod two-stage reranker."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import torch
from PIL import Image
from torch import nn
from torchvision.transforms import v2


CATALOG_PATTERN = re.compile(
    r'\["[^"]+", "(?P<scientific>[^"]+)", "(?P<ko>[^"]+)", '
    r'"(?P<group>[^"]+)"\]'
)


class CephalopodAuxiliary(nn.Module):
    def __init__(self, embedding_dim: int) -> None:
        super().__init__()
        self.gate = nn.Linear(embedding_dim, 2)
        self.specialist = nn.Linear(embedding_dim, 8)

    def forward(self, features: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        return self.gate(features), self.specialist(features)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--head", type=Path, required=True)
    parser.add_argument(
        "--cache", type=Path,
        default=Path("ml/fishial/artifacts/field60-embeddings.pt"),
    )
    parser.add_argument(
        "--manifest", type=Path,
        default=Path("qa/fish-recognition/approved-holdout/manifest.json"),
    )
    parser.add_argument(
        "--catalog", type=Path,
        default=Path("src/data/field60CatalogFallback.ts"),
    )
    parser.add_argument(
        "--output-auxiliary", type=Path,
        default=Path("ml/fishial/artifacts/field60-cephalopod-auxiliary.pt"),
    )
    parser.add_argument(
        "--output-report", type=Path,
        default=Path("ml/fishial/artifacts/field60-structured-report.json"),
    )
    return parser.parse_args()


def train_linear(
    head: nn.Module,
    features: torch.Tensor,
    labels: torch.Tensor,
    class_weights: torch.Tensor | None = None,
) -> None:
    optimizer = torch.optim.AdamW(head.parameters(), lr=0.01, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    for _ in range(80):
        optimizer.zero_grad(set_to_none=True)
        loss = criterion(head(features), labels)
        loss.backward()
        optimizer.step()


def postprocess(
    base_logits: torch.Tensor,
    gate_logits: torch.Tensor,
    specialist_logits: torch.Tensor,
) -> torch.Tensor:
    base_ranking = base_logits.topk(3, dim=1).indices
    specialist_ranking = specialist_logits.argsort(dim=1, descending=True) + 52
    result = base_ranking.clone()
    use_specialist = gate_logits.softmax(dim=1)[:, 1] >= 0.95
    for row_index in range(len(result)):
        ranking = result[row_index].tolist()
        if use_specialist[row_index]:
            ranking = ranking[:2] + [
                index
                for index in specialist_ranking[row_index].tolist()
                if index not in ranking[:2]
            ][:1]
        # Lateolabrax japonicus / L. spilonotus are the highest-risk fish pair.
        sibling = {21: 22, 22: 21}.get(ranking[0])
        if sibling is not None and sibling not in ranking:
            ranking[2] = sibling
        result[row_index] = torch.tensor(ranking)
    return result


def score(ranking: torch.Tensor, labels: torch.Tensor) -> dict[str, int | float]:
    top1 = int(ranking[:, 0].eq(labels).sum())
    top3 = int(ranking.eq(labels[:, None]).any(dim=1).sum())
    count = len(labels)
    return {
        "count": count,
        "top1": top1,
        "top3": top3,
        "top1Accuracy": top1 / count,
        "top3Accuracy": top3 / count,
    }


def image_transform() -> v2.Compose:
    return v2.Compose([
        v2.Resize((154, 434), antialias=True),
        v2.ToImage(),
        v2.ToDtype(torch.float32, scale=True),
        v2.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
    ])


def main() -> None:
    args = parse_args()
    root = Path.cwd()
    catalog = [
        match.groupdict()
        for match in CATALOG_PATTERN.finditer((root / args.catalog).read_text())
    ]
    if len(catalog) != 60:
        raise RuntimeError(f"Expected 60 species, found {len(catalog)}")
    cephalopods = torch.tensor(
        [index for index, row in enumerate(catalog) if row["group"] in {"squid", "octopus"}]
    )
    cached = torch.load(root / args.cache, map_location="cpu", weights_only=True)["embedded"]
    train_features, train_labels = cached["train"]
    gate_labels = torch.isin(train_labels, cephalopods).long()
    cephalopod_mask = gate_labels.bool()

    torch.manual_seed(42)
    auxiliary = CephalopodAuxiliary(train_features.shape[1])
    positive_weight = float((~cephalopod_mask).sum() / cephalopod_mask.sum())
    train_linear(
        auxiliary.gate, train_features, gate_labels,
        torch.tensor([1.0, positive_weight]),
    )
    train_linear(
        auxiliary.specialist,
        train_features[cephalopod_mask],
        train_labels[cephalopod_mask] - 52,
    )
    auxiliary.eval()
    base_head = torch.jit.load(str((root / args.head).resolve()), map_location="cpu").eval()

    internal = {}
    with torch.inference_mode():
        for split_name in ("validation", "test"):
            features, labels = cached[split_name]
            base_logits = base_head(features)
            gate_logits, specialist_logits = auxiliary(features)
            internal[split_name] = {
                "baseline": score(base_logits.topk(3, dim=1).indices, labels),
                "structured": score(postprocess(base_logits, gate_logits, specialist_logits), labels),
            }

    by_scientific = {
        " ".join(row["scientific"].split()[:2]).lower(): index
        for index, row in enumerate(catalog)
    }
    aliases = {
        "kareius bicoloratus": "platichthys bicoloratus",
        "lateolabrax maculatus": "lateolabrax spilonotus",
    }
    manifest_path = (root / args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text())
    images, labels = [], []
    transform = image_transform()
    for case in manifest["cases"]:
        scientific = " ".join(str(case["expectedScientificName"]).split()[:2]).lower()
        expected = by_scientific.get(aliases.get(scientific, scientific))
        path = manifest_path.parent / str(case["path"])
        if case.get("kind") != "fish" or expected is None or not path.exists():
            continue
        with Image.open(path) as image:
            images.append(transform(image.convert("RGB")))
        labels.append(expected)
    fishial = torch.jit.load(str(args.model.resolve()), map_location="cpu").eval()
    with torch.inference_mode():
        features, _ = fishial(torch.stack(images))
        features = torch.nn.functional.normalize(features.float(), dim=1)
        base_logits = base_head(features)
        gate_logits, specialist_logits = auxiliary(features)
        baseline_ranking = base_logits.topk(3, dim=1).indices
        structured_ranking = postprocess(base_logits, gate_logits, specialist_logits)
    label_tensor = torch.tensor(labels)
    matched = structured_ranking.eq(label_tensor[:, None]).any(dim=1)
    report = {
        "method": "FIELD 60 global head + cephalopod gate/specialist + Lateolabrax sibling completion",
        "provisional": True,
        "policy": {
            "cephalopodGateThreshold": 0.95,
            "candidateMerge": "global top-2 + cephalopod specialist top-1",
            "fishSiblingCompletion": ["Lateolabrax japonicus", "Lateolabrax spilonotus"],
        },
        "internal": internal,
        "holdout": {
            "baseline": score(baseline_ranking, label_tensor),
            "structured": score(structured_ranking, label_tensor),
            "top3Misses": [catalog[label]["ko"] for label, ok in zip(labels, matched) if not ok],
        },
        "warning": "잠정 자동 품질 통과 학습 사진과 55장 홀드아웃 결과이며 실배포 승인 수치가 아닙니다.",
    }
    output_auxiliary = (root / args.output_auxiliary).resolve()
    output_report = (root / args.output_report).resolve()
    output_auxiliary.parent.mkdir(parents=True, exist_ok=True)
    traced = torch.jit.trace(auxiliary, torch.zeros(1, train_features.shape[1]))
    traced.save(str(output_auxiliary))
    output_report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
