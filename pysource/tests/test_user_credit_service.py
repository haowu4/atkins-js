import pytest
from datetime import datetime, UTC
from atkins.services.user_credit import UserCreditService


@pytest.fixture
def credit_service(db):
    service = UserCreditService(db)
    service.create_collections()
    service.build_index()
    return service


def test_get_credit_nonexistent(credit_service):
    user_id = "test_user"
    credit = credit_service.get_credit(user_id)
    assert credit is None


def test_add_credit(credit_service):
    user_id = "test_user"
    amount = 100
    reason = {"type": "test", "description": "test credit"}
    
    # Add credit
    assert credit_service.add_credit(user_id, amount, reason) is True
    
    # Verify credit
    credit = credit_service.get_credit(user_id)
    assert credit is not None
    assert credit["user"] == user_id
    assert credit["credit"] == amount
    assert len(credit["history"]) == 1
    assert credit["history"][0]["amount"] == amount
    assert credit["history"][0]["reason"] == reason
    assert isinstance(credit["history"][0]["time"], datetime)


def test_minus_credit(credit_service):
    user_id = "test_user"
    initial_amount = 100
    minus_amount = 50
    reason = {"type": "test", "description": "test credit"}
    
    # Add initial credit
    credit_service.add_credit(user_id, initial_amount, reason)
    
    # Minus credit
    assert credit_service.minus_credit(user_id, minus_amount, reason) is True
    
    # Verify credit
    credit = credit_service.get_credit(user_id)
    assert credit is not None
    assert credit["credit"] == initial_amount - minus_amount
    assert len(credit["history"]) == 2
    assert credit["history"][1]["amount"] == -minus_amount


def test_credit_history(credit_service):
    user_id = "test_user"
    reason = {"type": "test", "description": "test credit"}
    
    # Add multiple credits
    credit_service.add_credit(user_id, 100, reason)
    credit_service.add_credit(user_id, 50, reason)
    credit_service.minus_credit(user_id, 30, reason)
    
    # Verify history
    credit = credit_service.get_credit(user_id)
    assert credit is not None
    assert credit["credit"] == 120  # 100 + 50 - 30
    assert len(credit["history"]) == 3
    assert credit["history"][0]["amount"] == 100
    assert credit["history"][1]["amount"] == 50
    assert credit["history"][2]["amount"] == -30 