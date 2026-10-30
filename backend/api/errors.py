from fastapi import HTTPException


def not_found(what: str) -> HTTPException:
    return HTTPException(404, f"{what} not found")
