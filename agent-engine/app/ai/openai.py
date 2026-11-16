"""OpenAI AI provider implementation."""
from typing import Any

import httpx

from app.ai.provider import AIMessage, AIProvider, AIProviderConfig, AIResponse, AIProviderError


class OpenAIProvider(AIProvider):
    """OpenAI API provider."""

    def __init__(self, config: AIProviderConfig):
        super().__init__(config)
        self.base_url = config.base_url or "https://api.openai.com/v1"
        self.api_key = config.api_key
        if not self.api_key:
            raise AIProviderError("OpenAI API key is required")
        self.client = httpx.AsyncClient(
            timeout=config.timeout,
            headers={"Authorization": f"Bearer {self.api_key}"},
        )

    async def complete(self, messages: list[AIMessage], **kwargs) -> AIResponse:
        """Complete a chat conversation using OpenAI."""
        payload = {
            "model": self.config.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": kwargs.get("temperature", self.config.temperature),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "stream": False,
        }

        try:
            response = await self.client.post(
                f"{self.base_url}/chat/completions",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            choice = data["choices"][0]
            return AIResponse(
                content=choice["message"]["content"],
                model=data.get("model", self.config.model),
                usage=data.get("usage"),
                finish_reason=choice.get("finish_reason"),
            )
        except httpx.HTTPStatusError as e:
            raise AIProviderError(f"OpenAI API error: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            raise AIProviderError(f"OpenAI connection error: {e}")

    async def stream(self, messages: list[AIMessage], **kwargs):
        """Stream a chat conversation using OpenAI."""
        payload = {
            "model": self.config.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": kwargs.get("temperature", self.config.temperature),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "stream": True,
        }

        try:
            async with self.client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if data["choices"] and "delta" in data["choices"][0]:
                                delta = data["choices"][0]["delta"]
                                if "content" in delta:
                                    yield delta["content"]
                        except json.JSONDecodeError:
                            pass
        except httpx.HTTPStatusError as e:
            raise AIProviderError(f"OpenAI API error: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            raise AIProviderError(f"OpenAI connection error: {e}")

    async def health_check(self) -> bool:
        """Check if OpenAI is available."""
        try:
            response = await self.client.get(f"{self.base_url}/models")
            return response.status_code == 200
        except Exception:
            return False

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


import json
from app.ai.provider import provider_registry
provider_registry.register("openai", OpenAIProvider)