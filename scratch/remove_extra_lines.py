dash_path = r"apps/web/src/app/dashboard/page.tsx"
with open(dash_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

leftover_start = None
for i in range(1460, 1500):
    if 'setSplitAgents((prev) => {' in lines[i]:
        leftover_start = i
        break

if leftover_start is not None:
    leftover_end = leftover_start + 7
    print(f"Removing lines {leftover_start+1} to {leftover_end}:")
    for j in range(leftover_start, leftover_end):
        print(f"{j+1}: {repr(lines[j])}")
    del lines[leftover_start:leftover_end]

    with open(dash_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("Deleted successfully!")
else:
    print("Leftover not found!")

