import {Db, Collection} from 'mongodb';
import {MongoService} from '../base';
import {generatePasswordHash, checkPasswordHash} from '../utils/security';

export interface UserServiceOptions {
    collectionName?: string;
}

export type UserRecord = PublicUserRecord & {
    hashed_password: string;
}

export type PublicUserRecord = {
    user: string;
    email: string;
    hashed_password: string;
    verified: boolean;
    createdAt: Date;
}

export class UserService extends MongoService {
    private collection: Collection<UserRecord>;

    constructor(db: Db, options: UserServiceOptions = {}) {
        super(db);
        const {collectionName = 'users'} = options;
        this.collection = this.db.collection<UserRecord>(collectionName);
    }

    async buildIndex(): Promise<void> {
        await this.collection.createIndex('user', {unique: true});
        await this.collection.createIndex('email');
        await this.collection.createIndex('verified');
        await this.collection.createIndex('createdAt');
    }

    async createCollections(): Promise<void> {
        // No special collection creation needed
    }

    async createUser(user: string, email: string, password: string, verified: boolean = false): Promise<string> {
        const doc: UserRecord = {
            user,
            email,
            hashed_password: await generatePasswordHash(password),
            verified,
            createdAt: new Date()
        };
        await this.collection.insertOne(doc);
        return user;
    }

    async updateUserPassword(user: string, password: string): Promise<boolean> {
        const result = await this.collection.updateOne(
            {user},
            {$set: {hashed_password: await generatePasswordHash(password)}}
        );
        return result.modifiedCount > 0;
    }

    async verifyUserPassword(user: string, password: string): Promise<UserRecord | null> {
        const userRecord = await this.collection.findOne(
            {user}
        );
        if (!userRecord) return null;

        const result = await checkPasswordHash(userRecord.hashed_password, password);

        if (result) {
            return userRecord
        } else {
            return null;
        }
    }

    async changeUserEmail(user: string, email: string): Promise<boolean> {
        const result = await this.collection.updateOne(
            {user},
            {$set: {email}}
        );
        return result.modifiedCount > 0;
    }

    async changeUserVerificationStatus(user: string, verificationStatus: boolean): Promise<boolean> {
        const result = await this.collection.updateOne(
            {user},
            {$set: {verified: verificationStatus}}
        );
        return result.modifiedCount > 0;
    }

    async getUser(user: string): Promise<UserRecord | null> {
        return await this.collection.findOne({user});
    }
} 