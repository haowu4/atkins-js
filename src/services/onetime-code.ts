import { Db, Collection } from 'mongodb';
import { MongoService } from '../base';
import { randomBytes } from 'crypto';

export interface OnetimeCodeServiceOptions {
    collectionName?: string;
    ttlLimit?: number;
    createCodeFn?: () => string;
}

export interface OnetimeCodeRecord {
    owner: string;
    type: string;
    code: string;
    createdAt: Date;
}

function createSecureCode(): string {
    return randomBytes(16).toString('hex');
}

export class OnetimeCodeService extends MongoService {
    private collection: Collection<OnetimeCodeRecord>;
    private ttlLimit: number;
    private createCodeFn: () => string;

    constructor(db: Db, options: OnetimeCodeServiceOptions = {}) {
        super(db);
        const {
            collectionName = 'onetime_code',
            ttlLimit = 60 * 10, // 10 minutes
            createCodeFn = createSecureCode
        } = options;
        
        this.collection = this.db.collection(collectionName);
        this.ttlLimit = ttlLimit;
        this.createCodeFn = createCodeFn;
    }

    async buildIndex(): Promise<void> {
        await this.collection.createIndex(
            [
                { owner: 1 },
                { type: 1 },
                { code: 1 }
            ],
            { unique: true }
        );
        await this.collection.createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: this.ttlLimit }
        );
    }

    async createCollections(): Promise<void> {
        // No additional collections needed
    }

    async createCode(user: string, codeType: string): Promise<string> {
        const maxAttempts = 3;
        for (let i = 0; i < maxAttempts; i++) {
            const code = this.createCodeFn();
            try {
                await this.collection.insertOne({
                    owner: user,
                    type: codeType,
                    code: code,
                    createdAt: new Date()
                });
                return code;
            } catch (error) {
                if (i === maxAttempts - 1) {
                    throw new Error('Failed to generate unique code after multiple attempts');
                }
                continue;
            }
        }
        throw new Error('Failed to generate unique code after multiple attempts');
    }

    async verifyCode(user: string, codeType: string, code: string): Promise<boolean> {
        const record = await this.collection.findOne({
            owner: user,
            type: codeType,
            code: code
        });

        if (!record) {
            return false;
        }

        const now = new Date();
        const createdAt = record.createdAt;
        const timeDiff = now.getTime() - createdAt.getTime();
        
        return timeDiff <= this.ttlLimit * 1000;
    }

    async consumeCode(user: string, codeType: string, code: string): Promise<boolean> {
        const result = await this.collection.findOneAndDelete({
            owner: user,
            type: codeType,
            code: code
        });
        return result !== null;
    }
} 