import argparse
from core.compressor import Compressor

def main():

    parser = argparse.ArgumentParser()

    parser.add_argument("-c", "--compress")

    parser.add_argument("-o", "--output")

    args = parser.parse_args()

    comp = Compressor()

    comp.compress_file(args.compress, args.output)


if __name__ == "__main__":
    main()