"""File bytes → list of page strings."""

import pymupdf

TEXT_PAGE_CHARS = 3000
SUPPORTED_EXTS = {"pdf", "txt", "md"}


class ParseError(ValueError):
    pass


def file_ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def parse(filename: str, data: bytes) -> list[str]:
    ext = file_ext(filename)
    if ext not in SUPPORTED_EXTS:
        raise ParseError(f"unsupported file type '.{ext}' (allowed: pdf, txt, md)")
    pages = _parse_pdf(data) if ext == "pdf" else _split_text(data.decode("utf-8", errors="replace"))
    if not any(p.strip() for p in pages):
        raise ParseError("scanned PDF, not supported" if ext == "pdf" else "file is empty")
    return pages


def _parse_pdf(data: bytes) -> list[str]:
    try:
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            return [page.get_text() for page in doc]
    except (pymupdf.FileDataError, RuntimeError) as e:
        raise ParseError(f"could not read PDF: {e}")


def _split_text(text: str) -> list[str]:
    """Split into ~TEXT_PAGE_CHARS pages on paragraph boundaries."""
    pages, current = [], ""
    for para in text.split("\n\n"):
        if current and len(current) + len(para) + 2 > TEXT_PAGE_CHARS:
            pages.append(current)
            current = para
        else:
            current = f"{current}\n\n{para}" if current else para
    if current:
        pages.append(current)
    return pages or [""]
