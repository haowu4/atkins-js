import { Db, Collection } from 'mongodb';
import { MongoService } from '../base';
import { randomBytes } from 'crypto';

export interface RedeemCodeServiceOptions {
    collectionName?: string;
}

export interface RedeemCodeRecord {
    creator: string;
    code: string;
    code_type: string;  // Indicates which product this code can redeem

    used: boolean;
    createdAt: Date;
    updatedAt?: Date;
    
    status: 'issued' | 'used' | 'expired' | 'processing' | 'error';
    
    request?: Record<string, any>;
    response?: Record<string, any>;
    error?: Record<string, any>;
}

function insertDashes(input: string): string {
    return input.match(/.{1,4}/g)?.join('-') || '';
}

export class RedeemCodeService extends MongoService {
    private collection: Collection<RedeemCodeRecord>;

    constructor(db: Db, options: RedeemCodeServiceOptions = {}) {
        super(db);
        const { collectionName = 'redeem_codes' } = options;
        this.collection = this.db.collection<RedeemCodeRecord>(collectionName);
    }

    async buildIndex(): Promise<void> {
        await this.collection.createIndex('code', { unique: true });
        await this.collection.createIndex('creator');
        await this.collection.createIndex('createdAt');
        await this.collection.createIndex('status');
    }

    async createCollections(): Promise<void> {
        // No special collection creation needed
    }

    static generateSecureCode(length: number = 16): string {
        const hex = randomBytes(length).toString('hex');
        return insertDashes(hex);
    }

    async createCodes(codes: string[], codeType: string, creator: string): Promise<RedeemCodeRecord[]> {
        if (codes.length === 0) {
            return [];
        }

        const docs: RedeemCodeRecord[] = codes.map(code => ({
            code,
            code_type: codeType,
            creator,
            used: false,
            createdAt: new Date(),
            updatedAt: undefined,
            status: 'issued',
            request: undefined,
            response: undefined,
            error: undefined
        }));

        await this.collection.insertMany(docs);
        return docs;
    }

    async createCode(code: string, codeType: string, creator: string): Promise<string> {
        const doc: RedeemCodeRecord = {
            code,
            code_type: codeType,
            creator,
            used: false,
            createdAt: new Date(),
            updatedAt: undefined,
            status: 'issued',
            request: undefined,
            response: undefined,
            error: undefined
        };

        await this.collection.insertOne(doc);
        return code;
    }

    async startProcessingCode(code: string, request: Record<string, any>): Promise<boolean> {
        const updateData: Partial<RedeemCodeRecord> = {
            status: 'processing',
            request,
            updatedAt: new Date()
        };

        const result = await this.collection.updateOne(
            { code },
            { $set: updateData }
        );
        return result.modifiedCount > 0;
    }

    async markProcessingFailed(code: string, errorMsg: Record<string, any>): Promise<boolean> {
        const updateData: Partial<RedeemCodeRecord> = {
            status: 'error',
            error: errorMsg,
            updatedAt: new Date()
        };

        const result = await this.collection.updateOne(
            { code },
            { $set: updateData }
        );
        return result.modifiedCount > 0;
    }

    async markProcessingDone(code: string, response: Record<string, any>): Promise<boolean> {
        const updateData: Partial<RedeemCodeRecord> = {
            status: 'used',
            response,
            updatedAt: new Date()
        };

        const result = await this.collection.updateOne(
            { code },
            { $set: updateData }
        );
        return result.modifiedCount > 0;
    }

    async getCode(code: string): Promise<RedeemCodeRecord | null> {
        return await this.collection.findOne({ code });
    }

    async listCodesByCreator(creator: string, skip: number = 0, limit: number = 100): Promise<RedeemCodeRecord[]> {
        const cursor = this.collection
            .find({ creator })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        return await cursor.toArray();
    }
} 