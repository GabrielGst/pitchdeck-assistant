import time

import httpx
import jwt as pyjwt

# Simple in-memory JWKS cache — keyed by issuer URL
_cache: dict[str, dict] = {}
JWKS_TTL = 3600  # 1 hour


async def _get_jwks(iss: str) -> list[dict]:
    now = time.monotonic()
    cached = _cache.get(iss)
    if cached and now - cached["fetched_at"] < JWKS_TTL:
        return cached["keys"]  # type: ignore[return-value]

    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(f"{iss}/.well-known/jwks.json")
        resp.raise_for_status()
        keys = resp.json()["keys"]

    _cache[iss] = {"keys": keys, "fetched_at": now}
    return keys


async def verify_clerk_token(token: str) -> str:
    """Verify a Clerk session JWT and return the clerk user ID (sub claim)."""
    header = pyjwt.get_unverified_header(token)
    unverified = pyjwt.decode(token, options={"verify_signature": False})

    iss: str = unverified.get("iss", "")
    kid: str = header.get("kid", "")

    keys = await _get_jwks(iss)
    signing_key = None
    for key_data in keys:
        if key_data.get("kid") == kid:
            signing_key = pyjwt.algorithms.RSAAlgorithm.from_jwk(key_data)  # type: ignore[attr-defined]
            break

    if signing_key is None:
        raise ValueError(f"No signing key found for kid={kid}")

    payload = pyjwt.decode(
        token,
        signing_key,
        algorithms=["RS256"],
        options={"verify_aud": False},
    )

    sub: str = payload.get("sub", "")
    if not sub:
        raise ValueError("Token missing sub claim")

    return sub
