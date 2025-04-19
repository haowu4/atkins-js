import { Db } from 'mongodb';
import { setupTestDB, cleanupTestDB } from './setup';
import { UserCreditService } from '../src/services/user-credit';

describe('UserCreditService', () => {
    let db: Db;
    let creditService: UserCreditService;

    beforeAll(async () => {
        db = await setupTestDB();
        creditService = new UserCreditService(db);
        await creditService.buildIndex();
    });

    afterAll(async () => {
        await cleanupTestDB();
    });

    beforeEach(async () => {
        await db.collection('user_credit').deleteMany({});
    });

    describe('getCredit', () => {
        it('should return null for non-existent user', async () => {
            const credit = await creditService.getCredit('nonexistent');
            expect(credit).toBeNull();
        });
    });

    describe('addCredit', () => {
        it('should add credit to new user', async () => {
            const added = await creditService.addCredit('testuser', 100, { reason: 'test' });
            expect(added).toBe(true);

            const credit = await creditService.getCredit('testuser');
            expect(credit).toBeTruthy();
            expect(credit?.credit).toBe(100);
            expect(credit?.history).toHaveLength(1);
            expect(credit?.history[0].amount).toBe(100);
        });

        it('should add credit to existing user', async () => {
            await creditService.addCredit('testuser', 100, { reason: 'test' });
            const added = await creditService.addCredit('testuser', 50, { reason: 'test2' });
            expect(added).toBe(true);

            const credit = await creditService.getCredit('testuser');
            expect(credit?.credit).toBe(150);
            expect(credit?.history).toHaveLength(2);
        });
    });

    describe('minusCredit', () => {
        it('should subtract credit from user', async () => {
            await creditService.addCredit('testuser', 100, { reason: 'test' });
            const subtracted = await creditService.minusCredit('testuser', 50, { reason: 'test2' });
            expect(subtracted).toBe(true);

            const credit = await creditService.getCredit('testuser');
            expect(credit?.credit).toBe(50);
            expect(credit?.history).toHaveLength(2);
            expect(credit?.history[1].amount).toBe(-50);
        });

        it('should handle negative balance', async () => {
            await creditService.addCredit('testuser', 100, { reason: 'test' });
            const subtracted = await creditService.minusCredit('testuser', 150, { reason: 'test2' });
            expect(subtracted).toBe(true);

            const credit = await creditService.getCredit('testuser');
            expect(credit?.credit).toBe(-50);
        });
    });
}); 