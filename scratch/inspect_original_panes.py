with open(r"scratch/build_dashboard.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "{/* Right: Side-by-Side Live Code Panes */}" in l:
        for j in range(i, i + 130):
            print(f"{j+1}: {repr(lines[j])}")
        break

