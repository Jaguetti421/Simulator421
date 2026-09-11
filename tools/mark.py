#!/usr/bin/env python3
"""Update one packet's status in state/workboard.json. Usage: python tools/mark.py P1-07 ACCEPTED
ACCEPTED requires that every dependency is already ACCEPTED (refuses otherwise)."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VALID = ("PLANNED", "IN_PROGRESS", "READY_FOR_REVIEW", "ACCEPTED", "BLOCKED", "DEFERRED")
def mark(pid, status, root=ROOT):
    path = os.path.join(root, "state/workboard.json"); wb = json.load(open(path))
    byid = {p["id"]: p for p in wb["packets"]}
    if pid not in byid: raise SystemExit(f"unknown packet {pid}")
    if status not in VALID: raise SystemExit(f"bad status {status}; valid: {VALID}")
    if status == "ACCEPTED":
        bad = [d for d in byid[pid]["depends"] if byid[d]["status"] != "ACCEPTED"]
        if bad: raise SystemExit(f"cannot accept {pid}: dependencies not accepted: {bad}")
    byid[pid]["status"] = status
    json.dump(wb, open(path, "w"), indent=1); print(f"{pid} -> {status}")
if __name__ == "__main__":
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    mark(sys.argv[1], sys.argv[2])
