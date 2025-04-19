import { Db } from 'mongodb';
import { setupTestDB, cleanupTestDB } from './setup';
import { UserService } from '../src/services/user';

describe('UserService', () => {
    let db: Db;
    let userService: UserService;

    beforeAll(async () => {
        db = await setupTestDB();
        userService = new UserService(db, { collectionName: 'users' });
        await userService.buildIndex();
    });

    afterAll(async () => {
        await cleanupTestDB();
    });

    beforeEach(async () => {
        await db.collection('users').deleteMany({});
    });

    describe('createUser', () => {
        it('should create a new user', async () => {
            const userId = await userService.createUser('testuser', 'test@example.com', 'password123');
            expect(userId).toBe('testuser');

            const user = await userService.getUser('testuser');
            expect(user).toBeTruthy();
            expect(user?.email).toBe('test@example.com');
            expect(user?.verified).toBe(false);
        });

        it('should not allow duplicate usernames', async () => {
            await userService.createUser('testuser', 'test@example.com', 'password123');
            await expect(userService.createUser('testuser', 'test2@example.com', 'password123'))
                .rejects.toThrow();
        });
    });

    describe('verifyUserPassword', () => {
        it('should verify correct password', async () => {
            await userService.createUser('testuser', 'test@example.com', 'password123');
            const isValid = await userService.verifyUserPassword('testuser', 'password123');
            expect(isValid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            await userService.createUser('testuser', 'test@example.com', 'password123');
            const isValid = await userService.verifyUserPassword('testuser', 'wrongpassword');
            expect(isValid).toBe(false);
        });
    });

    describe('updateUserPassword', () => {
        it('should update user password', async () => {
            await userService.createUser('testuser', 'test@example.com', 'password123');
            const updated = await userService.updateUserPassword('testuser', 'newpassword');
            expect(updated).toBe(true);

            const isValid = await userService.verifyUserPassword('testuser', 'newpassword');
            expect(isValid).toBe(true);
        });
    });

    describe('changeUserEmail', () => {
        it('should update user email', async () => {
            await userService.createUser('testuser', 'test@example.com', 'password123');
            const updated = await userService.changeUserEmail('testuser', 'new@example.com');
            expect(updated).toBe(true);

            const user = await userService.getUser('testuser');
            expect(user?.email).toBe('new@example.com');
        });
    });

    describe('changeUserVerificationStatus', () => {
        it('should update verification status', async () => {
            await userService.createUser('testuser', 'test@example.com', 'password123');
            const updated = await userService.changeUserVerificationStatus('testuser', true);
            expect(updated).toBe(true);

            const user = await userService.getUser('testuser');
            expect(user?.verified).toBe(true);
        });
    });
}); 