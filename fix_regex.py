"""Fix the broken regex line in intent_parser.py."""
import pathlib

fp = pathlib.Path("backend/services/intent_parser.py")
lines = fp.read_text(encoding="utf-8").splitlines(keepends=True)

# Line 663 (0-indexed: 662) has the broken regex
# Replace it with a clean version without the > character
for i, line in enumerate(lines):
    if "taller than" in line and "re.search" not in line:
        lines[i] = (
            '            r"\\b(greater than|more than|above|over|exceeds?|'
            'at least|older than|higher than|taller than)"\n'
        )
        print(f"Fixed line {i+1}: {lines[i].rstrip()}")
        break

fp.write_text("".join(lines), encoding="utf-8")
print("Done.")
