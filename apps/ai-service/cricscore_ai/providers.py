"""LLM / embedding / prediction provider interfaces and OpenAI-compatible
implementations (stdlib only). These calls can incur provider charges."""
from __future__ import annotations

import json
import os
import urllib.request
from typing import Any, Protocol


class ProviderError(Exception):
    pass


class LLM(Protocol):
    def complete(self, system: str, messages: list[dict[str, str]]) -> str:
        """Generate LLM completion."""
        raise NotImplementedError


class Embedder(Protocol):
    def embed(self, text: str) -> list[float]:
        """Generate text embedding vector."""
        raise NotImplementedError


class Predictor(Protocol):
    def predict(self, features: dict[str, Any]) -> dict[str, Any]:
        """Predict match outcome probabilities."""
        raise NotImplementedError


def _post(url: str, key: str, payload: dict, timeout: float) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "X-Title": "CricScore"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # nosec B310 - https base URL from config
            return json.loads(resp.read())
    except Exception as exc:
        raise ProviderError("provider request failed") from exc


class _OpenAICompat:
    def __init__(self):
        self.key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY") or ""
        self.base = (os.environ.get("LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
        if not self.key:
            raise ProviderError("LLM key not configured")


class OpenAICompatLLM(_OpenAICompat):
    def __init__(self, model: str | None = None, timeout: float = 15.0):
        super().__init__()
        self.model = model or os.environ.get("LLM_MODEL") or "gpt-4o-mini"
        self.timeout = timeout

    def complete(self, system, messages):
        data = _post(
            f"{self.base}/chat/completions",
            self.key,
            {
                "model": self.model,
                "messages": [{"role": "system", "content": system}, *messages],
                "temperature": 0.2,
                "max_tokens": 1000,
            },
            self.timeout,
        )
        try:
            return data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("malformed provider response") from exc


class OpenAICompatEmbedder(_OpenAICompat):
    def __init__(self, timeout: float = 10.0):
        super().__init__()
        self.model = os.environ.get("EMBEDDING_MODEL") or "text-embedding-3-small"
        self.timeout = timeout

    def embed(self, text):
        data = _post(f"{self.base}/embeddings", self.key, {"model": self.model, "input": text}, self.timeout)
        try:
            vec = data["data"][0]["embedding"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("malformed embedding response") from exc
        if len(vec) != 1536:
            raise ProviderError("unexpected embedding dimension")
        return vec


class LambdaPredictor:
    """Calls the existing, approved `<project>-ml-predict` Lambda. No fallback model."""

    def __init__(self, function_name: str | None = None):
        self.function_name = function_name or os.environ.get("ML_PREDICT_FUNCTION")
        if not self.function_name:
            raise ProviderError("prediction function not configured")

    def predict(self, features):
        import boto3

        try:
            resp = boto3.client("lambda").invoke(
                FunctionName=self.function_name,
                InvocationType="RequestResponse",
                Payload=json.dumps({"body": json.dumps(features)}).encode(),
            )
            out = json.loads(resp["Payload"].read())
            if out.get("statusCode") != 200:
                raise ProviderError("prediction rejected")
            return json.loads(out["body"])
        except ProviderError:
            raise
        except Exception as exc:
            raise ProviderError("prediction unavailable") from exc
