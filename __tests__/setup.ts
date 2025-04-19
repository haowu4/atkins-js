import { MongoClient, Db } from 'mongodb';
import Docker from 'dockerode';
import { promisify } from 'util';
import { setTimeout } from 'timers/promises';

const TEST_MONGO_PORT = 47018;
const TEST_MONGO_CONTAINER_NAME = 'atkins-test-mongodb';

let docker: Docker;
let mongoContainer: Docker.Container;
let mongoClient: MongoClient;
let db: Db;

export async function setupTestDB(): Promise<Db> {
    // Initialize Docker client
    docker = new Docker();

    try {
        // Try to get existing container
        try {
            mongoContainer = docker.getContainer(TEST_MONGO_CONTAINER_NAME);
            const containerInfo = await mongoContainer.inspect();
            
            if (containerInfo.State.Status !== 'running') {
                await mongoContainer.start();
                await setTimeout(2000); // Wait for MongoDB to start
            }
        } catch (error) {
            // Container doesn't exist, create it
            mongoContainer = await docker.createContainer({
                Image: 'mongo:latest',
                name: TEST_MONGO_CONTAINER_NAME,
                ExposedPorts: { '27017/tcp': {} },
                HostConfig: {
                    PortBindings: {
                        '27017/tcp': [{ HostPort: `${TEST_MONGO_PORT}` }]
                    }
                }
            });
            await mongoContainer.start();
            await setTimeout(2000); // Wait for MongoDB to start
        }

        // Connect to MongoDB
        mongoClient = new MongoClient(`mongodb://localhost:${TEST_MONGO_PORT}`);
        await mongoClient.connect();
        db = mongoClient.db('test_db');

        // Clean existing data
        const collections = await db.listCollections().toArray();
        for (const collection of collections) {
            await db.collection(collection.name).drop().catch(() => {});
        }

        return db;
    } catch (error) {
        console.error('Error setting up test database:', error);
        throw error;
    }
}

export async function cleanupTestDB(): Promise<void> {
    try {
        if (mongoClient) {
            try {
                // Drop all collections
                const collections = await db?.listCollections().toArray();
                if (collections) {
                    for (const collection of collections) {
                        await db.collection(collection.name).drop().catch(() => {});
                    }
                }
            } catch (error) {
                console.error('Error dropping collections:', error);
            }
            await mongoClient.close().catch(() => {});
        }
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
} 