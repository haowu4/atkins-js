from datetime import datetime

import pytest

from atkins.services.activity_logging import ActivityLoggerService


@pytest.fixture
def activity_logger(db):
    service = ActivityLoggerService(
        db,
        use_ttl=False,  # Changed to False since we're using capped collection
        use_capped_coll=True,
        capped_coll_size=1024 * 1024 * 1024,  # 1GB
        capped_coll_records=1000,
        collection_name='test_activity_logs'
    )
    service.create_collections()
    service.build_index()
    return service


@pytest.fixture
def ttl_logger(db):
    service = ActivityLoggerService(
        db,
        use_ttl=True,
        use_capped_coll=False,
        ttl_limit=60 * 60 * 24 * 10,  # 10 days
        collection_name='test_ttl_logs'
    )
    service.create_collections()
    service.build_index()
    return service


def test_ttl_and_capped_conflict(db):
    with pytest.raises(ValueError, match="TTL and Capped collections cannot be used at the same time."):
        ActivityLoggerService(
            db,
            use_ttl=True,
            use_capped_coll=True,
            collection_name='test_conflict_logs'
        )


def test_log_activity(activity_logger):
    user = "test_user"
    target = "test_target"
    meta = {"action": "test", "value": 123}
    
    # Log activity
    activity_logger.log_activity(user, target, meta)
    
    # Verify log exists
    logs = list(activity_logger.fetch_logs())
    assert len(logs) == 1
    log = logs[0]
    assert log["user"] == user
    assert log["target"] == target
    assert log["action"] == meta["action"]
    assert log["value"] == meta["value"]
    assert isinstance(log["createdAt"], datetime)


def test_log_activity_no_meta(activity_logger):
    user = "test_user"
    target = "test_target"
    
    # Log activity without meta
    activity_logger.log_activity(user, target)
    
    # Verify log exists
    logs = list(activity_logger.fetch_logs())
    assert len(logs) == 1
    log = logs[0]
    assert log["user"] == user
    assert log["target"] == target
    assert "action" not in log
    assert isinstance(log["createdAt"], datetime)


def test_fetch_logs_with_period(activity_logger):
    user = "test_user"
    target = "test_target"
    
    # Log multiple activities
    for i in range(3):
        activity_logger.log_activity(user, target, {"index": i})
    
    # Fetch logs with period
    logs = list(activity_logger.fetch_logs(period="1d"))
    assert len(logs) == 3
    
    # Verify logs are in chronological order
    for i in range(len(logs) - 1):
        assert logs[i]["createdAt"] <= logs[i + 1]["createdAt"]


def test_fetch_logs_with_end_date(activity_logger):
    user = "test_user"
    target = "test_target"
    end_date = datetime.now()
    
    # Log activity
    activity_logger.log_activity(user, target)
    
    # Fetch logs with end date
    logs = list(activity_logger.fetch_logs(end=end_date))
    assert len(logs) == 1
    assert logs[0]["createdAt"] <= end_date


def test_capped_collection(activity_logger):
    user = "test_user"
    target = "test_target"
    
    # Log more activities than the capped collection size
    for i in range(2000):  # More than the 1000 record limit
        activity_logger.log_activity(user, target, {"index": i})
    
    # Verify collection is capped
    logs = list(activity_logger.fetch_logs())
    assert len(logs) <= 1000  # Should not exceed the capped size


def test_ttl_index(ttl_logger):
    user = "test_user"
    target = "test_target"
    
    # Log activity
    ttl_logger.log_activity(user, target)
    
    # Verify index has expireAfterSeconds set
    indexes = ttl_logger.coll.index_information()
    assert "createdAt_1" in indexes
    assert indexes["createdAt_1"].get("expireAfterSeconds") == 60 * 60 * 24 * 10  # 10 days


def test_custom_ttl_limit(db):
    custom_ttl = 60 * 60 * 24 * 5  # 5 days
    service = ActivityLoggerService(
        db,
        use_ttl=True,
        use_capped_coll=False,
        ttl_limit=custom_ttl,
        collection_name='test_custom_ttl_logs'
    )
    service.create_collections()
    service.build_index()
    
    # Verify custom TTL is set
    indexes = service.coll.index_information()
    assert "createdAt_1" in indexes
    assert indexes["createdAt_1"].get("expireAfterSeconds") == custom_ttl
