from datetime import datetime
from secrets import token_hex

from pymongo.synchronous.collection import Collection

from atkins.base import MongoService
from typing import TypedDict, Optional, Literal


class RedeemCodeRecord(TypedDict):
    creator: str
    code: str
    code_type: str  # Indicates which product this code can redeem

    used: bool
    createdAt: datetime
    updatedAt: Optional[datetime]

    status: Literal['issued', 'used', 'expired', 'processing', 'error']

    request: Optional[dict]
    response: Optional[dict]
    error: Optional[dict]


def insert_dashes(input_string: str) -> str:
    """
    Inserts a dash every 4 characters in the input string.

    :param input_string: The string to process
    :return: A new string with dashes inserted
    """
    return '-'.join(input_string[i:i + 4] for i in range(0, len(input_string), 4))


class RedeemCodeService(MongoService):
    def __init__(
            self,
            db,
            collection_name: str = 'redeem_codes'
    ):
        super().__init__(db)
        self.collection_name = collection_name
        self.coll: Collection[RedeemCodeRecord] = self.db[collection_name]

    def create_collections(
            self,
    ):
        pass

    def build_index(self, **kwargs):
        """
        create the following indices:
         1. unique index on code field
         2. non-unique index on createdAt field
         2. non-unique index on status field


        :param kwargs:
        :return:
        """
        self.coll = self.db[self.collection_name]
        self.coll.create_index("code", unique=True)
        self.coll.create_index("creator")
        self.coll.create_index("createdAt")
        self.coll.create_index("status")

    @staticmethod
    def generate_secure_code(length=16):
        h = token_hex(length)
        return insert_dashes(h)

    def create_codes(self, codes: list[str], code_type: str, creator: str) -> str:
        """
        Create a list of redeem code
        :param codes: list of code string
        :param code_type: type of the code, indicating which product it can redeem
        :param creator: the user who created these codes
        :return: The created code
        """

        if len(codes) == 0:
            return []

        docs = [
            {
                "code": code,
                "code_type": code_type,
                "creator": creator,
                "used": False,
                "createdAt": datetime.now(),
                "updatedAt": None,
                "status": "issued",
                "request": None,
                "response": None,
                "error": None,
            } for code in codes
        ]
        self.coll.insert_many(docs)
        return docs

    def create_code(self, code: str, code_type: str, creator: str) -> str:
        """
        Create a new redeem code
        :param code: The code string
        :param code_type: type of the code, indicating which product it can redeem
        :param creator: the user who created this code
        :return: The created code
        """
        doc = {
            "code": code,
            "code_type": code_type,
            "creator": creator,
            "used": False,
            "createdAt": datetime.now(),
            "updatedAt": None,
            "status": "issued",
            "request": None,
            "response": None,
            "error": None,
        }
        self.coll.insert_one(doc)
        return code

    def start_processing_code(self, code: str, request: dict) -> bool:
        update_data = {
            'status': 'processing',
            'request': request,
            'updatedAt': datetime.now(),
        }
        result = self.coll.update_one(
            {"code": code},
            {"$set": update_data}
        )
        return result.modified_count > 0

    def mark_processing_failed(self, code: str, error_msg: dict) -> bool:
        update_data = {
            'status': 'error',
            "error": error_msg,
            'updatedAt': datetime.now(),
        }
        result = self.coll.update_one(
            {"code": code},
            {"$set": update_data}
        )
        return result.modified_count > 0

    def mark_processing_done(self, code: str, response: dict) -> bool:
        update_data = {
            'status': 'used',
            "response": response,
            'updatedAt': datetime.now(),
        }
        result = self.coll.update_one(
            {"code": code},
            {"$set": update_data}
        )
        return result.modified_count > 0

    def get_code(self, code: str) -> Optional[RedeemCodeRecord]:
        """
        Get a code record by code
        :param code: The code to look up
        :return: The code record or None if not found
        """
        return self.coll.find_one({"code": code})

    def list_codes_by_creator(self, creator: str, skip: int = 0, limit: int = 100) -> list[RedeemCodeRecord]:
        """
        List all codes created by a specific user
        :param creator: The creator's username
        :param skip: Number of records to skip (for pagination)
        :param limit: Maximum number of records to return
        :return: List of code records
        """
        cursor = self.coll.find(
            {"creator": creator}
        ).sort("createdAt", -1).skip(skip).limit(limit)
        return list(cursor)
