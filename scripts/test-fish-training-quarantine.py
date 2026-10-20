import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class QuarantineTest(unittest.TestCase):
    def test_quarantined_holdout_never_enters_provisional_training(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            row = dict(file="photo.jpg", sha256="quarantined", speciesSort=21,
                       nameKo="황돔", scientificName="Dentex hypselosomus",
                       sourceUrl="https://example.test/1", license="CC0",
                       autoStatus="quality-pass", biologicalReview="pending",
                       photoTypeReview="pending")
            (root / "audit.json").write_text(json.dumps({"images": [row]}))
            (root / "holdout.json").write_text(json.dumps({"cases": [], "quarantinedCases": [{"sha256": "quarantined", "path": "old.jpg"}]}))
            subprocess.run([sys.executable, "scripts/prepare-fish-training-split.py",
                            "--audit", str(root / "audit.json"),
                            "--holdout-manifest", str(root / "holdout.json"),
                            "--review-decisions", str(root / "absent.json"),
                            "--output", str(root / "split.json"),
                            "--provisional-quality-pass"], check=True, capture_output=True)
            result = json.loads((root / "split.json").read_text())
            self.assertEqual(result["summary"]["eligibleImages"], 0)
            self.assertEqual(result["summary"]["holdoutExcluded"], 1)


if __name__ == "__main__":
    unittest.main()
