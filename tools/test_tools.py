import json, os, shutil, tempfile, unittest, importlib.util, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py")); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
class KitTools(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        for d in ("state", "work"): shutil.copytree(os.path.join(ROOT, d), os.path.join(self.tmp, d))
    def tearDown(self): shutil.rmtree(self.tmp)
    def reset_to_planned(self):
        """Make the temp copy look like the freshly shipped board (every packet PLANNED),
        so the 'initial' expectations stay valid after packets are accepted on the live board (W0-01)."""
        p = os.path.join(self.tmp, "state/workboard.json"); wb = json.load(open(p))
        for pk in wb["packets"]: pk["status"] = "PLANNED"
        json.dump(wb, open(p, "w"), indent=1)
    def test_check_passes_on_shipped_kit(self):
        import io, contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf): rc = load("check_workboard").main(self.tmp)
        self.assertEqual(rc, 0, buf.getvalue())
    def test_check_detects_cycle_and_missing_dep(self):
        p = os.path.join(self.tmp, "state/workboard.json"); wb = json.load(open(p))
        wb["packets"][1]["depends"].append(wb["packets"][2]["id"]); wb["packets"][2]["depends"].append(wb["packets"][1]["id"])
        wb["packets"][3]["depends"].append("NOPE-99"); json.dump(wb, open(p, "w"))
        import io, contextlib; buf = io.StringIO()
        with contextlib.redirect_stdout(buf): rc = load("check_workboard").main(self.tmp)
        self.assertEqual(rc, 1); out = buf.getvalue(); self.assertIn("cycle", out); self.assertIn("NOPE-99", out)
    def test_next_work_initially_only_w0_01(self):
        self.reset_to_planned()
        current, out = load("next_work").ready(self.tmp)
        self.assertEqual(current, "W0"); self.assertEqual([p["id"] for p in out if p["phase"] == "W0"], ["W0-01"])
    def test_mark_refuses_accept_with_unaccepted_deps(self):
        self.reset_to_planned(); m = load("mark")
        with self.assertRaises(SystemExit): m.mark("W0-02", "ACCEPTED", self.tmp)
        m.mark("W0-01", "ACCEPTED", self.tmp); m.mark("W0-02", "ACCEPTED", self.tmp)
        current, out = load("next_work").ready(self.tmp)
        self.assertIn("W0-03", [p["id"] for p in out]); self.assertIn("W0-04", [p["id"] for p in out])
    def test_live_board_next_work_is_in_w0_until_g0(self):
        # Reads the live board (not reset): the current phase must be W0 until W0-11 is ACCEPTED,
        # and every ready packet must have all dependencies ACCEPTED.
        wb = json.load(open(os.path.join(self.tmp, "state/workboard.json")))
        byid = {p["id"]: p for p in wb["packets"]}
        current, out = load("next_work").ready(self.tmp)
        if byid["W0-11"]["status"] != "ACCEPTED": self.assertEqual(current, "W0")
        for p in out: self.assertTrue(all(byid[d]["status"] == "ACCEPTED" for d in p["depends"]), p["id"])
class KitSnapshot(unittest.TestCase):
    """docs/production is the delivered kit, frozen. Every file must still match the kit's own MANIFEST.json
    (SHA-256 and size), and nothing may be added or removed there except docs/production/adr/ (W0-11)."""
    SNAPSHOT = os.path.join(ROOT, "docs", "production")
    ALLOWED_EXTRA_PREFIXES = ("adr/", "KIT_IMPORT.md")
    def test_snapshot_matches_manifest(self):
        import hashlib
        m = json.load(open(os.path.join(self.SNAPSHOT, "MANIFEST.json")))
        listed = set()
        for f in m["files"]:
            p = os.path.join(self.SNAPSHOT, f["path"]); listed.add(f["path"])
            self.assertTrue(os.path.exists(p), f"missing from snapshot: {f['path']}")
            data = open(p, "rb").read()
            self.assertEqual(len(data), f["bytes"], f["path"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), f["sha256"], f"edited frozen kit file: {f['path']}")
        ondisk = set()
        for dp, _, fn in os.walk(self.SNAPSHOT):
            for x in fn:
                rel = os.path.relpath(os.path.join(dp, x), self.SNAPSHOT).replace(os.sep, "/")
                if rel != "MANIFEST.json": ondisk.add(rel)
        extra = sorted(r for r in ondisk - listed if not r.startswith(self.ALLOWED_EXTRA_PREFIXES))
        self.assertEqual(extra, [], "unexpected files in the frozen kit snapshot")
        self.assertEqual(len(listed), 196)
if __name__ == "__main__": unittest.main()
