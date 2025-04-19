import { Db } from 'mongodb';
import { setupTestDB, cleanupTestDB } from './setup';
import { UserMembershipService } from '../src/services/user-membership';

describe('UserMembershipService', () => {
    let db: Db;
    let userMembershipService: UserMembershipService;

    beforeAll(async () => {
        db = await setupTestDB();
        userMembershipService = new UserMembershipService(db, { collectionName: 'user_membership' });
        await userMembershipService.buildIndex();
    });

    afterAll(async () => {
        await cleanupTestDB();
    });

    beforeEach(async () => {
        await db.collection('user_membership').deleteMany({});
    });

    describe('listMembership', () => {
        it('should return null for non-existent user', async () => {
            const result = await userMembershipService.listMembership('nonexistent');
            expect(result).toBeNull();
        });

        it('should return membership record for existing user', async () => {
            const user = 'user123';
            const membership = 'premium';
            await userMembershipService.assignMembership(user, membership, { reason: 'test' });

            const result = await userMembershipService.listMembership(user);
            expect(result).toBeTruthy();
            expect(result?.user).toBe(user);
            expect(result?.membership).toBe(membership);
            expect(result?.auto_renew).toBe(true);
        });
    });

    describe('assignMembership', () => {
        it('should assign new membership', async () => {
            const user = 'user123';
            const membership = 'premium';
            const reason = { reason: 'test' };

            const result = await userMembershipService.assignMembership(user, membership, reason);
            expect(result).toBe(true);

            const record = await userMembershipService.listMembership(user);
            expect(record).toBeTruthy();
            expect(record?.membership).toBe(membership);
            expect(record?.auto_renew).toBe(true);
            expect(record?.history).toHaveLength(1);
            expect(record?.history[0].action).toBe('assign');
        });

        it('should update existing membership', async () => {
            const user = 'user123';
            await userMembershipService.assignMembership(user, 'basic', { reason: 'initial' });
            await userMembershipService.assignMembership(user, 'premium', { reason: 'upgrade' });

            const record = await userMembershipService.listMembership(user);
            expect(record?.membership).toBe('premium');
            expect(record?.history).toHaveLength(2);
        });
    });

    describe('cancelMembership', () => {
        it('should cancel existing membership', async () => {
            const user = 'user123';
            const membership = 'premium';
            await userMembershipService.assignMembership(user, membership, { reason: 'test' });

            const result = await userMembershipService.cancelMembership(user, membership, { reason: 'cancel' });
            expect(result).toBe(true);

            const record = await userMembershipService.listMembership(user);
            expect(record?.auto_renew).toBe(false);
            expect(record?.history).toHaveLength(2);
            expect(record?.history[1].action).toBe('cancel');
        });

        it('should return false for non-existent membership', async () => {
            const result = await userMembershipService.cancelMembership('nonexistent', 'premium', { reason: 'test' });
            expect(result).toBe(false);
        });
    });

    describe('setMembershipAutoRenewPreference', () => {
        it('should update auto-renew preference', async () => {
            const user = 'user123';
            const membership = 'premium';
            await userMembershipService.assignMembership(user, membership, { reason: 'test' });

            const result = await userMembershipService.setMembershipAutoRenewPreference(user, membership, false);
            expect(result).toBe(true);

            const record = await userMembershipService.listMembership(user);
            expect(record?.auto_renew).toBe(false);
        });

        it('should return false for non-existent membership', async () => {
            const result = await userMembershipService.setMembershipAutoRenewPreference('nonexistent', 'premium', true);
            expect(result).toBe(false);
        });
    });
}); 