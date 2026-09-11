#!/usr/bin/env python3
"""Validate state/workboard.json, state/gates.json and state/acceptance_map.json.
Checks: unique IDs, dependencies resolve, no cycles, every acceptance scene maps to an existing packet in a phase
whose gate matches, every phase has an integration packet carrying its gate, every card file exists.
Prints a JSON summary; exit 0 on PASS, 1 on FAIL. Planning-only: it never runs the game."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def load(p): return json.load(open(os.path.join(ROOT, p)))
def main(root=ROOT):
    errors = []
    wb = json.load(open(os.path.join(root, "state/workboard.json")))
    gates = json.load(open(os.path.join(root, "state/gates.json")))
    am = json.load(open(os.path.join(root, "state/acceptance_map.json")))
    packets = wb["packets"]; ids = [p["id"] for p in packets]
    if len(ids) != len(set(ids)): errors.append("duplicate packet IDs")
    byid = {p["id"]: p for p in packets}
    phase_order = wb.get("phaseOrder", [])
    for p in packets:
        if p["phase"] not in phase_order: errors.append(f"{p['id']}: unknown phase {p['phase']}")
        for d in p["depends"]:
            if d not in byid: errors.append(f"{p['id']}: unknown dependency {d}")
        if not os.path.exists(os.path.join(root, "work", p["id"] + ".md")): errors.append(f"{p['id']}: missing work card")
        if p.get("status") not in ("PLANNED", "IN_PROGRESS", "READY_FOR_REVIEW", "ACCEPTED", "BLOCKED", "DEFERRED"):
            errors.append(f"{p['id']}: bad status {p.get('status')}")
    # cycles
    state = {}
    def visit(i, stack):
        if state.get(i) == 1: errors.append("cycle: " + " -> ".join(stack + [i])); return
        if state.get(i) == 2: return
        state[i] = 1
        for d in byid.get(i, {}).get("depends", []):
            if d in byid: visit(d, stack + [i])
        state[i] = 2
    for i in ids: visit(i, [])
    # gates per phase
    gate_by_phase = {g["phase"]: g["id"] for g in gates["gates"]}
    for ph in phase_order:
        carriers = [p for p in packets if p["phase"] == ph and p.get("gate")]
        if ph in gate_by_phase and not carriers: errors.append(f"phase {ph}: no packet carries gate {gate_by_phase[ph]}")
        for p in carriers:
            if p["gate"] != gate_by_phase.get(ph): errors.append(f"{p['id']}: carries {p['gate']} but phase gate is {gate_by_phase.get(ph)}")
    # acceptance scenes
    for s in am["scenes"]:
        p = byid.get(s["packet"])
        if not p: errors.append(f"scene {s['id']}: packet {s['packet']} missing"); continue
        if gate_by_phase.get(p["phase"]) != s["gate"]: errors.append(f"scene {s['id']}: packet {p['id']} is in {p['phase']} (gate {gate_by_phase.get(p['phase'])}) but scene gate is {s['gate']}")
    summary = {"status": "PASS" if not errors else "FAIL", "packets": len(packets),
               "byPhase": {ph: sum(1 for p in packets if p["phase"] == ph) for ph in phase_order},
               "accepted": sum(1 for p in packets if p["status"] == "ACCEPTED"),
               "scenes": len(am["scenes"]), "errors": errors[:50]}
    print(json.dumps(summary, indent=1))
    return 0 if not errors else 1
if __name__ == "__main__": sys.exit(main())
