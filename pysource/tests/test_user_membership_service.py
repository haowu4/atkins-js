import pytest
from datetime import datetime, UTC, timedelta
from atkins.services.user_membership import UserMembershipService


@pytest.fixture
def membership_service(db):
    service = UserMembershipService(db)
    service.create_collections()
    service.build_index()
    return service


def test_list_membership_nonexistent(membership_service):
    user_id = "test_user"
    membership = membership_service.list_membership(user_id)
    assert membership is None


def test_assign_membership(membership_service):
    user_id = "test_user"
    membership_type = "premium"
    reason = {"type": "test", "description": "test membership"}
    
    # Assign membership
    assert membership_service.assign_membership(user_id, membership_type, reason) is True
    
    # Verify membership
    membership = membership_service.list_membership(user_id)
    assert membership is not None
    assert membership["user"] == user_id
    assert membership["membership"] == membership_type
    assert membership["auto_renew"] is True
    assert isinstance(membership["updatedAt"], datetime)
    assert isinstance(membership["validUntil"], datetime)
    assert len(membership["history"]) == 1
    assert membership["history"][0]["action"] == "assign"
    assert membership["history"][0]["reason"] == reason


def test_cancel_membership(membership_service):
    user_id = "test_user"
    membership_type = "premium"
    reason = {"type": "test", "description": "test membership"}
    cancel_reason = {"type": "test", "description": "cancel membership"}
    
    # Assign membership
    membership_service.assign_membership(user_id, membership_type, reason)
    
    # Cancel membership
    assert membership_service.cancel_membership(user_id, membership_type, cancel_reason) is True
    
    # Verify membership
    membership = membership_service.list_membership(user_id)
    assert membership is not None
    assert membership["auto_renew"] is False
    assert len(membership["history"]) == 2
    assert membership["history"][1]["action"] == "cancel"
    assert membership["history"][1]["reason"] == cancel_reason


def test_set_auto_renew_preference(membership_service):
    user_id = "test_user"
    membership_type = "premium"
    reason = {"type": "test", "description": "test membership"}
    
    # Assign membership
    membership_service.assign_membership(user_id, membership_type, reason)
    
    # Set auto-renew preference
    assert membership_service.set_membership_auto_renew_preference(user_id, membership_type, False) is True
    
    # Verify preference
    membership = membership_service.list_membership(user_id)
    assert membership["auto_renew"] is False
    
    # Change preference back
    assert membership_service.set_membership_auto_renew_preference(user_id, membership_type, True) is True
    
    # Verify preference
    membership = membership_service.list_membership(user_id)
    assert membership["auto_renew"] is True


def test_membership_history(membership_service):
    user_id = "test_user"
    membership_type = "premium"
    reason = {"type": "test", "description": "test membership"}
    cancel_reason = {"type": "test", "description": "cancel membership"}
    
    # Assign membership
    membership_service.assign_membership(user_id, membership_type, reason)
    
    # Cancel membership
    membership_service.cancel_membership(user_id, membership_type, cancel_reason)
    
    # Verify history
    membership = membership_service.list_membership(user_id)
    assert len(membership["history"]) == 2
    assert membership["history"][0]["action"] == "assign"
    assert membership["history"][1]["action"] == "cancel" 