"""Smart AI Router for provider selection and fallback."""
from typing import Any

from app.ai.provider import (
    AIMessage,
    AIProvider,
    AIProviderConfig,
    AIResponse,
    AIProviderError,
    provider_registry,
)
from app.config import get_settings


class AIRouter:
    """Routes requests to appropriate AI providers with fallback logic."""

    def __init__(self):
        self.settings = get_settings()
        self._providers: dict[str, AIProvider] = {}
        self._cost_tracker: dict[str, float] = {}

    def _get_provider_config(self, provider_name: str) -> AIProviderConfig | None:
        """Get provider configuration from settings."""
        if provider_name == "ollama":
            return AIProviderConfig(
                name="ollama",
                model=self.settings.ollama_default_model,
                base_url=self.settings.ollama_base_url,
                temperature=0.1,
            )
        elif provider_name == "openai":
            return AIProviderConfig(
                name="openai",
                model="gpt-4o-mini",
                api_key=self.settings.openai_api_key,
                temperature=0.1,
            )
        elif provider_name == "anthropic":
            return AIProviderConfig(
                name="anthropic",
                model="claude-3-haiku-20240307",
                api_key=self.settings.anthropic_api_key,
                temperature=0.1,
            )
        return None

    def _get_provider(self, provider_name: str) -> AIProvider | None:
        """Get or create a provider instance."""
        if provider_name in self._providers:
            return self._providers[provider_name]

        config = self._get_provider_config(provider_name)
        if not config:
            return None

        try:
            provider_class = provider_registry.get(provider_name)
            provider = provider_class(config)
            self._providers[provider_name] = provider
            return provider
        except AIProviderError:
            return None

    def _get_provider_order(self) -> list[str]:
        """Get ordered list of providers to try."""
        if self.settings.ai_prefer_local:
            return ["ollama", "openai", "anthropic"]
        return ["openai", "anthropic", "ollama"]

    async def complete(self, messages: list[AIMessage], **kwargs) -> AIResponse:
        """Complete with fallback logic."""
        last_error = None

        for provider_name in self._get_provider_order():
            provider = self._get_provider(provider_name)
            if not provider:
                continue

            if not await provider.health_check():
                continue

            try:
                response = await provider.complete(messages, **kwargs)
                self._track_cost(provider_name, response)
                return response
            except AIProviderError as e:
                last_error = e
                continue

        raise AIProviderError(f"All providers failed. Last error: {last_error}")

    async def stream(self, messages: list[AIMessage], **kwargs):
        """Stream with fallback logic."""
        for provider_name in self._get_provider_order():
            provider = self._get_provider(provider_name)
            if not provider:
                continue

            if not await provider.health_check():
                continue

            try:
                async for chunk in provider.stream(messages, **kwargs):
                    yield chunk
                return
            except AIProviderError:
                continue

        raise AIProviderError("All providers failed for streaming")

    def _track_cost(self, provider: str, response: AIResponse) -> None:
        """Track API costs."""
        if provider == "ollama":
            return  # Local is free

        usage = response.usage or {}
        if provider == "openai":
            # GPT-4o-mini pricing (approximate)
            input_cost = usage.get("prompt_tokens", 0) * 0.00015 / 1000
            output_cost = usage.get("completion_tokens", 0) * 0.0006 / 1000
            cost = input_cost + output_cost
        elif provider == "anthropic":
            # Claude Haiku pricing (approximate)
            input_cost = usage.get("prompt_tokens", 0) * 0.00025 / 1000
            output_cost = usage.get("completion_tokens", 0) * 0.00125 / 1000
            cost = input_cost + output_cost
        else:
            cost = 0

        self._cost_tracker[provider] = self._cost_tracker.get(provider, 0) + cost

    def get_cost_summary(self) -> dict[str, float]:
        """Get cost summary by provider."""
        return dict(self._cost_tracker)

    def check_budget(self) -> bool:
        """Check if daily budget is exceeded."""
        total_cost = sum(self._cost_tracker.values())
        return total_cost < self.settings.ai_cost_limit_per_day

    async def close(self):
        """Close all provider connections."""
        for provider in self._providers.values():
            if hasattr(provider, "close"):
                await provider.close()


# Global router instance
ai_router = AIRouter()