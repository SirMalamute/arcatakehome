"""The one place that talks to the model provider.

OpenAI Responses API with Structured Outputs (strict JSON schema). Errors are
split into retryable (rate limits, timeouts, 5xx) and permanent ones so the
durable layer knows whether to retry.
"""

import json
from dataclasses import dataclass
from functools import lru_cache

import openai

from backend.config import settings


class PermanentLLMError(Exception):
    """Retrying won't help: refusal, context too long, bad request."""


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0

    def __add__(self, other: "Usage") -> "Usage":
        return Usage(self.input_tokens + other.input_tokens, self.output_tokens + other.output_tokens)


RETRYABLE = (openai.RateLimitError, openai.APITimeoutError, openai.APIConnectionError, openai.InternalServerError)


@lru_cache
def _client() -> openai.OpenAI:
    return openai.OpenAI(api_key=settings().openai_api_key or None, max_retries=0, timeout=180)


def structured_call(
    model: str, system: str, user: str, schema_name: str, json_schema: dict
) -> tuple[dict, Usage]:
    try:
        resp = _client().responses.create(
            model=model,
            instructions=system,
            input=user,
            text={"format": {"type": "json_schema", "name": schema_name, "schema": json_schema, "strict": True}},
        )
    except RETRYABLE:
        raise
    except openai.BadRequestError as e:
        if "context" in str(e).lower() and ("length" in str(e).lower() or "window" in str(e).lower()):
            raise PermanentLLMError("document too large")
        raise PermanentLLMError(f"bad request: {e.message}")

    usage = Usage(resp.usage.input_tokens, resp.usage.output_tokens) if resp.usage else Usage()

    for item in resp.output:
        if item.type == "message":
            for content in item.content:
                if content.type == "refusal":
                    raise PermanentLLMError(f"model refused: {content.refusal}")
    if resp.status == "incomplete":
        reason = resp.incomplete_details.reason if resp.incomplete_details else "unknown"
        raise PermanentLLMError(f"incomplete response: {reason}")

    return json.loads(resp.output_text), usage
