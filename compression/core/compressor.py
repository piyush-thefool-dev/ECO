from .huffman_tree import HuffmanTree
from .bitstream import BitWriter

class Compressor:

   def compress_file(self, input_path, output_path):

    with open(input_path, "r") as f:
        data = f.read()

    tree = HuffmanTree()

    root = tree.build(data)

    codes = tree.generate_codes(root)

    writer = BitWriter()

    for char in data:
        writer.write_bits(codes[char])

    compressed_data = writer.flush()

    with open(output_path, "wb") as f:

        # store file name in archive
        filename = input_path.encode()

        f.write(len(filename).to_bytes(2, "big"))
        f.write(filename)

        # write compressed data
        f.write(bytes(compressed_data))

    return codes