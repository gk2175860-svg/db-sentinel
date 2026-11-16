"""AI Provider package."""
from app.ai.provider import (
    AIMessage,
    AIProvider,
    AIProviderConfig,
    AIResponse,
    AIProviderError,
    provider_registry,
)
from app.ai.router import AIRouter, ai_router

# Import providers to register them
import app.ai.ollama
import app.ai.openai

__all__ = [
    "AIMessage",
    "AIProvider",
    "AIProviderConfig",
    "AIResponse",
    "AIProviderError",
    "provider_registry",
    "AIRouter",
    "ai_router",
]