hero_path = r"apps/web/src/components/ui/hero4.tsx"
with open(hero_path, "r", encoding="utf-8") as f:
    hero = f.read()

hero = hero.replace('key={l.href}', 'key={l.label}')
with open(hero_path, "w", encoding="utf-8") as f:
    f.write(hero)
print("Updated nav keys to l.label")

