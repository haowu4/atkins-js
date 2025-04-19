from datetime import datetime

from pymongo.synchronous.collection import Collection

from atkins.base import MongoService
from typing import TypedDict, Optional

from atkins.security import generate_password_hash, check_password_hash


class UserRecord(TypedDict):
    user: str
    email: str
    hashed_password: str
    verified: bool
    createdAt: datetime


class UserService(MongoService):

    def __init__(
            self,
            db,
            collection_name: str = 'users'
    ):
        super().__init__(db)
        self.collection_name = collection_name
        self.coll: Collection[UserRecord] = self.db[collection_name]

    def create_collections(
            self,
    ):
        pass

    def build_index(self, **kwargs):
        """
        create the following indices:
         1. unique index on user field
         2. non-unique index on email field
         3. non-unique index on verified field
         4. non-unique index on createdAt field
        """
        self.coll = self.db[self.collection_name]
        self.coll.create_index("user", unique=True)
        self.coll.create_index("email")
        self.coll.create_index("verified")
        self.coll.create_index("createdAt")

    def create_user(self, user: str, email: str, password: str, verified: bool = False) -> str:
        """
        Create a new user
        :param user: User identifier
        :param email: User's email
        :param password: User's password
        :param verified: Whether the user is verified
        :return: Created user identifier
        """
        doc = {
            "user": user,
            "email": email,
            "hashed_password": generate_password_hash(password),
            "verified": verified,
            "createdAt": datetime.now()
        }
        self.coll.insert_one(doc)
        return user

    def update_user_password(self, user: str, password: str) -> bool:
        """
        Verify user's password
        :param user: User identifier
        :param password: new password
        :return: True if password matches
        """
        result = self.coll.update_one(
            {"user": user},
            {"$set": {"hashed_password": generate_password_hash(password)}}
        )
        return result.modified_count > 0

    def verify_user_password(self, user: str, password: str) -> bool:
        """
        Verify user's password
        :param user: User identifier
        :param password: Password to verify
        :return: True if password matches
        """
        user_record = self.coll.find_one({"user": user})
        if not user_record:
            return False
        return check_password_hash(user_record["hashed_password"], password)

    def change_user_email(self, user: str, email: str) -> bool:
        """
        Change user's email
        :param user: User identifier
        :param email: New email
        :return: True if update was successful
        """
        result = self.coll.update_one(
            {"user": user},
            {"$set": {"email": email}}
        )
        return result.modified_count > 0

    def change_user_verification_status(self, user: str, verification_status: bool) -> bool:
        """
        Change user's verification status
        :param user: User identifier
        :param verification_status: New verification status
        :return: True if update was successful
        """
        result = self.coll.update_one(
            {"user": user},
            {"$set": {"verified": verification_status}}
        )
        return result.modified_count > 0

    def get_user(self, user: str) -> Optional[UserRecord]:
        """
        Get user record
        :param user: User identifier
        :return: User record or None if not found
        """
        return self.coll.find_one({"user": user})
