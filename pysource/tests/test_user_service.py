import pytest
from datetime import datetime, UTC
from atkins.services.user import UserService


@pytest.fixture
def user_service(db):
    service = UserService(db)
    service.create_collections()
    service.build_index()
    return service


def test_create_user(user_service):
    user_id = "test_user"
    email = "test@example.com"
    password = "password123"
    
    # Create user
    created_user = user_service.create_user(user_id, email, password)
    assert created_user == user_id
    
    # Verify user exists
    user = user_service.get_user(user_id)
    assert user is not None
    assert user["user"] == user_id
    assert user["email"] == email
    assert user["verified"] is False
    assert isinstance(user["createdAt"], datetime)


def test_verify_user_password(user_service):
    user_id = "test_user"
    email = "test@example.com"
    password = "password123"
    
    # Create user
    user_service.create_user(user_id, email, password)
    
    # Test correct password
    assert user_service.verify_user_password(user_id, password) is True
    
    # Test incorrect password
    assert user_service.verify_user_password(user_id, "wrong_password") is False


def test_update_user_password(user_service):
    user_id = "test_user"
    email = "test@example.com"
    password = "password123"
    new_password = "new_password123"
    
    # Create user
    user_service.create_user(user_id, email, password)
    
    # Update password
    assert user_service.update_user_password(user_id, new_password) is True
    
    # Verify old password doesn't work
    assert user_service.verify_user_password(user_id, password) is False
    
    # Verify new password works
    assert user_service.verify_user_password(user_id, new_password) is True


def test_change_user_email(user_service):
    user_id = "test_user"
    email = "test@example.com"
    new_email = "new@example.com"
    password = "password123"
    
    # Create user
    user_service.create_user(user_id, email, password)
    
    # Change email
    assert user_service.change_user_email(user_id, new_email) is True
    
    # Verify email changed
    user = user_service.get_user(user_id)
    assert user["email"] == new_email


def test_change_user_verification_status(user_service):
    user_id = "test_user"
    email = "test@example.com"
    password = "password123"
    
    # Create user
    user_service.create_user(user_id, email, password)
    
    # Verify initial status
    user = user_service.get_user(user_id)
    assert user["verified"] is False
    
    # Change verification status
    assert user_service.change_user_verification_status(user_id, True) is True
    
    # Verify status changed
    user = user_service.get_user(user_id)
    assert user["verified"] is True 