import os

public_dir = 'public'
old_v = 'v=1.1.8'
new_v = 'v=1.1.9'

for root, dirs, files in os.walk(public_dir):
    for file in files:
        if file.endswith('.js') or file.endswith('.html'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            if old_v in content:
                print(f"Bumping version in {filepath}")
                updated = content.replace(old_v, new_v)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(updated)
