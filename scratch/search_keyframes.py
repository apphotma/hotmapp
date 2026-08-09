with open('public/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find any occurrences of "@keyframes" in style.css
import re
matches = re.findall(r'@keyframes\s+\w+', content)
print("Keyframes found:", matches)
