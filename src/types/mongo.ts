import { Db, Collection } from 'mongodb';

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

export interface UserRecord {
    user: string;
    email: string;
    hashed_password: string;
    verified: boolean;
    createdAt: Date;
}

export interface RedeemCodeRecord {
    creator: string;
    code: string;
    code_type: string;
    used: boolean;
    createdAt: Date;
    updatedAt?: Date;
    status: 'issued' | 'used' | 'expired' | 'processing' | 'error';
    request?: Record<string, any>;
    response?: Record<string, any>;
    error?: Record<string, any>;
}

export interface ActivityLogRecord {
    user: string;
    target: string;
    createdAt: Date;
    [key: string]: any;
}

export interface OneTimeCodeRecord {
    owner: string;
    type: string;
    code: string;
    createdAt: Date;
} 