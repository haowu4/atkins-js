import { Db, Collection } from 'mongodb';
import { MongoService } from '../base';
import { getTimeDuration } from '../utils/time';

export interface UserMembershipServiceOptions {
    collectionName?: string;
}

export interface MembershipUpdateRecord {
    time: Date;
    reason: Record<string, any>;
    action: 'assign' | 'cancel' | 'renew';
}

export interface UserMembershipRecord {
    user: string;
    membership: string;
    updatedAt: Date;
    validUntil: Date;
    history: MembershipUpdateRecord[];
    auto_renew: boolean;
}

export class UserMembershipService extends MongoService {
    private collection: Collection<UserMembershipRecord>;

    constructor(db: Db, options: UserMembershipServiceOptions = {}) {
        super(db);
        const { collectionName = 'user_membership' } = options;
        this.collection = this.db.collection<UserMembershipRecord>(collectionName);
    }

    async buildIndex(): Promise<void> {
        await this.collection.createIndex('user', { unique: true });
        await this.collection.createIndex([{ membership: 1 }, { validUntil: 1 }]);
    }

    async createCollections(): Promise<void> {
        // No special collection creation needed
    }

    async listMembership(user: string): Promise<UserMembershipRecord | null> {
        return await this.collection.findOne({ user });
    }

    async assignMembership(
        user: string,
        membership: string,
        reason: Record<string, any>,
        duration: string = '1y'
    ): Promise<boolean> {
        const now = new Date();
        const validUntil = new Date(now.getTime() + getTimeDuration(duration));

        const updateRecord: MembershipUpdateRecord = {
            time: now,
            reason,
            action: 'assign'
        };

        const result = await this.collection.updateOne(
            { user },
            {
                $set: {
                    membership,
                    updatedAt: now,
                    validUntil,
                    auto_renew: true
                },
                $push: { history: updateRecord }
            },
            { upsert: true }
        );
        return result.modifiedCount > 0 || result.upsertedId !== null;
    }

    async cancelMembership(
        user: string,
        membership: string,
        reason: Record<string, any>
    ): Promise<boolean> {
        const now = new Date();
        const updateRecord: MembershipUpdateRecord = {
            time: now,
            reason,
            action: 'cancel'
        };

        const result = await this.collection.updateOne(
            { user, membership },
            {
                $set: {
                    validUntil: now,
                    auto_renew: false,
                    updatedAt: now
                },
                $push: { history: updateRecord }
            }
        );
        return result.modifiedCount > 0;
    }

    async setMembershipAutoRenewPreference(
        user: string,
        membership: string,
        autoRenewPreference: boolean
    ): Promise<boolean> {
        const result = await this.collection.updateOne(
            { user, membership },
            { $set: { auto_renew: autoRenewPreference } }
        );
        return result.modifiedCount > 0;
    }
} 