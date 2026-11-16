"""Authentication schemas."""
from pydantic import BaseModel, EmailStr, Field


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str | None
    roles: list[str]
    is_active: bool
    last_login_at: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class RefreshRequest(BaseModel):
    refresh_token: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str | None = Field(default=None, max_length=255)


# User Management (Admin)
class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str | None = Field(default=None, max_length=255)
    roles: list[str] = Field(default_factory=list)
    is_active: bool = True


class UserUpdateRequest(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, max_length=255)
    roles: list[str] | None = None
    is_active: bool | None = None


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
    page: int
    page_size: int


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)

# Role Management
class RoleResponse(BaseModel):
    id: str
    name: str
    description: str | None
    is_system: bool

class RoleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)

class RoleUpdateRequest(BaseModel):
    description: str | None = Field(default=None, max_length=255)

class PermissionResponse(BaseModel):
    id: str
    name: str
    resource: str
    action: str
    description: str | None