#!/usr/bin/env python3
"""
Provision a new VC firm tenant and its first Admin user.

Usage (run from backend/ directory):
    python scripts/provision_tenant.py \\
        --name "Sequoia Capital" \\
        --slug "sequoia" \\
        --email "partner@sequoia.com" \\
        --clerk-user-id "user_2abc123XYZ"

The clerk-user-id is found in the Clerk dashboard under Users.
"""

import argparse
import sys
from pathlib import Path

# Ensure app is importable when script is run from the backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.base import Role, Tenant, User


def provision(name: str, slug: str, email: str, clerk_user_id: str) -> None:
    engine = create_engine(settings.database_url_sync, echo=False)

    with Session(engine) as session:
        existing = session.query(Tenant).filter_by(slug=slug).first()
        if existing:
            print(f"ERROR: Tenant with slug '{slug}' already exists (id={existing.id})")
            sys.exit(1)

        existing_user = session.query(User).filter_by(clerk_user_id=clerk_user_id).first()
        if existing_user:
            print(f"ERROR: Clerk user ID '{clerk_user_id}' is already provisioned")
            sys.exit(1)

        tenant = Tenant(name=name, slug=slug)
        session.add(tenant)
        session.flush()

        user = User(
            tenant_id=tenant.id,
            clerk_user_id=clerk_user_id,
            email=email,
            role=Role.admin,
        )
        session.add(user)
        session.commit()

        print(f"✓ Tenant created : {tenant.name}  (id={tenant.id}, slug={tenant.slug})")
        print(f"✓ Admin user     : {user.email}  (id={user.id})")
        print(f"\nInvite {email} to sign in. They will land on the dashboard automatically.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Provision a VC firm tenant")
    parser.add_argument("--name", required=True, help="Firm display name")
    parser.add_argument("--slug", required=True, help="Unique URL-safe identifier (e.g. sequoia)")
    parser.add_argument("--email", required=True, help="Admin user email address")
    parser.add_argument(
        "--clerk-user-id",
        required=True,
        help="Clerk user ID from the Clerk dashboard (user_xxx)",
    )
    args = parser.parse_args()
    provision(args.name, args.slug, args.email, args.clerk_user_id)


if __name__ == "__main__":
    main()
