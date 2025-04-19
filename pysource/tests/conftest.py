import os.path

import pytest
from pymongo import MongoClient
from docker import DockerClient
from docker.errors import NotFound
import time


@pytest.fixture(scope="session")
def docker_client():
    sock_path = os.path.expanduser('~/.docker/run/docker.sock')
    sock_url = f'unix:/{sock_path}'
    return DockerClient(base_url=sock_url)


@pytest.fixture(scope="session")
def mongodb_container(docker_client):
    container_name = "atkins-test-mongodb"

    try:
        existing_container = docker_client.containers.get(container_name)
        if existing_container.status == "running":
            pass
    except NotFound:

        # Start MongoDB container
        container = docker_client.containers.run(
            "mongo:latest",
            name="atkins-test-mongodb",
            detach=True,
            ports={'27017/tcp': ('127.0.0.1', 47017)},
            remove=True
        )

        time.sleep(2)

    yield container

    # Cleanup
    try:
        container.stop()
    except NotFound:
        pass


@pytest.fixture
def mongodb_client(mongodb_container):
    client = MongoClient('mongodb://localhost:47017')
    yield client
    # Drop all databases between tests
    for db_name in client.list_database_names():
        if db_name not in ['admin', 'local', 'config']:
            client.drop_database(db_name)
    client.close()


@pytest.fixture
def db(mongodb_client):
    return mongodb_client['test_db']
