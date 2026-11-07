from patch_dashboard_split_exact import new_panes_jsx

print("new_panes_jsx stats:")
print("<div:", new_panes_jsx.count("<div"), "</div>:", new_panes_jsx.count("</div>"), "diff:", new_panes_jsx.count("<div") - new_panes_jsx.count("</div>"))
print("(:", new_panes_jsx.count("("), "):", new_panes_jsx.count(")"), "diff:", new_panes_jsx.count("(") - new_panes_jsx.count(")"))
print("{:", new_panes_jsx.count("{"), "}:", new_panes_jsx.count("}"), "diff:", new_panes_jsx.count("{") - new_panes_jsx.count("}"))

