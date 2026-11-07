file_path = r"USER_TESTING_BUGS_AND_GLITCHES.txt"
with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

target = """5. [GLITCH] Missing Dynamic Model Switcher per Agent:"""

addition = """5. [FIXED] Split View 1P / 2P / 3P / 4P Multi-Pane Squad Layout:
   - Behavior: Previously, clicking "3P" or "4P" in the Split View header only altered the button pill active state; the grid stayed hardcoded to 2 panes (`gridTemplateColumns: 1fr 1fr`), and panes 3 and 4 were absent from the JSX.
   - Status: Fixed.
     * 1P: 1 wide pane focused on the Developer Agent (`session.ts`).
     * 2P: 2 panes side-by-side (Developer Agent + Tester Agent running Vitest).
     * 3P: 3 panes side-by-side adding the Security Auditor Agent (`auth.security.ts`) with interactive AST taint scanning (`🛡️ Run AST Audit`).
     * 4P: 4 panes side-by-side adding the Architect Agent (`session.types.ts`) with TypeScript contract validation (`📐 Verify Schema`).
     * Squad Roster: Left-hand active squad roster dynamically synchronizes with 1, 2, 3, or 4 active agents.
     * "+ Add Agent" button smoothly scales the squad from 1P to 2P to 3P to 4P with live status notifications.

6. [FIXED] Full Top-Nav Landing Page Gate & Login Flow:
   - Behavior: Top nav links ("Control Plane", "Analytics Bento", "Architecture", "Features", "Dashboard ->") and hero buttons ("Open Control Plane", "Live Tasks & Runs") did not enforce authentication before workspace entry.
   - Status: Fixed.
     * Any unauthenticated click smoothly redirects to `/login` with target destination preserved (`/login?redirect=...`).
     * Both `/dashboard` and `/analytics` strictly enforce the authentication checkpoint on direct URL entry.
     * Seamless 1-click GitHub and Google workspace login on the matching red-aura login screen.

7. [GLITCH] Missing Dynamic Model Switcher per Agent:"""

if target in text:
    text = text.replace(target, addition, 1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(text)
    print("Updated USER_TESTING_BUGS_AND_GLITCHES.txt successfully!")
else:
    print("Target not found in audit text!")

