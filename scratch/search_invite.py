import re

with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find any occurrences of "invite" or "copy" in the file
matches = []
for i, line in enumerate(content.splitlines(), 1):
    if 'invite' in line.lower() or 'copy' in line.lower():
        matches.append((i, line.strip()))

for line_num, text in matches[:100]:
    print(f"{line_num}: {text}")
