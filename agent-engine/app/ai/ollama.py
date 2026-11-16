"""Ollama AI provider implementation."""
import json
from typing import Any

import httpx

from app.ai.provider import AIMessage, AIProvider, AIProviderConfig, AIResponse, AIProviderError


class OllamaProvider(AIProvider):
    """Ollama local LLM provider."""

    def __init__(self, config: AIProviderConfig):
        super().__init__(config)
        self.base_url = config.base_url or "http://localhost:11434"
        self.client = httpx.AsyncClient(timeout=config.timeout)

    async def complete(self, messages: list[AIMessage], **kwargs) -> AIResponse:
        """Complete a chat conversation using Ollama."""
        payload = {
            "model": self.config.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": False,
            "options": {
                "temperature": kwargs.get("temperature", self.config.temperature),
                "num_predict": kwargs.get("max_tokens", self.config.max_tokens),
            },
        }

        try:
            response = await self.client.post(
                f"{self.base_url}/api/chat",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            return AIResponse(
                content=data["message"]["content"],
                model=data.get("model", self.config.model),
                usage={
                    "prompt_tokens": data.get("prompt_eval_count", 0),
                    "completion_tokens": data.get("eval_count", 0),
                    "total_tokens": data.get("prompt_eval_count", 0) + data.get("eval_count", 0),
                },
                finish_reason=data.get("done_reason"),
            )
        except httpx.HTTPStatusError as e:
            raise AIProviderError(f"Ollama API error: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            raise AIProviderError(f"Ollama connection error: {e}")

    async def stream(self, messages: list[AIMessage], **kwargs):
        """Stream a chat conversation using Ollama."""
        payload = {
            "model": self.config.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": True,
            "options": {
                "temperature": kwargs.get("temperature", self.config.temperature),
                "num_predict": kwargs.get("max_tokens", self.config.max_tokens),
            },
        }

        try:
            async with self.client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]
                        if data.get("done"):
                            break
        except httpx.HTTPStatusError as e:
            raise AIProviderError(f"Ollama API error: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            raise AIProviderError(f"Ollama connection error: {e}")

    async def health_check(self) -> bool:
        """Check if Ollama is available."""
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            return response.status_code == 200
        except Exception:
            return False

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


from app.ai.provider import provider_registry
provider_registry.register("ollama", OllamaProvider)