"""
Rate limiter instance for the API.
Single-instance in-memory (no Redis needed for MVP).
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
