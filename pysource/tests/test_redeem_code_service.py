import pytest
from datetime import datetime, UTC
from atkins.services.redeem_code import RedeemCodeService, insert_dashes


@pytest.fixture
def redeem_code_service(db):
    service = RedeemCodeService(db)
    service.create_collections()
    service.build_index()
    return service


def test_insert_dashes():
    assert insert_dashes("12345678") == "1234-5678"
    assert insert_dashes("123456789") == "1234-5678-9"
    assert insert_dashes("") == ""


def test_generate_secure_code():
    code = RedeemCodeService.generate_secure_code()
    assert len(code.replace("-", "")) == 32  # 16 bytes = 32 hex chars
    assert "-" in code
    assert len(code.split("-")) == 8  # 32 chars / 4 = 8 segments


def test_create_code(redeem_code_service):
    code = "TEST-1234-5678"
    code_type = "premium_membership"
    creator = "admin_user"
    
    # Create code
    created_code = redeem_code_service.create_code(code, code_type, creator)
    assert created_code == code
    
    # Verify code exists
    code_record = redeem_code_service.get_code(code)
    assert code_record is not None
    assert code_record["code"] == code
    assert code_record["code_type"] == code_type
    assert code_record["creator"] == creator
    assert code_record["used"] is False
    assert code_record["status"] == "issued"
    assert isinstance(code_record["createdAt"], datetime)
    assert code_record["request"] is None
    assert code_record["response"] is None
    assert code_record["error"] is None


def test_create_codes(redeem_code_service):
    codes = ["TEST-1234-5678", "TEST-8765-4321", "TEST-1111-2222"]
    code_type = "premium_membership"
    creator = "admin_user"
    
    # Create multiple codes
    created_docs = redeem_code_service.create_codes(codes, code_type, creator)
    
    # Verify all codes were created
    assert len(created_docs) == len(codes)
    
    # Verify each code exists and has correct fields
    for code in codes:
        code_record = redeem_code_service.get_code(code)
        assert code_record is not None
        assert code_record["code"] == code
        assert code_record["code_type"] == code_type
        assert code_record["creator"] == creator
        assert code_record["used"] is False
        assert code_record["status"] == "issued"
        assert isinstance(code_record["createdAt"], datetime)
        assert code_record["request"] is None
        assert code_record["response"] is None
        assert code_record["error"] is None


def test_create_codes_duplicate(redeem_code_service):
    codes = ["TEST-1234-5678", "TEST-1234-5678"]  # Duplicate code
    code_type = "premium_membership"
    creator = "admin_user"
    
    # Try to create codes with duplicates
    with pytest.raises(Exception):  # Should raise duplicate key error
        redeem_code_service.create_codes(codes, code_type, creator)


def test_create_codes_empty_list(redeem_code_service):
    code_type = "premium_membership"
    creator = "admin_user"
    # Create empty list of codes
    created_docs = redeem_code_service.create_codes([], code_type, creator)
    assert len(created_docs) == 0


def test_start_processing_code(redeem_code_service):
    code = "TEST-1234-5678"
    code_type = "premium_membership"
    creator = "admin_user"
    request = {"type": "test", "value": 100}
    
    # Create code
    redeem_code_service.create_code(code, code_type, creator)
    
    # Start processing
    assert redeem_code_service.start_processing_code(code, request) is True
    
    # Verify processing state
    code_record = redeem_code_service.get_code(code)
    assert code_record["status"] == "processing"
    assert code_record["request"] == request
    assert isinstance(code_record["updatedAt"], datetime)


