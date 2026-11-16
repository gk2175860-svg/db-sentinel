"""AI Provider abstraction for LLM interactions."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class AIMessage:
    """A message in the conversation."""
    role: str
    content: str


@dataclass
class AIResponse:
    """Response from an AI provider."""
    content: str
    model: str
    usage: dict[str, int] | None = None
    finish_reason: str | None = None


@dataclass
class AIProviderConfig:
    """Configuration for an AI provider."""
    name: str
    model: str
    base_url: str | None = None
    api_key: str | None = None
    temperature: float = 0.1
    max_tokens: int = 4096
    timeout: int = 60


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    def __init__(self, config: AIProviderConfig):
        self.config = config

    @abstractmethod
    async def complete(self, messages: list[AIMessage], **kwargs) -> AIResponse:
        """Complete a chat conversation."""
        pass

    @abstractmethod
    async def stream(self, messages: list[AIMessage], **kwargs):
        """Stream a chat conversation."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is available."""
        pass


class AIProviderError(Exception):
    """Raised when an AI provider encounters an error."""
    pass


class AIProviderRegistry:
    """Registry for AI providers."""

    def __init__(self):
        self._providers: dict[str, type[AIProvider]] = {}

    def register(self, name: str, provider_class: type[AIProvider]) -> None:
        """Register a provider class."""
        self._providers[name] = provider_class

    def get(self, name: str) -> type[AIProvider]:
        """Get a provider class by name."""
        if name not in self._providers:
            raise AIProviderError(f"Unknown provider: {name}")
        return self._providers[name]

    def create(self, name: str, config: AIProviderConfig) -> AIProvider:
        """Create a provider instance."""
        provider_class = self.get(name)
        return provider_class(config)

    def list_providers(self) -> list[str]:
        """List all registered providers."""
        return list(self._providers.keys())


provider_registry = AIProviderRegistry()