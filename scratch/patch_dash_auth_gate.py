dash_path = r"apps/web/src/app/dashboard/page.tsx"
with open(dash_path, "r", encoding="utf-8") as f:
    code = f.read()

target = """  // ── Authentication & GitHub State ──────────────────────────────
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(() => {"""

replacement = """  // ── Authentication Gate ────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agentforge_github_user");
      if (!saved) {
        window.location.href = "/login?redirect=/dashboard";
      }
    }
  }, []);

  // ── Authentication & GitHub State ──────────────────────────────
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(() => {"""

assert target in code, "Target not found in dashboard!"
code = code.replace(target, replacement, 1)

with open(dash_path, "w", encoding="utf-8") as f:
    f.write(code)

print("Added authentication gate to dashboard/page.tsx!")

