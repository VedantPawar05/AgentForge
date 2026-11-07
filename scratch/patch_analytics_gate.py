demo_path = r"apps/web/src/components/ui/analytics-bento-demo.tsx"
with open(demo_path, "r", encoding="utf-8") as f:
    code = f.read()

# Add auth check effect
if 'localStorage.getItem("agentforge_github_user")' not in code:
    old_hook = "export default function AnalyticsBentoDemo() {"
    new_hook = """export default function AnalyticsBentoDemo() {
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agentforge_github_user");
      if (!saved) {
        window.location.href = "/login?redirect=/analytics";
      }
    }
  }, []);"""
    code = code.replace(old_hook, new_hook, 1)
    with open(demo_path, "w", encoding="utf-8") as f:
        f.write(code)
    print("Added auth gate to AnalyticsBentoDemo!")
else:
    print("Auth gate already in AnalyticsBentoDemo")

