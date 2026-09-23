"""Non-destructive SQLite backup/restore contract CLI."""
from __future__ import annotations

import argparse
from pathlib import Path

from backend.app.production import backup_database, restore_database


parser = argparse.ArgumentParser()
subparsers = parser.add_subparsers(dest="command", required=True)
backup = subparsers.add_parser("backup")
backup.add_argument("destination", type=Path)
backup.add_argument("--overwrite", action="store_true")
restore = subparsers.add_parser("restore")
restore.add_argument("backup", type=Path)
restore.add_argument("destination", type=Path)
restore.add_argument("--overwrite", action="store_true")
args = parser.parse_args()

if args.command == "backup":
    print(backup_database(args.destination, overwrite=args.overwrite))
else:
    print(restore_database(args.backup, args.destination, overwrite=args.overwrite))
