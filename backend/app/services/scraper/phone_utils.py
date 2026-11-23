"""Normalize and validate phone numbers from scraped HTML."""

import re
from urllib.parse import unquote

# Must start with + or 00 (international) — avoids random page numbers
INTL_PHONE_RE = re.compile(
    r"(?:\+|00)[\d][\d\s().\-]{7,22}\d",
    re.MULTILINE,
)
# Pakistan mobile
PK_MOBILE_RE = re.compile(r"(?:\+92[\s\-]?|0)3\d{2}[\s\-]?\d{7}")


def _digits_only(value: str) -> str:
    return re.sub(r"\D", "", value)


def _is_junk_raw(raw: str) -> bool:
    s = unquote(raw).strip()
    if not s or "%" in s and not re.search(r"\d", s):
        return True
    if s.startswith("-") and not s.lstrip("-").startswith("+"):
        return True
    # Ranges: "76 - 100", "501 - 750", "10 - 15"
    if re.search(r"\d{1,4}\s*-\s*\d{1,4}", s):
        return True
    # Repeated blocks: "1216 1216", "1212 1212"
    if re.search(r"\b(\d{3,4})\s+\1\b", s):
        return True
    # Many short number chunks (layout/CSS garbage)
    chunks = re.findall(r"\d+", s)
    if len(chunks) >= 4 and sum(1 for c in chunks if len(c) <= 4) >= 3:
        return True
    return False


def _is_valid_digits(digits: str) -> bool:
    if not (10 <= len(digits) <= 15):
        return False
    if len(set(digits)) <= 2:
        return False
    # Obvious non-phone long sequences from sliders/stats
    if re.fullmatch(r"(12\d{2})+", digits[:8]):
        return False
    return True


def format_phone_display(digits: str, international: bool) -> str:
    """Human-readable international format."""
    if international:
        if digits.startswith("92") and len(digits) >= 12:
            # +92 3XX XXXXXXX
            return f"+92 {digits[2:5]} {digits[5:]}"
        if digits.startswith("971") and len(digits) >= 11:
            return f"+971 {digits[3:5]} {digits[5:8]} {digits[8:]}"
        if digits.startswith("1") and len(digits) == 11:
            return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
        if digits.startswith("44") and len(digits) >= 12:
            return f"+44 {digits[2:6]} {digits[6:]}"
        if digits.startswith("49") and len(digits) >= 11:
            return f"+49 {digits[2:5]} {digits[5:8]} {digits[8:]}"
        if digits.startswith("60") and len(digits) >= 11:
            return f"+60 {digits[2:4]} {digits[4:7]} {digits[7:]}"
        if digits.startswith("880") and len(digits) >= 12:
            return f"+880 {digits[3:5]} {digits[5:8]} {digits[8:]}"
        # Generic E.164 grouping
        cc_len = 3 if digits.startswith(("971", "880", "923")) else 2
        if len(digits) > cc_len + 8:
            cc_len = 3
        elif len(digits) > 10:
            cc_len = 2
        else:
            cc_len = 1
        rest = digits[cc_len:]
        parts = [rest[i : i + 3] for i in range(0, len(rest), 3)]
        return f"+{digits[:cc_len]} " + " ".join(parts)
    # Local 10–11 digit
    if len(digits) == 10:
        return f"{digits[:4]} {digits[4:7]} {digits[7:]}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"{digits[:4]} {digits[4:7]} {digits[7:]}"
    return digits


def normalize_phone(raw: str) -> str | None:
    if _is_junk_raw(raw):
        return None

    s = unquote(raw).strip()
    international = s.startswith("+") or s.startswith("00")
    if s.lower().startswith("tel:"):
        s = s[4:].split("?")[0].strip()
        international = True

    digits = _digits_only(s)
    if s.startswith("00") and len(digits) > 10:
        digits = digits[2:]
        international = True

    if not _is_valid_digits(digits):
        return None

    return format_phone_display(digits, international)


def filter_and_format_phones(phones: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in phones:
        formatted = normalize_phone(raw)
        if not formatted:
            continue
        key = _digits_only(formatted)
        if key in seen:
            continue
        seen.add(key)
        out.append(formatted)
    return out[:10]


def extract_phone_candidates_from_text(text: str) -> list[str]:
    found: list[str] = []
    for m in INTL_PHONE_RE.finditer(text):
        found.append(m.group(0))
    for m in PK_MOBILE_RE.finditer(text):
        found.append(m.group(0))
    return found
