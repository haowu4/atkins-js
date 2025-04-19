import { Db, Collection } from 'mongodb';
import { MongoService } from '../base';
import { getTimeDuration } from '../utils/time';

export interface ActivityLoggerOptions {
    useTtl?: boolean;
    useCappedColl?: boolean;
    cappedCollSize?: number;
    cappedCollRecords?: number;
    ttlSeconds?: number;
    collectionName?: string;
}

export interface ActivityLogRecord {
    user: string;
    target: string;
    createdAt: Date;
    meta?: Record<string, any>;
}

export class ActivityLoggerService extends MongoService {
    private collection: Collection<ActivityLogRecord>;
    private useTtl: boolean;
    private useCappedColl: boolean;
    private cappedCollSize: number;
    private cappedCollRecords: number;
    private ttlSeconds: number;
    private collectionName: string;

    constructor(
        db: Db,
        options: ActivityLoggerOptions = {}
    ) {
        super(db);
        
        const {
            useTtl = true,
            useCappedColl = false,
            cappedCollSize = 1024 * 1024 * 1024, // 1GB
            cappedCollRecords = 1000,
            ttlSeconds = 60 * 60 * 24 * 10, // 10 days
            collectionName = 'activity_logs'
        } = options;

        this.collectionName = collectionName;
        this.collection = this.db.collection<ActivityLogRecord>(collectionName);
        this.useTtl = useTtl;
        this.useCappedColl = useCappedColl;
        this.cappedCollSize = cappedCollSize;
        this.cappedCollRecords = cappedCollRecords;
        this.ttlSeconds = ttlSeconds;

        if (useTtl && useCappedColl) {
            throw new Error('TTL and Capped collections cannot be used at the same time.');
        }
    }

    async buildIndex(): Promise<void> {
        const options: any = {};
        if (this.useTtl) {
            options.expireAfterSeconds = this.ttlSeconds;
        }
        await this.collection.createIndex(
            { createdAt: 1 },
            options
        );
    }

    async createCollections(): Promise<void> {
        const options: any = {};
        
        if (this.useCappedColl) {
            options.capped = true;
            options.size = this.cappedCollSize;
            options.max = this.cappedCollRecords;
            await this.db.createCollection(this.collectionName, options);
        }
        
        this.collection = this.db.collection<ActivityLogRecord>(this.collectionName);
    }

    async logActivity(user: string, target: string, meta?: Record<string, any>): Promise<void> {
        const doc: ActivityLogRecord = {
            user,
            target,
            createdAt: new Date(),
            ...(meta && { meta })
        };

        await this.collection.insertOne(doc);
    }

    async fetchLogs(endDate: Date = new Date(), period: string = '10d'): Promise<ActivityLogRecord[]> {
        const startDate = new Date(endDate.getTime() - getTimeDuration(period));
        
        const query = {
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        };

        const cursor = this.collection.find(query).sort({ createdAt: -1 });
        return await cursor.toArray();
    }
} 