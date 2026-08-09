with open('public/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

def extract_keyframes(name):
    idx = content.find(f"@keyframes {name}")
    if idx == -1:
        idx = content.find(f"@keyframes  {name}")
    if idx == -1:
        return None
    start = content.find("{", idx)
    if start == -1:
        return None
    
    count = 1
    end = start + 1
    while count > 0 and end < len(content):
        if content[end] == '{':
            count += 1
        elif content[end] == '}':
            count -= 1
        end += 1
    return content[idx:end]

for name in ['checkmark', 'zoomIn', 'modalPopIn', 'fadeInScaleUp']:
    res = extract_keyframes(name)
    if res:
        print(f"--- Keyframe: {name} ---")
        print(res)
