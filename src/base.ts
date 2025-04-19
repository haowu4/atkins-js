import { Db } from 'mongodb';

export abstract class MongoService {
    protected db: Db;

    constructor(db: Db) {
        this.db = db;
    }

    abstract buildIndex(...args: any[]): Promise<void>;
    abstract createCollections(...args: any[]): Promise<void>;
} 