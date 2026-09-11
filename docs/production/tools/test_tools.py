import json, os, shutil, tempfile, unittest, importlib.util, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py")); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
class KitTools(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        for d in ("state", "work"): shutil.copytree(os.path.join(ROOT, d), os.path.join(self.tmp, d))
    def tearDown(self): shutil.rmtree(self.tmp)
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
        current, out = load("next_work").ready(self.tmp)
        self.assertEqual(current, "W0"); self.assertEqual([p["id"] for p in out if p["phase"] == "W0"], ["W0-01"])
    def test_mark_refuses_accept_with_unaccepted_deps(self):
        m = load("mark")
        with self.assertRaises(SystemExit): m.mark("W0-02", "ACCEPTED", self.tmp)
        m.mark("W0-01", "ACCEPTED", self.tmp); m.mark("W0-02", "ACCEPTED", self.tmp)
        current, out = load("next_work").ready(self.tmp)
        self.assertIn("W0-03", [p["id"] for p in out]); self.assertIn("W0-04", [p["id"] for p in out])
if __name__ == "__main__": unittest.main()
