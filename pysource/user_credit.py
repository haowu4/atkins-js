from datetime import datetime

from pymongo.synchronous.collection import Collection

from atkins.base import MongoService
from typing import TypedDict, Optional, Literal


class CreditUpdateRecord(TypedDict):
    time: datetime
    reason: dict
    amount: int


class UserCreditRecord(TypedDict):
    user: str
    credit: int
    updatedAt: datetime
    history: list[CreditUpdateRecord]


class UserCreditService(MongoService):
    def __init__(
            self,
            db,
            collection_name: str = 'user_credit'
    ):
        super().__init__(db)
        self.collection_name = collection_name
        self.coll: Collection[UserCreditRecord] = self.db[collection_name]

    def create_collections(
            self,
    ):
        pass

    def build_index(self, **kwargs):
        """
        create the following indices:
         1. unique index on user field
        """
        self.coll = self.db[self.collection_name]
        self.coll.create_index("user", unique=True)

    def get_credit(self, user: str) -> Optional[UserCreditRecord]:
        """
        Get user's credit record
        :param user: User identifier
        :return: User's credit record or None if not found
        """
        return self.coll.find_one({"user": user})

    def add_credit(self, user: str, amount: int, reason: dict) -> bool:
        """
        Add credit to user's account
        :param user: User identifier
        :param amount: Amount of credit to add
        :param reason: Reason for adding credit
        :return: True if update was successful
        """
        now = datetime.now()
        update_record = CreditUpdateRecord(
            time=now,
            reason=reason,
            amount=amount
        )

        result = self.coll.update_one(
            {"user": user},
            {
                "$inc": {"credit": amount},
                "$set": {"updatedAt": now},
                "$push": {"history": update_record}
            },
            upsert=True
        )
        return result.modified_count > 0 or result.upserted_id is not None

    def minus_credit(self, user: str, amount: int, reason: dict) -> bool:
        """
        Subtract credit from user's account
        :param user: User identifier
        :param amount: Amount of credit to subtract
        :param reason: Reason for subtracting credit
        :return: True if update was successful
        """
        now = datetime.now()
        update_record = CreditUpdateRecord(
            time=now,
            reason=reason,
            amount=-amount
        )

        result = self.coll.update_one(
            {"user": user},
            {
                "$inc": {"credit": -amount},
                "$set": {"updatedAt": now},
                "$push": {"history": update_record}
            },
            upsert=True
        )
        return result.modified_count > 0 or result.upserted_id is not None
