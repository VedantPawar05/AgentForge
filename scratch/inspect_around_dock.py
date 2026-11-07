dash_path = r"apps/web/src/app/dashboard/page.tsx"
with open(dash_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i in range(4110, min(len(lines), 4140)):
    print(f"{i+1}: {repr(lines[i])}")

