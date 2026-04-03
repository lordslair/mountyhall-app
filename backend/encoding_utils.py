"""Decode HTTP bodies as UTF-8.

If ``Content-Type`` omits charset or declares Latin-1 while the bytes are UTF-8,
``requests`` mis-decodes and strings show mojibake (e.g. *é* as *Ã©*).

Some upstream APIs (e.g. Raistlin mz_json) return JSON whose *string values* are
already mojibake: UTF-8 bytes were misread as Latin-1 before being embedded in
JSON. Those can be repaired with :func:`fix_mojibake_utf8`.
"""

import json
from typing import Any


def fix_mojibake_utf8(s: str) -> str:
    """Repair a string where UTF-8 was misinterpreted as Latin-1 (e.g. *BlÃ©ro* → *Bléro*)."""
    if not s:
        return s
    try:
        return s.encode('latin-1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        return s


def deep_fix_mojibake_utf8(obj: Any) -> Any:
    """Apply :func:`fix_mojibake_utf8` to every str in nested dict/list structures."""
    if isinstance(obj, str):
        return fix_mojibake_utf8(obj)
    if isinstance(obj, list):
        return [deep_fix_mojibake_utf8(x) for x in obj]
    if isinstance(obj, dict):
        return {k: deep_fix_mojibake_utf8(v) for k, v in obj.items()}
    return obj


def json_utf8(response) -> Any:
    """Parse JSON from raw body bytes as UTF-8 (RFC 8259 default encoding)."""
    return json.loads(response.content.decode('utf-8'))


def text_utf8(response) -> str:
    """Decode HTML/text body as UTF-8."""
    return response.content.decode('utf-8')
