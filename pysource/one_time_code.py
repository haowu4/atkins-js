import secrets
from datetime import datetime, timedelta

from pymongo.synchronous.collection import Collection

from atkins.base import MongoService
from typing import TypedDict, Optional


class UserRecord(TypedDict):
    owner: str
    type: str
    code: str
    createdAt: datetime


def create_secure_code():
    return secrets.token_hex(16)


class OnetimeCodeService(MongoService):

    def __init__(
            self,
            db,
            collection_name: str = 'ont_time_code',
            ttl_limit=60 * 10,  # 10 minutes,
            create_code_fn=create_secure_code
    ):
        super().__init__(db)
        self.collection_name = collection_name
        self.coll: Collection[UserRecord] = self.db[collection_name]
        self.ttl_limit = ttl_limit
        self.create_code_fn = create_code_fn

    def build_index(self, **kwargs):
        self.coll.create_index(
            [
                ("owner", 1),
                ("type", 1),
                ("code", 1)
            ],
            unique=True
        )
        self.coll.create_index(
            "createdAt",
            expireAfterSeconds=self.ttl_limit
        )

    def create_collections(self, **kwargs):
        pass

    def create_code(self, user: str, code_type: str) -> str:
        """
        Create a new one-time code for the user and type.
        Ensures the code is unique for this user and type combination.
        """
        max_attempts = 3
        for _ in range(max_attempts):
            code = self.create_code_fn()
            try:
                self.coll.insert_one({
                    "owner": user,
                    "type": code_type,
                    "code": code,
                    "createdAt": datetime.now()
                })
                return code
            except Exception:
                continue
        raise Exception("Failed to generate unique code after multiple attempts")

    def verify_code(self, user: str, code_type: str, code: str) -> bool:
        """Check if the code exists for the given user and type, without consuming it."""
        record = self.coll.find_one({
            "owner": user,
            "type": code_type,
            "code": code,
        })

        if not record:
            return False
        if datetime.now() - record['createdAt'] > timedelta(seconds=self.ttl_limit):
            return False
        return True

    def consume_code(self, user: str, code_type: str, code: str) -> bool:
        """Verify and consume the code by removing it atomically."""
        result = self.coll.find_one_and_delete({
            "owner": user,
            "type": code_type,
            "code": code,
        })
        return result is not None
