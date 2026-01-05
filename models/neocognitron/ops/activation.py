from ctypes import Array
import numpy as np

def relu(input: Array) -> Array:
    return np.maximum(0.0, input)
    