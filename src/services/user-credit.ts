import { Db, Collection } from 'mongodb';
import { MongoService } from '../base';

export interface CreditUpdateRecord {
    time: Date;
    reason: Record<string, any>;
    amount: number;
}

export interface UserCreditRecord {
    user: string;
    credit: number;
    updatedAt: Date;
    history: CreditUpdateRecord[];
}

export class UserCreditService extends MongoService {
    private collection: Collection<UserCreditRecord>;

    constructor(db: Db, collectionName: string = 'user_credit') {
        super(db);
        this.collection = this.db.collection<UserCreditRecord>(collectionName);
    }

    async buildIndex(): Promise<void> {
        await this.collection.createIndex('user', { unique: true });
    }

    async createCollections(): Promise<void> {
        // No special collection creation needed
    }

    async getCredit(user: string): Promise<UserCreditRecord | null> {
        return await this.collection.findOne({ user });
    }

    async addCredit(user: string, amount: number, reason: Record<string, any>): Promise<boolean> {
        const now = new Date();
        const updateRecord: CreditUpdateRecord = {
            time: now,
            reason,
            amount
        };

        const result = await this.collection.updateOne(
            { user },
            {
                $inc: { credit: amount },
                $set: { updatedAt: now },
                $push: { history: updateRecord }
            },
            { upsert: true }
        );
        return result.modifiedCount > 0 || result.upsertedId !== null;
    }

    async minusCredit(user: string, amount: number, reason: Record<string, any>): Promise<boolean> {
        const now = new Date();
        const updateRecord: CreditUpdateRecord = {
            time: now,
            reason,
            amount: -amount
        };

        const result = await this.collection.updateOne(
            { user },
            {
                $inc: { credit: -amount },
                $set: { updatedAt: now },
                $push: { history: updateRecord }
            },
            { upsert: true }
        );
        return result.modifiedCount > 0 || result.upsertedId !== null;
    }
} 