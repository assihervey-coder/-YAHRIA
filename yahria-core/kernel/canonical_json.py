# ═══════════════════════════════════════════════════════════════
# YAHRIA KERNEL (Python port) — Canonical JSON (JS-compatible)
# Doc ID: YAHRIA-KRN-000-PY | Port of: src/lib/yahria (TS)
#
# R7.1 parity layer (INV-191 Deterministic Control): the TS kernel
# hashes payloads with JavaScript JSON.stringify. This module
# reproduces that exact serialization in Python so SHA-256 digests
# are byte-identical across runtimes.
#
# Known divergences (explicitly recognized, INV-191):
#   - lone surrogates (invalid in UTF-8) are not reproducible
#   - payloads MUST NOT contain NaN/Infinity (TS would emit null;
#     this port emits null as well, but such payloads are rejected
#     upstream by evidence validation)
# ═══════════════════════════════════════════════════════════════

import json
from fractions import Fraction


def js_stringify(obj) -> str:
    """Serialize like JavaScript JSON.stringify (no spaces, insertion order)."""
    if obj is None:
        return "null"
    if obj is True:
        return "true"
    if obj is False:
        return "false"
    if isinstance(obj, int):
        return str(obj)
    if isinstance(obj, float):
        if obj != obj or obj in (float("inf"), float("-inf")):
            return "null"
        if obj == int(obj) and abs(obj) < 1e21:
            return str(int(obj))
        return repr(obj)
    if isinstance(obj, str):
        # json.dumps escaping (\", \\, \n, \r, \t, \b, \f, \uXXXX control)
        # matches JS JSON.stringify for valid UTF-8 strings, raw non-ASCII.
        return json.dumps(obj, ensure_ascii=False)
    if isinstance(obj, dict):
        items = ",".join(
            js_stringify(str(k)) + ":" + js_stringify(v) for k, v in obj.items()
        )
        return "{" + items + "}"
    if isinstance(obj, (list, tuple)):
        return "[" + ",".join(js_stringify(v) for v in obj) + "]"
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON-serializable")


def js_fixed(x: float, digits: int = 2) -> str:
    """Emulate JavaScript Number.prototype.toFixed(digits).

    Spec semantics (ECMA-262 Number::toFixed): pick integer n such that
    n / 10**d is closest to x; on exact tie pick the LARGER n.
    Operates on the exact binary value of the double (Fraction(float)).
    """
    scaled = Fraction(x) * (10 ** digits)
    n_floor = scaled.numerator // scaled.denominator  # floor division
    diff = scaled - n_floor
    if diff > Fraction(1, 2):
        n = n_floor + 1
    elif diff < Fraction(1, 2):
        n = n_floor
    else:
        n = n_floor + 1  # exact tie -> larger n
    sign = "-" if n < 0 else ""
    n = abs(n)
    if digits == 0:
        return sign + str(n)
    s = str(n).rjust(digits + 1, "0")
    return sign + s[:-digits] + "." + s[-digits:]
