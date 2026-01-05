from typing import Union, Tuple
from ctypes import Array
import numpy as np

""" 

Layers can have inputs as one feature map (i.e. original image) or multiple feature maps 
from intermediate layers. This function converts both kinds of inputs into a batch for consistency.

"""

def as_batch(input: Array) -> Tuple[Array, bool]:
    if input.ndim == 3:
        return input[None, ...], True
    if input.ndim == 4:
        return input, False

""" 

As you are convolving over the feature map, you want the output feature map size to be same as the input. 
This function computes the padding required to achieve this. Stride here is how many pixles you move the filter each time.

"""

def compute_same_padding(H, W, kH, kW, stride):

    out_h = np.ceil(H/stride)
    out_w = np.ceil(W/stride)

    pad_h_total = np.max((out_h - 1)*stride + kH - H, 0)
    pad_w_total = np.max((out_w - 1)*stride + kW - W, 0)

    pad_top = pad_h_total // 2
    pad_bottom = pad_h_total - pad_top

    pad_left = pad_w_total // 2
    pad_right = pad_w_total - pad_left

    return (pad_top, pad_bottom), (pad_left, pad_right)


def apply_padding(input: Array, padding: Tuple[Tuple[int, int], Tuple[int, int]]) -> Array:
    print("hi")
