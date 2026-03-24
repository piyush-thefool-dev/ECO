class BitWriter:

    def __init__(self):
        self.buffer = 0
        self.bits = 0
        self.data = bytearray()

    def write_bit(self, bit):

        self.buffer = (self.buffer << 1) | bit
        self.bits += 1

        if self.bits == 8:
            self.data.append(self.buffer)
            self.buffer = 0
            self.bits = 0

    def write_bits(self, bit_string):

        for b in bit_string:
            self.write_bit(int(b))

    def flush(self):

        if self.bits > 0:
            self.buffer <<= (8 - self.bits)
            self.data.append(self.buffer)

        return self.data