def test_mark_processing_failed(redeem_code_service):
    code = "TEST-1234-5678"
    code_type = "premium_membership"
    creator = "admin_user"
    error_msg = {"message": "Test error", "code": "TEST_ERROR"}
    
    # Create code and start processing
    redeem_code_service.create_code(code, code_type, creator)
    redeem_code_service.start_processing_code(code, {"type": "test"})
    
    # Mark as failed
    assert redeem_code_service.mark_processing_failed(code, error_msg) is True
    
    # Verify failed state
    code_record = redeem_code_service.get_code(code)
    assert code_record["status"] == "error"
    assert code_record["error"] == error_msg
    assert isinstance(code_record["updatedAt"], datetime)


def test_mark_processing_done(redeem_code_service):
    code = "TEST-1234-5678"
    code_type = "premium_membership"
    creator = "admin_user"
    response = {"success": True, "message": "Test completed"}
    
    # Create code and start processing
    redeem_code_service.create_code(code, code_type, creator)
    redeem_code_service.start_processing_code(code, {"type": "test"})
    
    # Mark as done
    assert redeem_code_service.mark_processing_done(code, response) is True
    
    # Verify completed state
    code_record = redeem_code_service.get_code(code)
    assert code_record["status"] == "used"
    assert code_record["response"] == response
    assert isinstance(code_record["updatedAt"], datetime)


def test_get_nonexistent_code(redeem_code_service):
    code = "NONEXISTENT-CODE"
    code_record = redeem_code_service.get_code(code)
    assert code_record is None


def test_unique_code_constraint(redeem_code_service):
    code = "TEST-1234-5678"
    code_type = "premium_membership"
    creator = "admin_user"
    
    # Create code
    redeem_code_service.create_code(code, code_type, creator)
    
    # Try to create same code again
    with pytest.raises(Exception):  # Should raise duplicate key error
        redeem_code_service.create_code(code, code_type, creator)


def test_list_codes_by_creator(redeem_code_service):
    creator1 = "admin_user"
    creator2 = "other_user"
    code_type = "premium_membership"
    
    # Create codes for creator1
    codes1 = ["TEST-1234-5678", "TEST-8765-4321"]
    for code in codes1:
        redeem_code_service.create_code(code, code_type, creator1)
    
    # Create codes for creator2
    codes2 = ["TEST-1111-2222", "TEST-3333-4444"]
    for code in codes2:
        redeem_code_service.create_code(code, code_type, creator2)
    
    # Test listing creator1's codes
    creator1_codes = redeem_code_service.list_codes_by_creator(creator1)
    assert len(creator1_codes) == len(codes1)
    for code_record in creator1_codes:
        assert code_record["creator"] == creator1
        assert code_record["code"] in codes1
    
    # Test listing creator2's codes
    creator2_codes = redeem_code_service.list_codes_by_creator(creator2)
    assert len(creator2_codes) == len(codes2)
    for code_record in creator2_codes:
        assert code_record["creator"] == creator2
        assert code_record["code"] in codes2


def test_list_codes_by_creator_pagination(redeem_code_service):
    creator = "admin_user"
    code_type = "premium_membership"
    
    # Create 5 codes
    codes = [f"TEST-{i}-{i}" for i in range(5)]
    for code in codes:
        redeem_code_service.create_code(code, code_type, creator)
    
    # Test pagination with limit 2
    first_page = redeem_code_service.list_codes_by_creator(creator, limit=2)
    assert len(first_page) == 2
    
    # Test pagination with skip 2
    second_page = redeem_code_service.list_codes_by_creator(creator, skip=2, limit=2)
    assert len(second_page) == 2
    
    # Test pagination with skip 4
    last_page = redeem_code_service.list_codes_by_creator(creator, skip=4, limit=2)
    assert len(last_page) == 1
    
    # Verify no overlap between pages
    all_codes = [record["code"] for record in first_page + second_page + last_page]
    assert len(set(all_codes)) == len(all_codes)  # No duplicates
    assert set(all_codes) == set(codes)  # All codes are present


def test_list_codes_by_creator_empty(redeem_code_service):
    creator = "non_existent_user"
    codes = redeem_code_service.list_codes_by_creator(creator)
    assert len(codes) == 0 