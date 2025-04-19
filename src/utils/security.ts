import crypto from 'crypto';

const SALT_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const DEFAULT_PBKDF2_ITERATIONS = 1_000_000;

function genSalt(length: number): string {
    if (length <= 0) {
        throw new Error("Salt length must be at least 1.");
    }

    let salt = "";
    for (let i = 0; i < length; i++) {
        salt += SALT_CHARS[Math.floor(Math.random() * SALT_CHARS.length)];
    }
    return salt;
}

function _hashInternal(method: string, salt: string, password: string): [string, string] {
    const [methodName, ...args] = method.split(":");
    const saltBytes = Buffer.from(salt);
    const passwordBytes = Buffer.from(password);

    if (methodName === "scrypt") {
        let n = 2**15;
        let r = 8;
        let p = 1;

        if (args.length > 0) {
            if (args.length !== 3) {
                throw new Error("'scrypt' takes 3 arguments.");
            }
            [n, r, p] = args.map(Number);
        }

        const maxmem = 132 * n * r * p; // ideally 128, but some extra seems needed
        const hash = crypto.scryptSync(passwordBytes, saltBytes, 32, {
            N: n,
            r: r,
            p: p,
            maxmem: maxmem
        });
        return [hash.toString('hex'), `scrypt:${n}:${r}:${p}`];
    } else if (methodName === "pbkdf2") {
        let hashName = "sha256";
        let iterations = DEFAULT_PBKDF2_ITERATIONS;

        if (args.length === 1) {
            hashName = args[0];
        } else if (args.length === 2) {
            hashName = args[0];
            iterations = parseInt(args[1]);
        } else if (args.length > 2) {
            throw new Error("'pbkdf2' takes 2 arguments.");
        }

        const hash = crypto.pbkdf2Sync(passwordBytes, saltBytes, iterations, 32, hashName);
        return [hash.toString('hex'), `pbkdf2:${hashName}:${iterations}`];
    } else {
        throw new Error(`Invalid hash method '${methodName}'.`);
    }
}

export function generatePasswordHash(
    password: string,
    method: string = "scrypt",
    saltLength: number = 16
): string {
    const salt = genSalt(saltLength);
    const [h, actualMethod] = _hashInternal(method, salt, password);
    return `${actualMethod}$${salt}$${h}`;
}

export function checkPasswordHash(pwhash: string, password: string): boolean {
    try {
        const [method, salt, hashval] = pwhash.split("$", 3);
        const [computedHash] = _hashInternal(method, salt, password);
        return crypto.timingSafeEqual(
            Buffer.from(computedHash),
            Buffer.from(hashval)
        );
    } catch {
        return false;
    }
} 