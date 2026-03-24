import heapq
from collections import Counter

class Node:

    def __init__(self, char=None, freq=0):
        self.char = char
        self.freq = freq
        self.left = None
        self.right = None

    def __lt__(self, other):
        return self.freq < other.freq


class HuffmanTree:

    def build(self, data):

        freq = Counter(data)

        heap = []

        for char, f in freq.items():
            heapq.heappush(heap, Node(char, f))

        while len(heap) > 1:

            n1 = heapq.heappop(heap)
            n2 = heapq.heappop(heap)

            merged = Node(None, n1.freq + n2.freq)
            merged.left = n1
            merged.right = n2

            heapq.heappush(heap, merged)

        return heap[0]


    def generate_codes(self, root):

        codes = {}

        def traverse(node, code):

            if node is None:
                return

            if node.char is not None:
                codes[node.char] = code
                return

            traverse(node.left, code + "0")
            traverse(node.right, code + "1")

        traverse(root, "")

        return codes