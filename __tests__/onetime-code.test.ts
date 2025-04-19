import { Db } from 'mongodb';
import { setupTestDB, cleanupTestDB } from './setup';
import { OnetimeCodeService } from '../src/services/onetime-code';

describe('OnetimeCodeService', () => {
    let db: Db;
    let onetimeCodeService: OnetimeCodeService;

    beforeAll(async () => {
        db = await setupTestDB();
        onetimeCodeService = new OnetimeCodeService(db, {
            collectionName: 'onetime_code',
            ttlLimit: 60 * 10, // 10 minutes
        });
        await onetimeCodeService.buildIndex();
    });

    afterAll(async () => {
        await cleanupTestDB();
    });

    beforeEach(async () => {
        await db.collection('onetime_code').deleteMany({});
    });

    describe('createCode', () => {
        it('should create a new code', async () => {
            const user = 'test_user';
            const codeType = 'verification';
            
            const code = await onetimeCodeService.createCode(user, codeType);
            
            // Verify code exists
            const record = await db.collection('onetime_code').findOne({
                owner: user,
                type: codeType
            });
            
            expect(record).toBeTruthy();
            expect(record?.owner).toBe(user);
            expect(record?.type).toBe(codeType);
            expect(record?.code).toBe(code);
            expect(record?.code.length).toBe(32);
            expect(record?.createdAt).toBeInstanceOf(Date);
        });
    });

    describe('verifyCode', () => {
        it('should verify valid code', async () => {
            const user = 'test_user';
            const codeType = 'verification';
            const code = await onetimeCodeService.createCode(user, codeType);
            
            const isValid = await onetimeCodeService.verifyCode(user, codeType, code);
            expect(isValid).toBe(true);
        });

        it('should reject invalid user', async () => {
            const user = 'test_user';
            const codeType = 'verification';
            const code = await onetimeCodeService.createCode(user, codeType);
            
            const isValid = await onetimeCodeService.verifyCode('wrong_user', codeType, code);
            expect(isValid).toBe(false);
        });

        it('should reject invalid type', async () => {
            const user = 'test_user';
            const codeType = 'verification';
            const code = await onetimeCodeService.createCode(user, codeType);
            
            const isValid = await onetimeCodeService.verifyCode(user, 'wrong_type', code);
            expect(isValid).toBe(false);
        });

        it('should reject invalid code', async () => {
            const user = 'test_user';
            const codeType = 'verification';
            await onetimeCodeService.createCode(user, codeType);
            
            const isValid = await onetimeCodeService.verifyCode(user, codeType, 'invalid_code');
            expect(isValid).toBe(false);
        });
    });

    describe('consumeCode', () => {
        it('should consume valid code', async () => {
            const user = 'test_user';
            const codeType = 'verification';
            const code = await onetimeCodeService.createCode(user, codeType);
            
            const consumed = await onetimeCodeService.consumeCode(user, codeType, code);
            expect(consumed).toBe(true);
            
            // Verify code is gone
            const isValid = await onetimeCodeService.verifyCode(user, codeType, code);
            expect(isValid).toBe(false);
        });

        it('should not consume invalid code', async () => {
            const user = 'test_user';
            const codeType = 'verification';
            
            const consumed = await onetimeCodeService.consumeCode(user, codeType, 'invalid_code');
            expect(consumed).toBe(false);
        });

        it('should not consume already consumed code', async () => {
            const user = 'test_user';
            const codeType = 'verification';
            const code = await onetimeCodeService.createCode(user, codeType);
            
            // First consumption
            const firstConsumed = await onetimeCodeService.consumeCode(user, codeType, code);
            expect(firstConsumed).toBe(true);
            
            // Second consumption
            const secondConsumed = await onetimeCodeService.consumeCode(user, codeType, code);
            expect(secondConsumed).toBe(false);
        });
    });

    describe('multiple codes', () => {
        it('should handle multiple codes for same user', async () => {
            const user = 'test_user';
            const codeType = 'verification';
            
            // Create multiple codes
            const codes = await Promise.all(
                Array(3).fill(null).map(() => onetimeCodeService.createCode(user, codeType))
            );
            
            // Verify all codes exist
            for (const code of codes) {
                const isValid = await onetimeCodeService.verifyCode(user, codeType, code);
                expect(isValid).toBe(true);
            }
            
            // Consume all codes
            for (const code of codes) {
                const consumed = await onetimeCodeService.consumeCode(user, codeType, code);
                expect(consumed).toBe(true);
            }
            
            // Verify all codes are gone
            for (const code of codes) {
                const isValid = await onetimeCodeService.verifyCode(user, codeType, code);
                expect(isValid).toBe(false);
            }
        });

        it('should handle different code types', async () => {
            const user = 'test_user';
            const codeTypes = ['verification', 'password_reset', 'email_change'];
            
            // Create codes for different types
            const codes = await Promise.all(
                codeTypes.map(type => onetimeCodeService.createCode(user, type))
            );
            
            // Verify each code works for its type but not others
            for (let i = 0; i < codeTypes.length; i++) {
                const code = codes[i];
                const type = codeTypes[i];
                
                // Should work for correct type
                const isValid = await onetimeCodeService.verifyCode(user, type, code);
                expect(isValid).toBe(true);
                
                // Should not work for other types
                for (let j = 0; j < codeTypes.length; j++) {
                    if (i !== j) {
                        const otherType = codeTypes[j];
                        const isValid = await onetimeCodeService.verifyCode(user, otherType, code);
                        expect(isValid).toBe(false);
                    }
                }
            }
        });
    });

    describe('code uniqueness', () => {
        it('should ensure unique codes per user and type', async () => {
            const user1 = 'user1';
            const user2 = 'user2';
            const codeType = 'verification';
            
            const code1 = await onetimeCodeService.createCode(user1, codeType);
            const code2 = await onetimeCodeService.createCode(user2, codeType);
            
            // Codes should be different
            expect(code1).not.toBe(code2);
            
            // Verify each code works only for its user
            expect(await onetimeCodeService.verifyCode(user1, codeType, code1)).toBe(true);
            expect(await onetimeCodeService.verifyCode(user2, codeType, code1)).toBe(false);
            expect(await onetimeCodeService.verifyCode(user1, codeType, code2)).toBe(false);
            expect(await onetimeCodeService.verifyCode(user2, codeType, code2)).toBe(true);
        });

        it('should retry on duplicate code generation', async () => {
            const user = 'test_user';
            const codeType = 'verification';
            
            // Create a service with a custom code generator that returns duplicate codes
            const codes = ['duplicate_code', 'duplicate_code', 'unique_code'];
            const service = new OnetimeCodeService(db, {
                collectionName: 'onetime_code',
                ttlLimit: 60 * 10,
                createCodeFn: () => codes.shift()!
            });
            
            // First attempt should succeed
            const code1 = await service.createCode(user, codeType);
            
            // Second attempt should also succeed (with retry)
            const code2 = await service.createCode(user, codeType);
            
            // Verify we have two different codes
            expect(code1).not.toBe(code2);
            const records = await db.collection('onetime_code')
                .find({ owner: user, type: codeType })
                .toArray();
            expect(records).toHaveLength(2);
            expect(records[0].code).not.toBe(records[1].code);
        });

        it('should fail after multiple duplicate code attempts', async () => {
            const user = 'test_user';
            const codeType = 'verification';
            
            // Create a service with a custom code generator that always returns the same code
            const service = new OnetimeCodeService(db, {
                collectionName: 'onetime_code',
                ttlLimit: 60 * 10,
                createCodeFn: () => 'duplicate_code'
            });
            
            // First attempt should succeed
            const code = await service.createCode(user, codeType);
            expect(code).toBe('duplicate_code');
            
            // Second attempt should fail after retries
            await expect(service.createCode(user, codeType))
                .rejects.toThrow('Failed to generate unique code after multiple attempts');
        });
    });
}); 