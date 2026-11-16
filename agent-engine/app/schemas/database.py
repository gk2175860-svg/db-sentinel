"""Database connection schemas."""
from typing import Any

from pydantic import BaseModel, Field, field_validator


class DatabaseBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: str = Field(min_length=1, max_length=50)
    host: str = Field(default="", max_length=255)
    port: int | None = Field(default=None, gt=0, le=65535)
    database_name: str = Field(min_length=1, max_length=255)
    schema_name: str | None = Field(default=None, max_length=255)
    username: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, max_length=500)
    connection_options: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    description: str | None = Field(default=None, max_length=1000)
    pool_config: dict[str, Any] = Field(default_factory=dict)

    @field_validator("port", mode="before")
    @classmethod
    def validate_port(cls, v):
        if v is not None and (v <= 0 or v > 65535):
            raise ValueError("Port must be between 1 and 65535")
        return v


class DatabaseCreate(DatabaseBase):
    pass


class DatabaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    type: str | None = Field(default=None, min_length=1, max_length=50)
    host: str | None = Field(default=None, max_length=255)
    port: int | None = Field(default=None, gt=0, le=65535)
    database_name: str | None = Field(default=None, min_length=1, max_length=255)
    schema_name: str | None = Field(default=None, max_length=255)
    username: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, max_length=500)
    connection_options: dict[str, Any] | None = None
    tags: list[str] | None = None
    description: str | None = Field(default=None, max_length=1000)
    pool_config: dict[str, Any] | None = None
    is_active: bool | None = None


class DatabaseOut(BaseModel):
    id: str
    name: str
    type: str
    host: str
    port: int | None
    database_name: str
    schema_name: str | None
    username: str | None
    connection_config: dict[str, Any]
    pool_config: dict[str, Any]
    tags: list[str]
    description: str | None
    is_active: bool
    last_tested_at: str | None = None
    last_test_status: str | None = None
    last_test_error: str | None = None
    version: str | None = None
    created_by: str
    created_at: str
    updated_at: str | None = None

    class Config:
        from_attributes = True


class TestResult(BaseModel):
    success: bool
    latency_ms: int | None = None
    version: str | None = None
    error: str | None = None