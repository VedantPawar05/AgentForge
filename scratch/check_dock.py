dash_path = r"apps/web/src/app/dashboard/page.tsx"
with open(dash_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "{/* Bottom Dock: Agent Log / Problems / Output */}" in l:
        print(f"Lines before bottom dock (lines {i-10} to {i+5}):")
        for j in range(max(0, i-10), min(len(lines), i+5)):
            print(f"{j+1}: {repr(lines[j])}")
        break

