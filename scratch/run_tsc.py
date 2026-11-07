import subprocess

result = subprocess.run(["npx", "tsc", "--noEmit", "-p", "apps/web/tsconfig.json"], capture_output=True, text=True, shell=True)
print("Return code:", result.returncode)
print("STDOUT:\n", result.stdout)
print("STDERR:\n", result.stderr)

