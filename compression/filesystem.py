import os

def scan_folder(folder):

    files = []

    for root, dirs, filenames in os.walk(folder):

        for f in filenames:

            files.append(os.path.join(root, f))

    return files