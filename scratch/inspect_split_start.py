dash_path = r"apps/web/src/app/dashboard/page.tsx"
with open(dash_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "/* Main Split Layout: Roster & Code Panes */" in l:
        for j in range(i-5, i+50):
            print(f"{j+1}: {repr(lines[j])}")
        break

