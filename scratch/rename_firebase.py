import os

if os.path.exists('firebase.exe'):
    print("Renaming firebase.exe to firebase_standalone.exe")
    os.rename('firebase.exe', 'firebase_standalone.exe')
else:
    print("firebase.exe not found or already renamed.")
