dash_path = r"apps/web/src/app/dashboard/page.tsx"
with open(dash_path, "r", encoding="utf-8") as f:
    content = f.read()

div_open = content.count("<div")
div_close = content.count("</div>")
print(f"<div count: {div_open}, </div> count: {div_close}, diff: {div_open - div_close}")

# Let's count all braces and parens
brace_open = content.count("{")
brace_close = content.count("}")
print(f"Braces: {brace_open} vs {brace_close}, diff: {brace_open - brace_close}")

paren_open = content.count("(")
paren_close = content.count(")")
print(f"Parens: {paren_open} vs {paren_close}, diff: {paren_open - paren_close}")

