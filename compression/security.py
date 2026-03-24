import hashlib

def hash_password(password):

    return hashlib.sha256(password.encode()).hexdigest()


def verify(password, stored):

    return hash_password(password) == stored