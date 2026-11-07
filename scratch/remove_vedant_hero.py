hero_path = r"apps/web/src/components/ui/hero4.tsx"
with open(hero_path, "r", encoding="utf-8") as f:
    hero = f.read()

old_block = """              <Link
                href={currentUser ? "/dashboard" : "/login"}
                style={{
                  padding: "7px 16px", fontSize: 13, fontWeight: 500,
                  color: currentUser ? "#22c55e" : "#888", textDecoration: "none", borderRadius: 7,
                  transition: "color 0.15s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#f0f0f0")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = currentUser ? "#22c55e" : "#888")}
              >
                {currentUser ? (
                  <>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                    <span>@{currentUser.login}</span>
                  </>
                ) : (
                  "Sign in"
                )}
              </Link>"""

new_block = """              <Link
                href="/login"
                style={{
                  padding: "7px 16px", fontSize: 13, fontWeight: 500,
                  color: "#888", textDecoration: "none", borderRadius: 7,
                  transition: "color 0.15s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#f0f0f0")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#888")}
              >
                Sign in
              </Link>"""

assert old_block in hero, "old_block not found in hero4.tsx!"
hero = hero.replace(old_block, new_block, 1)

with open(hero_path, "w", encoding="utf-8") as f:
    f.write(hero)

print("Successfully replaced @vedant-dev link with clean 'Sign in' link in hero4.tsx!")

