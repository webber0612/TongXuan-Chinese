"""Run the Phase 18 commercialization gate without making legal/licensing claims."""
from __future__ import annotations

import argparse
import json
import sys

from backend.app.commercialization import audit_registry

parser = argparse.ArgumentParser()
parser.add_argument("--build-target", choices=("family", "commercial"), default="family")
args = parser.parse_args()
result = audit_registry(args.build_target)
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(1 if result["status"] == "FAIL" else 0)
