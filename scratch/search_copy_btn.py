with open('public/elements.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find any occurrences of "copyInviteLink" or similar in elements.js
for i, line in enumerate(content.splitlines(), 1):
    if 'copyinvite' in line.lower() or 'invitelinkinput' in line.lower():
        print(f"{i}: {line.strip()}")
