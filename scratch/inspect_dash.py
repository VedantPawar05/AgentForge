dash_path = r"apps/web/src/app/dashboard/page.tsx"
with open(dash_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 875 <= i <= 895:
        print(f"{i+1}: {l}", end="")
    if 1350 <= i <= 1405:
        print(f"{i+1}: {l}", end="")

