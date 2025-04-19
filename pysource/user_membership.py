from datetime import datetime

from pymongo.synchronous.collection import Collection

from atkins.base import MongoService
from typing import TypedDict, Optional, Literal

from atkins.utils import get_timeduration


class MembershipUpdateRecord(TypedDict):
    time: datetime
    reason: dict
    action: Literal['assign', 'cancel', 'renew']


class UserMembershipRecord(TypedDict):
    user: str
    membership: str
    updatedAt: datetime
    validUntil: datetime
    history: list[MembershipUpdateRecord]
    auto_renew: bool


class UserMembershipService(MongoService):
    def __init__(
            self,
            db,
            collection_name: str = 'user_membership'
    ):
        super().__init__(db)
        self.collection_name = collection_name
        self.coll: Collection[UserMembershipRecord] = self.db[collection_name]

    def create_collections(
            self,
    ):
        pass

    def build_index(self, **kwargs):
        """
        create the following indices:
         1. unique index on user field
         2. non-unique index on membership, validUntil field
        """
        self.coll = self.db[self.collection_name]
        self.coll.create_index("user", unique=True)
        self.coll.create_index([("membership", 1), ("validUntil", 1)])

    def list_membership(self, user: str) -> Optional[UserMembershipRecord]:
        """
        Get user's membership record
        :param user: User identifier
        :return: User's membership record or None if not found
        """
        return self.coll.find_one({"user": user})

    def assign_membership(self, user: str, membership: str, reason: dict, duration: str = "1y") -> bool:
        """
        Assign membership to user
        :param user: User identifier
        :param membership: Membership type
        :param reason: Reason for assigning membership
        :param duration: Duration string (e.g. "1m", "2h", "3d", "4w", "5y")
        :return: True if update was successful
        """
        now = datetime.now()
        valid_until = now + get_timeduration(duration)

        update_record = MembershipUpdateRecord(
            time=now,
            reason=reason,
            action="assign"
        )

        result = self.coll.update_one(
            {"user": user},
            {
                "$set": {
                    "membership": membership,
                    "updatedAt": now,
                    "validUntil": valid_until,
                    "auto_renew": True
                },
                "$push": {"history": update_record}
            },
            upsert=True
        )
        return result.modified_count > 0 or result.upserted_id is not None

    def cancel_membership(self, user: str, membership: str, reason: dict) -> bool:
        """
        Cancel user's membership
        :param user: User identifier
        :param membership: Membership type to cancel
        :param reason: Reason for cancellation
        :return: True if update was successful
        """
        now = datetime.now()
        update_record = MembershipUpdateRecord(
            time=now,
            reason=reason,
            action="cancel"
        )

        result = self.coll.update_one(
            {"user": user, "membership": membership},
            {
                "$set": {
                    "validUntil": now,
                    "auto_renew": False,
                    "updatedAt": now
                },
                "$push": {"history": update_record}
            }
        )
        return result.modified_count > 0

    def set_membership_auto_renew_preference(self, user: str, membership: str, auto_renew_preference: bool) -> bool:
        """
        Set user's membership auto-renew preference
        :param user: User identifier
        :param membership: Membership type
        :param auto_renew_preference: Whether to auto-renew
        :return: True if update was successful
        """
        result = self.coll.update_one(
            {"user": user, "membership": membership},
            {"$set": {"auto_renew": auto_renew_preference}}
        )
        return result.modified_count > 0
