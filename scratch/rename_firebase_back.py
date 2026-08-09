import os

if os.path.exists('firebase_standalone.exe'):
    print("Restoring firebase_standalone.exe back to firebase.exe")
    os.rename('firebase_standalone.exe', 'firebase.exe')
else:
    print("firebase_standalone.exe not found.")
