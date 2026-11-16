"""APP_FLOW §4.1 error-shape tests: validation, unmatched route, unhandled exception."""
import httpx
import pytest
from pydantic import BaseModel

from app.main import create_app


class ProbeBody(BaseModel):
    name: str


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


def register_probe_route(app):
    async def probe(body: ProbeBody) -> dict:
        return {"name": body.name}

    app.add_api_route("/__probe", probe, methods=["POST"])


@pytest.mark.asyncio
async def test_validation_error_returns_400_section_41_shape(app, client):
    register_probe_route(app)
    resp = await client.post("/__probe", json={"unexpected": 1})
    assert resp.status_code == 400
    body = resp.json()
    assert set(body.keys()) == {"error"}
    error = body["error"]
    assert set(error.keys()) == {"code", "message", "details"}
    assert error["code"] == "VALIDATION_ERROR"
    assert isinstance(error["message"], str)
    assert error["message"]
    assert error["details"][0]["loc"] == ["body", "name"]
    assert error["details"][0]["msg"] == "Field required"


@pytest.mark.asyncio
async def test_malformed_json_body_returns_400_section_41_shape(app, client):
    register_probe_route(app)
    resp = await client.post(
        "/__probe", content=b"{not json", headers={"content-type": "application/json"}
    )
    assert resp.status_code == 400
    error = resp.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert isinstance(error["message"], str)
    assert error["details"][0]["type"] == "json_invalid"


@pytest.mark.asyncio
async def test_unmatched_route_returns_404_section_41_shape(client):
    resp = await client.get("/api/v1/nope")
    assert resp.status_code == 404
    assert resp.json() == {
        "error": {"code": "NOT_FOUND", "message": "Not Found", "details": []}
    }


@pytest.mark.asyncio
async def test_unhandled_exception_returns_500_section_41_shape(app):
    def boom() -> dict:
        raise ValueError("boom")

    app.add_api_route("/__boom", boom, methods=["GET"])
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        resp = await c.get("/__boom")
    assert resp.status_code == 500
    assert resp.json() == {
        "error": {"code": "INTERNAL_ERROR", "message": "Internal server error", "details": []}
    }
