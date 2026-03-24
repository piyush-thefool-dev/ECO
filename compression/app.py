import tkinter as tk
from tkinter import filedialog, ttk, messagebox
import os

from core.compressor import Compressor
from core.decompressor import Decompressor


class App:

    def __init__(self, root):

        self.root = root
        self.root.title("HuffZip Pro")
        self.root.geometry("420x300")
        self.root.resizable(False, False)

        # Title
        title = tk.Label(
            root,
            text="HuffZip Compression Tool",
            font=("Arial", 18, "bold")
        )
        title.pack(pady=15)

        # Progress bar
        self.progress = ttk.Progressbar(root, length=300)
        self.progress.pack(pady=10)

        # Buttons frame
        frame = tk.Frame(root)
        frame.pack(pady=10)

        # Compress button
        compress_btn = tk.Button(
            frame,
            text="Compress File",
            width=18,
            bg="#4CAF50",
            fg="white",
            command=self.compress
        )
        compress_btn.grid(row=0, column=0, padx=10, pady=5)

        # Decompress button
        decompress_btn = tk.Button(
            frame,
            text="Decompress File",
            width=18,
            bg="#2196F3",
            fg="white",
            command=self.decompress
        )
        decompress_btn.grid(row=0, column=1, padx=10, pady=5)

        # Result label
        self.result = tk.Label(
            root,
            text="",
            font=("Arial", 10)
        )
        self.result.pack(pady=15)

        # Exit button
        exit_btn = tk.Button(
            root,
            text="Exit",
            width=10,
            command=root.quit
        )
        exit_btn.pack(pady=5)

    # -------------------------
    # Compress Function
    # -------------------------

    def compress(self):

        path = filedialog.askopenfilename()

        if not path:
            return

        try:

            self.progress["value"] = 20
            self.root.update()

            output = path + ".hzip"

            comp = Compressor()

            comp.compress_file(path, output)

            self.progress["value"] = 100

            original = os.path.getsize(path)
            compressed = os.path.getsize(output)

            saved = original - compressed

            ratio = compressed / original

            self.result.config(
                text=f"""
Compression Complete

Original Size : {original} bytes
Compressed Size : {compressed} bytes
Saved : {saved} bytes
Ratio : {ratio:.2f}
"""
            )

            messagebox.showinfo("Success", "File compressed successfully")

        except Exception as e:

            messagebox.showerror("Error", str(e))

        finally:

            self.progress["value"] = 0

    # -------------------------
    # Decompress Function
    # -------------------------

    def decompress(self):

        path = filedialog.askopenfilename(
            filetypes=[("HuffZip Archive", "*.hzip")]
        )

        if not path:
            return

        try:

            self.progress["value"] = 30
            self.root.update()

            output = path.replace(".hzip", "_decompressed.txt")

            decomp = Decompressor()

            decomp.decompress_file(path, output)

            self.progress["value"] = 100

            self.result.config(
                text=f"""
Decompression Complete

Output File:
{output}
"""
            )

            messagebox.showinfo("Success", "File decompressed successfully")

        except Exception as e:

            messagebox.showerror("Error", str(e))

        finally:

            self.progress["value"] = 0