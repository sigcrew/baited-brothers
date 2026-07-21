#!/usr/bin/env python3
"""Train a lightweight FIELD 60 linear head on frozen Fishial embeddings."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import random
import re
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torchvision.transforms import v2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument(
        "--split",
        type=Path,
        default=Path("qa/fish-recognition/training-split-manifest.json"),
    )
    parser.add_argument(
        "--output-head",
        type=Path,
        default=Path("ml/fishial/artifacts/field60-linear-head.pt"),
    )
    parser.add_argument(
        "--output-report",
        type=Path,
        default=Path("ml/fishial/artifacts/field60-training-report.json"),
    )
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--epochs", type=int, default=300)
    parser.add_argument("--learning-rate", type=float, default=0.01)
    parser.add_argument("--weight-decay", type=float, default=1e-3)
    parser.add_argument("--label-smoothing", type=float, default=0.0)
    parser.add_argument("--class-weight-power", type=float, default=1.0)
    parser.add_argument(
        "--architecture",
        choices=("linear", "mlp", "hierarchical"),
        default="linear",
    )
    parser.add_argument("--hidden-dim", type=int, default=256)
    parser.add_argument("--dropout", type=float, default=0.2)
    parser.add_argument("--group-score-weight", type=float, default=1.0)
    parser.add_argument("--group-loss-weight", type=float, default=0.5)
    parser.add_argument(
        "--catalog",
        type=Path,
        default=Path("src/data/field60CatalogFallback.ts"),
    )
    parser.add_argument(
        "--embedding-cache",
        type=Path,
        default=Path("ml/fishial/artifacts/field60-embeddings.pt"),
    )
    parser.add_argument(
        "--augment-horizontal-flip",
        action="store_true",
        help="Add horizontally flipped Fishial embeddings to the training split.",
    )
    parser.add_argument("--patience", type=int, default=35)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--refit-all-epochs",
        type=int,
        default=0,
        help=(
            "After hyperparameter selection, train on train+validation+test for "
            "this fixed number of epochs. Evaluate only on the external holdout."
        ),
    )
    parser.add_argument("--device", choices=("auto", "cpu", "mps"), default="auto")
    return parser.parse_args()


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


def embed_split(
    root: Path,
    records: list[dict[str, object]],
    model: torch.jit.ScriptModule,
    transform: v2.Compose,
    device: torch.device,
    batch_size: int,
    split_name: str,
    augment_horizontal_flip: bool,
) -> tuple[torch.Tensor, torch.Tensor]:
    vectors: list[torch.Tensor] = []
    labels: list[int] = []
    for offset in range(0, len(records), batch_size):
        batch_records = records[offset : offset + batch_size]
        images: list[torch.Tensor] = []
        for record in batch_records:
            with Image.open(root / str(record["file"])) as image:
                images.append(transform(image.convert("RGB")))
            labels.append(int(record["speciesSort"]) - 1)
        with torch.inference_mode():
            image_batch = torch.stack(images).to(device)
            embedded, _ = model(image_batch)
            embedded = torch.nn.functional.normalize(embedded.float(), dim=1)
        vectors.append(embedded.cpu())
        if augment_horizontal_flip:
            with torch.inference_mode():
                flipped, _ = model(torch.flip(image_batch, dims=(-1,)))
                flipped = torch.nn.functional.normalize(flipped.float(), dim=1)
            vectors.append(flipped.cpu())
            labels.extend(
                int(record["speciesSort"]) - 1 for record in batch_records
            )
        print(
            f"{split_name}: embedded {min(offset + batch_size, len(records))}/{len(records)}",
            flush=True,
        )
    return torch.cat(vectors), torch.tensor(labels, dtype=torch.long)


def accuracy(logits: torch.Tensor, labels: torch.Tensor, top_k: int) -> float:
    predictions = logits.topk(min(top_k, logits.shape[1]), dim=1).indices
    return float(predictions.eq(labels[:, None]).any(dim=1).float().mean())


def evaluate(
    head: nn.Module,
    features: torch.Tensor,
    labels: torch.Tensor,
    device: torch.device,
) -> dict[str, float]:
    head.eval()
    with torch.inference_mode():
        logits = head(features.to(device)).cpu()
    return {
        "top1Accuracy": accuracy(logits, labels, 1),
        "top3Accuracy": accuracy(logits, labels, 3),
    }


def split_signature(split_manifest: dict[str, object]) -> str:
    rows = []
    for split_name in ("train", "validation", "test"):
        for row in split_manifest["splits"][split_name]:
            rows.append(
                f"{split_name}:{row['file']}:{row.get('sha256', '')}:"
                f"{row['speciesSort']}"
            )
    return hashlib.sha256("\n".join(rows).encode("utf-8")).hexdigest()


class HierarchicalHead(nn.Module):
    def __init__(
        self,
        embedding_dim: int,
        group_index_by_species: torch.Tensor,
        group_count: int,
        group_score_weight: float,
    ) -> None:
        super().__init__()
        self.species = nn.Linear(embedding_dim, 60)
        self.group = nn.Linear(embedding_dim, group_count)
        self.register_buffer("group_index_by_species", group_index_by_species)
        self.group_score_weight = group_score_weight

    def forward(self, features: torch.Tensor) -> torch.Tensor:
        species_logits = self.species(features)
        group_logits = self.group(features)
        return species_logits + self.group_score_weight * group_logits.index_select(
            1, self.group_index_by_species
        )


def load_group_mapping(catalog_path: Path) -> tuple[torch.Tensor, int]:
    source = catalog_path.read_text(encoding="utf-8")
    groups = re.findall(
        r'\["[^"]+", "[^"]+", "[^"]+", "([^"]+)"\]', source
    )
    if len(groups) != 60:
        raise RuntimeError(f"Expected 60 catalog groups, found {len(groups)}")
    names = list(dict.fromkeys(groups))
    indexes = torch.tensor([names.index(group) for group in groups], dtype=torch.long)
    return indexes, len(names)


def build_head(
    args: argparse.Namespace,
    embedding_dim: int,
    group_index_by_species: torch.Tensor,
    group_count: int,
) -> nn.Module:
    if args.architecture == "linear":
        return nn.Linear(embedding_dim, 60)
    if args.architecture == "hierarchical":
        return HierarchicalHead(
            embedding_dim,
            group_index_by_species,
            group_count,
            args.group_score_weight,
        )
    return nn.Sequential(
        nn.LayerNorm(embedding_dim),
        nn.Linear(embedding_dim, args.hidden_dim),
        nn.GELU(),
        nn.Dropout(args.dropout),
        nn.Linear(args.hidden_dim, 60),
    )


def main() -> None:
    args = parse_args()
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    root = Path.cwd()
    split_path = (root / args.split).resolve()
    split_manifest = json.loads(split_path.read_text(encoding="utf-8"))
    if not split_manifest.get("provisional") and not split_manifest.get(
        "releaseEligible"
    ):
        raise RuntimeError("승인되지 않은 비임시 데이터셋은 학습할 수 없습니다")

    device = choose_device(args.device)
    signature = split_signature(split_manifest) + (
        ":train-hflip" if args.augment_horizontal_flip else ":no-augmentation"
    )
    cache_path = (root / args.embedding_cache).resolve()
    embedded: dict[str, tuple[torch.Tensor, torch.Tensor]]
    if cache_path.exists():
        cached = torch.load(cache_path, map_location="cpu", weights_only=True)
        if cached.get("signature") == signature:
            embedded = cached["embedded"]
            print(f"embedding cache hit: {cache_path}", flush=True)
        else:
            embedded = {}
    else:
        embedded = {}
    if not embedded:
        fishial = torch.jit.load(
            str(args.model.resolve()), map_location=device
        ).eval().to(device)
        transform = build_transform()
        for split_name in ("train", "validation", "test"):
            records = split_manifest["splits"][split_name]
            if not records:
                raise RuntimeError(f"{split_name} split is empty")
            embedded[split_name] = embed_split(
                root,
                records,
                fishial,
                transform,
                device,
                max(1, args.batch_size),
                split_name,
                args.augment_horizontal_flip and split_name == "train",
            )
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        torch.save({"signature": signature, "embedded": embedded}, cache_path)

    train_features, train_labels = embedded["train"]
    validation_features, validation_labels = embedded["validation"]
    if args.refit_all_epochs > 0:
        train_features = torch.cat(
            [embedded[name][0] for name in ("train", "validation", "test")]
        )
        train_labels = torch.cat(
            [embedded[name][1] for name in ("train", "validation", "test")]
        )
    counts = torch.bincount(train_labels, minlength=60).float()
    mean_count = counts[counts > 0].mean()
    class_weights = torch.where(
        counts > 0,
        (mean_count / counts.clamp_min(1)).pow(args.class_weight_power),
        0,
    )
    positive = class_weights[class_weights > 0]
    class_weights = class_weights / positive.mean()

    group_index_by_species, group_count = load_group_mapping(
        (root / args.catalog).resolve()
    )
    head = build_head(
        args, train_features.shape[1], group_index_by_species, group_count
    ).to(device)
    optimizer = torch.optim.AdamW(
        head.parameters(), lr=args.learning_rate, weight_decay=args.weight_decay
    )
    criterion = nn.CrossEntropyLoss(
        weight=class_weights.to(device), label_smoothing=args.label_smoothing
    )
    group_criterion = nn.CrossEntropyLoss(label_smoothing=args.label_smoothing)
    best_state = copy.deepcopy(head.state_dict())
    best_validation_top3 = -1.0
    best_epoch = 0
    stale_epochs = 0

    train_features_device = train_features.to(device)
    train_labels_device = train_labels.to(device)
    epoch_limit = args.refit_all_epochs or args.epochs
    for epoch in range(1, epoch_limit + 1):
        head.train()
        optimizer.zero_grad(set_to_none=True)
        logits = head(train_features_device)
        loss = criterion(logits, train_labels_device)
        if isinstance(head, HierarchicalHead):
            group_labels = group_index_by_species.to(device).index_select(
                0, train_labels_device
            )
            group_logits = head.group(train_features_device)
            loss = loss + args.group_loss_weight * group_criterion(
                group_logits, group_labels
            )
        loss.backward()
        optimizer.step()

        validation = evaluate(
            head, validation_features, validation_labels, device
        )
        if args.refit_all_epochs > 0:
            best_validation_top3 = validation["top3Accuracy"]
            best_state = copy.deepcopy(head.state_dict())
            best_epoch = epoch
        elif validation["top3Accuracy"] > best_validation_top3 + 1e-6:
            best_validation_top3 = validation["top3Accuracy"]
            best_state = copy.deepcopy(head.state_dict())
            best_epoch = epoch
            stale_epochs = 0
        else:
            stale_epochs += 1
        if epoch == 1 or epoch % 20 == 0:
            print(
                f"epoch={epoch} loss={float(loss.detach()):.4f} "
                f"val_top1={validation['top1Accuracy']:.4f} "
                f"val_top3={validation['top3Accuracy']:.4f}",
                flush=True,
            )
        if args.refit_all_epochs == 0 and stale_epochs >= args.patience:
            break

    head.load_state_dict(best_state)
    metrics = {
        split_name: evaluate(head, features, labels, device)
        for split_name, (features, labels) in embedded.items()
    }
    output_head = (root / args.output_head).resolve()
    output_report = (root / args.output_report).resolve()
    output_head.parent.mkdir(parents=True, exist_ok=True)
    traced = torch.jit.trace(head.cpu(), torch.zeros(1, train_features.shape[1]))
    traced.save(str(output_head))
    report = {
        "generatedAt": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "provisional": bool(split_manifest.get("provisional")),
        "releaseEligible": bool(split_manifest.get("releaseEligible")),
        "refitAll": args.refit_all_epochs > 0,
        "refitAllEpochs": args.refit_all_epochs or None,
        "architecture": (
            "Fishial v0.10.2 frozen 768-dim embedding + "
            f"{args.architecture} 60-class head"
        ),
        "hyperparameters": {
            "learningRate": args.learning_rate,
            "weightDecay": args.weight_decay,
            "labelSmoothing": args.label_smoothing,
            "classWeightPower": args.class_weight_power,
            "hiddenDim": args.hidden_dim if args.architecture == "mlp" else None,
            "dropout": args.dropout if args.architecture == "mlp" else None,
            "groupScoreWeight": (
                args.group_score_weight
                if args.architecture == "hierarchical"
                else None
            ),
            "groupLossWeight": (
                args.group_loss_weight
                if args.architecture == "hierarchical"
                else None
            ),
            "seed": args.seed,
            "augmentHorizontalFlip": args.augment_horizontal_flip,
        },
        "device": device.type,
        "bestEpoch": best_epoch,
        "bestValidationTop3": best_validation_top3,
        "splitCounts": {
            name: len(split_manifest["splits"][name])
            for name in ("train", "validation", "test")
        },
        "speciesWithTrainingImages": int((counts > 0).sum()),
        "metrics": metrics,
        "warning": (
            "임시 자동 품질 통과 데이터 결과이며 종 동정 승인 전이므로 "
            "실배포 정확도로 사용할 수 없습니다. refitAll=true이면 내부 "
            "split 지표는 학습 데이터 지표이며 외부 holdout만 평가에 유효합니다."
        ),
    }
    output_report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
