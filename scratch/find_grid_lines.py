dash_path = r"apps/web/src/app/dashboard/page.tsx"
with open(dash_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = None
end_idx = None

for i, l in enumerate(lines):
    if "{/* Right: Side-by-Side Live Code Panes */}" in l:
        start_idx = i
    if "{/* Bottom Dock: Agent Log / Problems / Output */}" in l:
        end_idx = i
        break

print(f"start_idx: {start_idx}, end_idx: {end_idx}")
if start_idx is not None and end_idx is not None:
    print("--- LINES TO REPLACE ---")
    print("".join(lines[start_idx:end_idx]))

