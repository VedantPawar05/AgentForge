from patch_dashboard_split_exact import new_panes_jsx

depth = 0
for i, line in enumerate(new_panes_jsx.split("\n")):
    open_c = line.count("(")
    close_c = line.count(")")
    depth += open_c - close_c
    if open_c != close_c:
        print(f"Line {i+1} [depth={depth}]: {line.strip()[:60]}")

