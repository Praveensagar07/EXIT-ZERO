import os
import re

SECRET_PATTERNS = [
    re.compile(r'(api[_-]?key|secret|token|password|auth[_-]?token)\s*[:=]\s*["\'][A-Za-z0-9_\-]{8,}["\']', re.I),
    re.compile(r'ghp_[a-zA-Z0-9]{36}'),
    re.compile(r'AIza[0-9A-Za-z\-_]{35}'),
]

IGNORE_DIRS = {'.venv', 'node_modules', '.git', 'dist', '.pytest_cache', '__pycache__', 'evidence_screenshots'}

def scan():
    findings = []
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            filepath = os.path.join(root, f)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as handle:
                    content = handle.read()
                    for pattern in SECRET_PATTERNS:
                        matches = pattern.findall(content)
                        if matches:
                            findings.append((filepath, matches))
            except Exception as e:
                print(f"Error reading {filepath}: {e}")
    print(f"Total potential secret matches: {len(findings)}")
    for file, match in findings:
        print(f"  {file}: {match}")

if __name__ == '__main__':
    scan()
