import pytest
from datetime import datetime, timedelta
from atkins.services.one_time_code import OnetimeCodeService, create_secure_code


@pytest.fixture
def one_time_code_service(db):
    service = OnetimeCodeService(db)
    service.create_collections()
    service.build_index()
    return service


def test_create_secure_code():
    code = create_secure_code()
    assert len(code) == 32  # 16 bytes = 32 hex chars
    assert isinstance(code, str)
    assert all(c in '0123456789abcdef' for c in code)


def test_create_code(one_time_code_service):
    user = "test_user"
    code_type = "verification"
    
    # Create code and get returned value
    returned_code = one_time_code_service.create_code(user, code_type)
    
    # Verify code exists
    record = one_time_code_service.coll.find_one({
        "owner": user,
        "type": code_type
    })
    assert record is not None
    assert record["owner"] == user
    assert record["type"] == code_type
    assert record["code"] == returned_code
    assert len(record["code"]) == 32
    assert isinstance(record["createdAt"], datetime)


def test_verify_code_valid(one_time_code_service):
    user = "test_user"
    code_type = "verification"
    
    # Create code and get returned value
    code = one_time_code_service.create_code(user, code_type)
    
    # Verify code
    assert one_time_code_service.verify_code(user, code_type, code) is True


def test_verify_code_invalid_user(one_time_code_service):
    user = "test_user"
    code_type = "verification"
    
    # Create code and get returned value
    code = one_time_code_service.create_code(user, code_type)
    
    # Verify with wrong user
    assert one_time_code_service.verify_code("wrong_user", code_type, code) is False


def test_verify_code_invalid_type(one_time_code_service):
    user = "test_user"
    code_type = "verification"
    
    # Create code and get returned value
    code = one_time_code_service.create_code(user, code_type)
    
    # Verify with wrong type
    assert one_time_code_service.verify_code(user, "wrong_type", code) is False


def test_verify_code_invalid_code(one_time_code_service):
    user = "test_user"
    code_type = "verification"
    
    # Create code
    one_time_code_service.create_code(user, code_type)
    
    # Verify with wrong code
    assert one_time_code_service.verify_code(user, code_type, "invalid_code") is False


def test_consume_code_valid(one_time_code_service):
    user = "test_user"
    code_type = "verification"
    
    # Create code and get returned value
    code = one_time_code_service.create_code(user, code_type)
    
    # Consume code
    assert one_time_code_service.consume_code(user, code_type, code) is True
    
    # Verify code is gone
    assert one_time_code_service.verify_code(user, code_type, code) is False


def test_consume_code_invalid(one_time_code_service):
    user = "test_user"
    code_type = "verification"
    
    # Try to consume non-existent code
    assert one_time_code_service.consume_code(user, code_type, "invalid_code") is False


def test_consume_code_already_consumed(one_time_code_service):
    user = "test_user"
    code_type = "verification"
    
    # Create code and get returned value
    code = one_time_code_service.create_code(user, code_type)
    
    # Consume code first time
    assert one_time_code_service.consume_code(user, code_type, code) is True
    
    # Try to consume again
    assert one_time_code_service.consume_code(user, code_type, code) is False


def test_multiple_codes_same_user(one_time_code_service):
    user = "test_user"
    code_type = "verification"
    
    # Create multiple codes and collect returned values
    codes = [one_time_code_service.create_code(user, code_type) for _ in range(3)]
    
    # Verify all codes exist
    for code in codes:
        assert one_time_code_service.verify_code(user, code_type, code) is True
    
    # Consume all codes
    for code in codes:
        assert one_time_code_service.consume_code(user, code_type, code) is True
    
    # Verify all codes are gone
    for code in codes:
        assert one_time_code_service.verify_code(user, code_type, code) is False


def test_different_code_types(one_time_code_service):
    user = "test_user"
    code_types = ["verification", "password_reset", "email_change"]
    
    # Create codes for different types and collect returned values
    codes = {code_type: one_time_code_service.create_code(user, code_type) 
             for code_type in code_types}
    
    # Verify each code works for its type but not others
    for code_type, code in codes.items():
        assert one_time_code_service.verify_code(user, code_type, code) is True
        for other_type in code_types:
            if other_type != code_type:
                assert one_time_code_service.verify_code(user, other_type, code) is False


def test_code_uniqueness_per_user_type(one_time_code_service):
    user1 = "user1"
    user2 = "user2"
    code_type = "verification"
    
    # Create codes for different users and get returned values
    code1 = one_time_code_service.create_code(user1, code_type)
    code2 = one_time_code_service.create_code(user2, code_type)
    
    # Codes should be different
    assert code1 != code2
    
    # Verify each code works only for its user
    assert one_time_code_service.verify_code(user1, code_type, code1) is True
    assert one_time_code_service.verify_code(user2, code_type, code1) is False
    assert one_time_code_service.verify_code(user1, code_type, code2) is False
    assert one_time_code_service.verify_code(user2, code_type, code2) is True


def test_code_uniqueness_retry(one_time_code_service):
    user = "test_user"
    code_type = "verification"
    
    # Mock the create_code_fn to return the same code twice, then a different one
    original_fn = one_time_code_service.create_code_fn
    codes = ["duplicate_code", "duplicate_code", "unique_code"]
    one_time_code_service.create_code_fn = lambda: codes.pop(0)
    
    try:
        # First attempt should succeed
        code1 = one_time_code_service.create_code(user, code_type)
        
        # Second attempt should also succeed (with retry)
        code2 = one_time_code_service.create_code(user, code_type)
        
        # Verify we have two different codes
        assert code1 != code2
        records = list(one_time_code_service.coll.find({"owner": user, "type": code_type}))
        assert len(records) == 2
        assert records[0]["code"] != records[1]["code"]
    finally:
        # Restore original function
        one_time_code_service.create_code_fn = original_fn


def test_code_creation_failure(one_time_code_service):
    user = "test_user"
    code_type = "verification"
    
    # Mock the create_code_fn to always return the same code
    original_fn = one_time_code_service.create_code_fn
    one_time_code_service.create_code_fn = lambda: "duplicate_code"
    
    try:
        # First attempt should succeed
        code = one_time_code_service.create_code(user, code_type)
        assert code == "duplicate_code"
        
        # Second attempt should fail after retries
        with pytest.raises(Exception, match="Failed to generate unique code after multiple attempts"):
            one_time_code_service.create_code(user, code_type)
    finally:
        # Restore original function
        one_time_code_service.create_code_fn = original_fn 