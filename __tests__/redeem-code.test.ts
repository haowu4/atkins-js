import { Db } from 'mongodb';
import { setupTestDB, cleanupTestDB } from './setup';
import { RedeemCodeService } from '../src/services/redeem-code';

describe('RedeemCodeService', () => {
    let db: Db;
    let redeemCodeService: RedeemCodeService;

    beforeAll(async () => {
        db = await setupTestDB();
        redeemCodeService = new RedeemCodeService(db, { collectionName: 'redeem_codes' });
        await redeemCodeService.buildIndex();
    });

    afterAll(async () => {
        await cleanupTestDB();
    });

    beforeEach(async () => {
        await db.collection('redeem_codes').deleteMany({});
    });

    describe('createCode', () => {
        it('should create a new redeem code', async () => {
            const code = 'TEST-CODE-123';
            const created = await redeemCodeService.createCode(code, 'premium', 'creator');
            expect(created).toBe(code);

            const record = await redeemCodeService.getCode(code);
            expect(record).toBeTruthy();
            expect(record?.code).toBe(code);
            expect(record?.code_type).toBe('premium');
            expect(record?.creator).toBe('creator');
            expect(record?.status).toBe('issued');
        });

        it('should not allow duplicate codes', async () => {
            const code = 'TEST-CODE-123';
            await redeemCodeService.createCode(code, 'premium', 'creator');
            await expect(redeemCodeService.createCode(code, 'premium', 'creator2'))
                .rejects.toThrow();
        });
    });

    describe('createCodes', () => {
        it('should create multiple redeem codes', async () => {
            const codes = ['CODE1', 'CODE2', 'CODE3'];
            const created = await redeemCodeService.createCodes(codes, 'premium', 'creator');
            expect(created).toHaveLength(3);

            for (const code of codes) {
                const record = await redeemCodeService.getCode(code);
                expect(record).toBeTruthy();
                expect(record?.code_type).toBe('premium');
                expect(record?.creator).toBe('creator');
            }
        });
    });

    describe('code processing', () => {
        it('should process code successfully', async () => {
            const code = 'TEST-CODE-123';
            await redeemCodeService.createCode(code, 'premium', 'creator');

            // Start processing
            const started = await redeemCodeService.startProcessingCode(code, { request: 'test' });
            expect(started).toBe(true);

            let record = await redeemCodeService.getCode(code);
            expect(record?.status).toBe('processing');
            expect(record?.request).toEqual({ request: 'test' });

            // Mark as done
            const done = await redeemCodeService.markProcessingDone(code, { response: 'success' });
            expect(done).toBe(true);

            record = await redeemCodeService.getCode(code);
            expect(record?.status).toBe('used');
            expect(record?.response).toEqual({ response: 'success' });
        });

        it('should handle processing failure', async () => {
            const code = 'TEST-CODE-123';
            await redeemCodeService.createCode(code, 'premium', 'creator');

            // Start processing
            await redeemCodeService.startProcessingCode(code, { request: 'test' });

            // Mark as failed
            const failed = await redeemCodeService.markProcessingFailed(code, { error: 'test error' });
            expect(failed).toBe(true);

            const record = await redeemCodeService.getCode(code);
            expect(record?.status).toBe('error');
            expect(record?.error).toEqual({ error: 'test error' });
        });
    });

    describe('listCodesByCreator', () => {
        it('should list codes created by a user', async () => {
            const codes = ['CODE1', 'CODE2', 'CODE3'];
            await redeemCodeService.createCodes(codes, 'premium', 'creator');

            const listed = await redeemCodeService.listCodesByCreator('creator');
            expect(listed).toHaveLength(3);
            expect(listed.map(c => c.code).sort()).toEqual(codes.sort());
        });

        it('should respect pagination', async () => {
            const codes = ['CODE1', 'CODE2', 'CODE3'];
            await redeemCodeService.createCodes(codes, 'premium', 'creator');

            const listed = await redeemCodeService.listCodesByCreator('creator', 1, 1);
            expect(listed).toHaveLength(1);
        });
    });
}); 