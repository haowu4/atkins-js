import { Db } from 'mongodb';
import { setupTestDB, cleanupTestDB } from './setup';
import { ActivityLoggerService } from '../src/services/activity-logger';

describe('ActivityLoggerService', () => {
    let db: Db;
    let activityLoggerService: ActivityLoggerService;

    beforeAll(async () => {
        db = await setupTestDB();
        activityLoggerService = new ActivityLoggerService(db, {
            useTtl: false,
            useCappedColl: true,
            cappedCollSize: 1024 * 1024 * 1024, // 1GB
            cappedCollRecords: 1000,
            ttlSeconds: 60 * 60 * 24 * 10, // 10 days
            collectionName: 'test_activity_logs'
        });
        await activityLoggerService.createCollections();
        await activityLoggerService.buildIndex();
    });

    afterAll(async () => {
        await cleanupTestDB();
    });

    beforeEach(async () => {
        await db.collection('test_activity_logs').deleteMany({});
    });

    describe('logActivity', () => {
        it('should log a new activity', async () => {
            const user = 'user123';
            const target = 'login';
            const meta = { ip: '127.0.0.1' };

            await activityLoggerService.logActivity(user, target, meta);

            const logs = await activityLoggerService.fetchLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].user).toBe(user);
            expect(logs[0].target).toBe(target);
            expect(logs[0].meta!.ip).toBe(meta.ip);
            expect(logs[0].createdAt).toBeInstanceOf(Date);
        });

        it('should log activity without meta', async () => {
            const user = 'user123';
            const target = 'logout';

            await activityLoggerService.logActivity(user, target);

            const logs = await activityLoggerService.fetchLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].user).toBe(user);
            expect(logs[0].target).toBe(target);
            expect(logs[0].createdAt).toBeInstanceOf(Date);
        });
    });

    describe('fetchLogs', () => {
        it('should fetch logs within a period', async () => {
            const user = 'user123';
            const target = 'login';

            // Log multiple activities
            for (let i = 0; i < 3; i++) {
                await activityLoggerService.logActivity(user, target, { index: i });
            }

            const logs = await activityLoggerService.fetchLogs(undefined, '1d');
            expect(logs).toHaveLength(3);

            // Verify logs are in reverse chronological order (most recent first)
            for (let i = 0; i < logs.length - 1; i++) {
                expect(logs[i].createdAt.getTime()).toBeGreaterThanOrEqual(logs[i + 1].createdAt.getTime());
            }
        });

        it('should fetch logs with end date', async () => {
            const user = 'user123';
            const target = 'login';
            const endDate = new Date();

            await activityLoggerService.logActivity(user, target);

            const logs = await activityLoggerService.fetchLogs(endDate);
            expect(logs).toHaveLength(1);
            expect(logs[0].createdAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
        });
    });

    describe('capped collection', () => {
        it('should respect capped collection size', async () => {
            const user = 'user123';
            const target = 'login';

            // Log more activities than the capped collection size
            for (let i = 0; i < 2000; i++) {
                await activityLoggerService.logActivity(user, target, { index: i });
            }

            const logs = await activityLoggerService.fetchLogs();
            expect(logs.length).toBeLessThanOrEqual(1000); // Should not exceed the capped size
        });
    });

    describe('ttl and capped conflict', () => {
        it('should throw error when both ttl and capped are enabled', async () => {
            expect(() => {
                new ActivityLoggerService(db, {
                    useTtl: true,
                    useCappedColl: true,
                    cappedCollSize: 1024 * 1024 * 1024, // 1GB
                    cappedCollRecords: 1000,
                    ttlSeconds: 60 * 60 * 24 * 10, // 10 days
                    collectionName: 'test_conflict_logs'
                });
            }).toThrow('TTL and Capped collections cannot be used at the same time.');
        });
    });

    describe('ttl functionality', () => {
        let ttlService: ActivityLoggerService;
        const TTL_COLLECTION = 'test_ttl_logs_new';

        beforeAll(async () => {
            // Drop the collection to ensure clean state
            await db.collection(TTL_COLLECTION).drop().catch(() => {});
            
            ttlService = new ActivityLoggerService(db, {
                useTtl: true,
                useCappedColl: false,
                cappedCollSize: 1024 * 1024 * 1024, // 1GB
                cappedCollRecords: 1000,
                ttlSeconds: 1, // 1 second TTL for testing
                collectionName: TTL_COLLECTION
            });
            
            await ttlService.createCollections();
            await ttlService.buildIndex();
        });

        afterAll(async () => {
            await db.collection(TTL_COLLECTION).drop().catch(() => {});
        });

        it('should create TTL index', async () => {
            // Verify TTL index exists
            const indexes = await db.collection(TTL_COLLECTION).indexes();
            const ttlIndex = indexes.find(index => index.expireAfterSeconds !== undefined);
            expect(ttlIndex).toBeDefined();
            expect(ttlIndex!.expireAfterSeconds).toBe(1);
        });
    });
}); 