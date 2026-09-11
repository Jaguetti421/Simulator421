#!/usr/bin/env python3
"""List packets whose dependencies are ACCEPTED, in phase order. Read-only.
Usage: python tools/next_work.py [--phase P1] [--n 5]"""
import json, os, sys, argparse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def ready(root=ROOT, phase=None):
    wb = json.load(open(os.path.join(root, "state/workboard.json")))
    byid = {p["id"]: p for p in wb["packets"]}
    order = {ph: i for i, ph in enumerate(wb["phaseOrder"])}
    # current phase = earliest phase with an unaccepted packet (PX is optional and excluded unless asked)
    unfinished = [p for p in wb["packets"] if p["status"] != "ACCEPTED" and p["phase"] != "PX"]
    current = min((p["phase"] for p in unfinished), key=lambda x: order[x]) if unfinished else None
    out = []
    for p in wb["packets"]:
        if p["status"] not in ("PLANNED", "IN_PROGRESS", "BLOCKED"): continue
        if phase and p["phase"] != phase: continue
        if not phase and p["phase"] == "PX": continue
        if all(byid[d]["status"] == "ACCEPTED" for d in p["depends"]):
            out.append(p)
    out.sort(key=lambda p: (order[p["phase"]], p["id"]))
    return current, out
if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--phase"); ap.add_argument("--n", type=int, default=5)
    a = ap.parse_args()
    current, out = ready(phase=a.phase)
    print(json.dumps({"currentPhase": current, "ready": [{"id": p["id"], "phase": p["phase"], "status": p["status"], "complexity": p.get("complexity"), "title": p["title"]} for p in out[:a.n]],
                      "note": "Work the first ready packet of the current phase. Later phases are listed only for planning; do not start them before the phase-end stop."}, indent=1))
