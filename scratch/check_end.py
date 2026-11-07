dash_path = r"apps/web/src/app/dashboard/page.tsx"
with open(dash_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
for i in range(len(lines)-15, len(lines)):
    print(f"{i+1}: {repr(lines[i])}")

