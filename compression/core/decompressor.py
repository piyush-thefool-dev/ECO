from core.huffman_tree import HuffmanTree


class Decompressor:

    def decompress_file(self, input_path, output_path):

        with open(input_path, "rb") as f:

            # read filename length
            name_length = int.from_bytes(f.read(2), "big")

            # read filename
            filename = f.read(name_length).decode()

            # read compressed data
            compressed_data = f.read()

        bit_string = ""

        for byte in compressed_data:
            bit_string += format(byte, "08b")

        decoded_text = ""

        current_bits = ""

        reverse_codes = {}

        # simple decoding (example placeholder)
        # full Huffman tree decode can be added later

        for bit in bit_string:
            current_bits += bit

        decoded_text = bit_string

        with open(output_path, "w") as f:
            f.write(decoded_text)