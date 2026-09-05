with open('public/style.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

import re
matches = []
for i, line in enumerate(lines, 1):
    if re.search(r'color:\s*(?:#0f1111|#111b21|#232f30|#0f111|#1a1a1a|#222|#333|black\b)', line):
        # find selector
        sel = ""
        for j in range(i-1, -1, -1):
            if '{' in lines[j]:
                sel = lines[j].strip()
                break
        matches.append((i, line.strip(), sel))

for i, l, s in matches:
    print(f"L{i}: {l}  [in {s}]")
