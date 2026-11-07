with open("USER_TESTING_BUGS_AND_GLITCHES.txt", "r", encoding="utf-8") as f:
    text = f.read()

old_s = "3. [FIXED] Telemetry Activity Waveform Graph Malfunctions:"
new_s = """3. [FIXED] Pre-Workspace Authentication Gate (Red-Themed Login with GitHub & Google):
   - Behavior: Previously, clicking "Control Plane", "Dashboard ->", or "Sign in" on the landing page bypassed authentication or took the user directly into the dashboard without an auth checkpoint.
   - Status: Fixed. Created a dedicated `/login` page matching the landing page's signature red theme:
     * Glowing crimson aura (#cc0000) and dark glassmorphic card with red border glow.
     * "Continue with GitHub" 1-click button with octocat icon.
     * "Continue with Google" 1-click button with official multicolor G logo.
     * Custom developer handle / PAT access token input.
     * Integrated session persistence (agentforge_github_user) and backend sync (/v1/auth/sync).
     * Automatically redirects to the intended destination (e.g. /dashboard or /analytics) once authenticated.
     * Top landing page buttons ("Control Plane", "Dashboard", "Sign in", "Open Control Plane") now dynamically check login status and route unauthenticated users through this gate.

4. [FIXED] Telemetry Activity Waveform Graph Malfunctions:"""

if old_s in text:
    text = text.replace(old_s, new_s, 1)
    with open("USER_TESTING_BUGS_AND_GLITCHES.txt", "w", encoding="utf-8") as f:
        f.write(text)
    print("Updated text file successfully")

