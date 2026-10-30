"""Check that each quote actually appears in the document.

The model reads the same parsed page text we match against, so a fuzzy match
absorbs whitespace/hyphenation/ligature noise while a paraphrase still fails.
Matching runs on normalized text, but every normalized character remembers its
position in the original page, so the match maps back to exact offsets for
highlighting.
"""

import unicodedata

from rapidfuzz import fuzz

THRESHOLD = 90

_CHAR_MAP = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"'} | {
    chr(c): "-" for c in range(0x2010, 0x2016)  # unicode dashes
})


def _is_line_break_hyphen(s: str, i: int) -> bool:
    """A '-' between word characters whose following whitespace contains a newline."""
    if s[i] != "-" or i == 0 or not s[i - 1].isalnum():
        return False
    j = i + 1
    while j < len(s) and s[j].isspace():
        j += 1
    return "\n" in s[i + 1 : j] and j < len(s) and s[j].isalnum()


def norm_with_map(s: str) -> tuple[str, list[int]]:
    """Normalize (NFKC, lowercase, unify quotes/dashes, rejoin hyphenated line
    breaks, collapse whitespace) and return, for each output char, its index in `s`."""
    out: list[str] = []
    index: list[int] = []
    i = 0
    while i < len(s):
        if _is_line_break_hyphen(s, i):
            i += 1
            while s[i].isspace():
                i += 1
            continue
        c = s[i]
        if c.isspace():
            if out and out[-1] != " ":
                out.append(" ")
                index.append(i)
        else:
            for nc in unicodedata.normalize("NFKC", c).lower().translate(_CHAR_MAP):
                out.append(nc)
                index.append(i)
        i += 1
    while out and out[-1] == " ":
        out.pop()
        index.pop()
    return "".join(out), index


def norm(s: str) -> str:
    return norm_with_map(s)[0]


def verify(quote: str, pages: list[str]) -> dict:
    """Best-matching page for the quote, with character offsets into that page's original text.

    Corrects the page number if the model was off.
    """
    q = norm(quote)
    if not q:
        return {"verified": False, "page": None, "score": 0.0, "start": None, "end": None}
    best = None
    for page_no, text in enumerate(pages, start=1):
        normed, index = norm_with_map(text)
        if not normed:
            continue
        a = fuzz.partial_ratio_alignment(q, normed)
        if a is not None and (best is None or a.score > best[0].score):
            best = (a, page_no, index)
    if best is None:
        return {"verified": False, "page": None, "score": 0.0, "start": None, "end": None}
    a, page_no, index = best
    start, end = (index[a.dest_start], index[a.dest_end - 1] + 1) if a.dest_end > a.dest_start else (None, None)
    return {"verified": a.score >= THRESHOLD, "page": page_no, "score": round(a.score, 1), "start": start, "end": end}
