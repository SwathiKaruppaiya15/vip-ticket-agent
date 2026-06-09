"""
Database seeder — inserts default users on first startup (empty DB only).

Demo admin:  admin@vipulse.ai / admin123
  → is_first_login=True, must_change_credentials=True
  → user will be forced to set new credentials on first login

Other seed accounts use must_change_credentials=False.
"""
import logging
from datetime import datetime, timezone

from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

SEED_USERS = [
    {
        "username":               "admin",
        "email":                  "admin@vipulse.ai",
        "password":               "admin123",
        "role":                   UserRole.ADMIN,
        "is_first_login":         True,
        "must_change_credentials": True,
    },
    {
        "username":               "manager",
        "email":                  "manager@vipulse.ai",
        "password":               "manager123",
        "role":                   UserRole.MANAGER,
        "is_first_login":         False,
        "must_change_credentials": False,
    },
    {
        "username":               "support",
        "email":                  "support@vipulse.ai",
        "password":               "support123",
        "role":                   UserRole.SUPPORT_AGENT,
        "is_first_login":         False,
        "must_change_credentials": False,
    },
]


async def seed_users() -> None:
    """Idempotent — only runs when the users collection is empty."""
    from app.core.security import hash_password_async

    count = await User.count()
    if count > 0:
        logger.info(f"seed_users: skipped ({count} users already exist)")
        return

    logger.info("seed_users: empty DB — inserting seed users")

    for s in SEED_USERS:
        user = User(
            username=s["username"],
            email=s["email"],
            hashed_password=await hash_password_async(s["password"]),
            role=s["role"],
            is_active=True,
            is_first_login=s["is_first_login"],
            must_change_credentials=s["must_change_credentials"],
            created_at=datetime.now(timezone.utc),
        )
        await user.insert()
        flag = " [MUST CHANGE CREDENTIALS]" if s["must_change_credentials"] else ""
        logger.info(f"seed_users: created {s['role'].value} {s['email']}{flag}")

    logger.info("seed_users: done")
