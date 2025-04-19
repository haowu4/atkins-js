from datetime import datetime

from atkins.base import MongoService
from atkins.utils import get_timeduration


class ActivityLoggerService(MongoService):

    def __init__(
            self,
            db,
            use_ttl=True,
            use_capped_coll=True,
            capped_coll_size=1024 * 1024 * 1024,  # 1GB,
            capped_coll_records=1000,
            ttl_limit=60 * 60 * 24 * 10,  # 10 days.
            collection_name: str = 'activity_logs'
    ):
        super().__init__(db)
        self.collection_name = collection_name
        self.coll = self.db[collection_name]
        self.use_ttl = use_ttl
        self.use_capped_coll = use_capped_coll
        self.capped_coll_size = capped_coll_size
        self.capped_coll_records = capped_coll_records
        self.ttl_limit = ttl_limit

        if self.use_ttl and self.use_capped_coll:
            raise ValueError("TTL and Capped collections cannot be used at the same time.")

    def create_collections(
            self,
    ):

        args = {

        }

        if self.use_capped_coll:
            args["capped"] = True
            args["size"] = self.capped_coll_size
            args["max"] = self.capped_coll_records

        self.db.create_collection(
            self.collection_name,
            **args
        )
        self.coll = self.db[self.collection_name]

    def build_index(self, **kwargs):
        args = {}
        if self.use_ttl:
            args['expireAfterSeconds'] = self.ttl_limit
        self.coll.create_index(
            "createdAt",

            **args
        )

    def log_activity(self, user: str, target: str, meta=None):
        doc = {
            "user": user,
            "target": target,
            "createdAt": datetime.now()
        }

        if meta:
            doc.update(meta)

        self.coll.insert_one(doc)

    def fetch_logs(self, end=None, period='10d'):
        if end is None:
            end = datetime.now()
        start = end - get_timeduration(period)
        return self.coll.find({"createdAt": {"$gte": start, "$lte": end}})
