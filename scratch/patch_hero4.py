import re

hero_path = r"apps/web/src/components/ui/hero4.tsx"
with open(hero_path, "r", encoding="utf-8") as f:
    hero = f.read()

old_nav = """  const targetDashboardHref = currentUser ? "/dashboard" : "/login?redirect=/dashboard";
  const targetAnalyticsHref = currentUser ? "/analytics" : "/login?redirect=/analytics";

  const navLinks = [
    { href: targetDashboardHref, label: "Control Plane" },
    { href: targetAnalyticsHref, label: "Analytics Bento" },
    { href: "#architecture",     label: "Architecture" },
    { href: "#features",         label: "Features" },
  ];"""

new_nav = """  const targetDashboardHref = currentUser ? "/dashboard" : "/login?redirect=/dashboard";
  const targetAnalyticsHref = currentUser ? "/analytics" : "/login?redirect=/analytics";
  const targetArchHref      = currentUser ? "#architecture" : "/login?redirect=/#architecture";
  const targetFeatHref      = currentUser ? "#features" : "/login?redirect=/#features";

  const navLinks = [
    { href: targetDashboardHref, label: "Control Plane" },
    { href: targetAnalyticsHref, label: "Analytics Bento" },
    { href: targetArchHref,      label: "Architecture" },
    { href: targetFeatHref,      label: "Features" },
  ];"""

if old_nav in hero:
    hero = hero.replace(old_nav, new_nav)
    with open(hero_path, "w", encoding="utf-8") as f:
        f.write(hero)
    print("Successfully updated hero4.tsx navigation targets!")
else:
    print("Target old_nav not found in hero4.tsx!")

