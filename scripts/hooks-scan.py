"""Heuristic rules-of-hooks check (no ESLint in this repo): a hook called at a
component's top level after an early `if (...) return`. Run: python scripts/hooks-scan.py src"""
import re, sys
from pathlib import Path
root = Path(sys.argv[1])
hook = re.compile(r"\buse[A-Z]\w*\(")
start = re.compile(r"^(export (default )?)?function ([A-Z]\w*|use[A-Z]\w*)\(")
bad = 0
for f in root.rglob("*.tsx"):
    lines = f.read_text(encoding="utf-8").split("\n")
    i = 0
    while i < len(lines):
        m = start.match(lines[i])
        if not m:
            i += 1; continue
        name = m.group(3)
        j = i + 1
        early = None
        while j < len(lines) and not lines[j].startswith("}"):
            ln = lines[j]
            if ln.startswith("  ") and not ln.startswith("   "):
                body = ln.strip()
                if early is None and re.match(r"if \(.*\) return\b", body):
                    early = j + 1
                elif early is not None and hook.search(body) and not body.startswith("//") and not body.startswith("return"):
                    print(f"{f.relative_to(root)}:{j+1}  {name}: hook after early return at line {early}: {body[:90]}")
                    bad += 1
            j += 1
        i = j + 1
print("flagged", bad)
