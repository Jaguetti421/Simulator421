# Planning utilities (web kit)

Standard library only (Python 3.10+). They validate and read the workboard; they never run the game.

```text
python tools/check_workboard.py          # structure, dependencies, cycles, gate and scene coverage
python tools/next_work.py [--phase P1]   # packets whose dependencies are ACCEPTED, in phase order
python tools/mark.py P1-07 ACCEPTED      # update one status (ACCEPTED requires accepted dependencies)
python -m unittest discover -s tools -p test_tools.py -v
```

`check_workboard.py` runs in CI. `mark.py ACCEPTED` should follow a fresh-context self-review, never precede it.
