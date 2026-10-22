import { createHmac, randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';

export type Limit = {
  name: string;
  identity: string;
  limit: number;
  ttl: number;
};
const INCREMENT = `local wait = 0
for i,key in ipairs(KEYS) do
 local count = redis.call('INCR', key)
 local ttl = redis.call('PTTL', key)
 if ttl < 0 then redis.call('PEXPIRE', key, ARGV[i*2]); ttl = tonumber(ARGV[i*2]) end
 if count > tonumber(ARGV[i*2-1]) then wait = math.max(wait, ttl) end
end
return wait`;
const RELEASE =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";
export function positiveEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`Invalid ${name}`);
  return parsed;
}
export class RateLimiter {
  private redis?: Redis;
  private fallback = new Map<string, { count: number; until: number }>();
  private degraded = false;
  constructor(private readonly secret: string) {
    if (process.env.REDIS_URL) {
      const url = new URL(process.env.REDIS_URL);
      if (!['redis:', 'rediss:'].includes(url.protocol))
        throw new Error('Invalid REDIS_URL');
      if (process.env.NODE_ENV === 'production' && !url.password)
        throw new Error('Redis authentication is required in production');
      this.redis = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        connectTimeout: 500,
        commandTimeout: 500,
        maxRetriesPerRequest: 0,
        enableOfflineQueue: false,
        retryStrategy: () => 5000,
      });
      this.redis.on('error', () => {}); // Never log Redis URLs or credentials.
      void this.redis.connect().catch(() => {});
    } else if (process.env.NODE_ENV === 'production')
      throw new Error('REDIS_URL is required in production');
  }
  key(name: string, identity: string) {
    return `security:${process.env.NODE_ENV ?? 'development'}:${name}:${createHmac('sha256', this.secret).update(identity).digest('hex')}`;
  }
  private state(degraded: boolean) {
    if (degraded !== this.degraded) {
      this.degraded = degraded;
      console.warn(
        JSON.stringify({
          event: degraded ? 'rate_limit_degraded' : 'rate_limit_recovered',
        }),
      );
    }
  }
  private local(limits: Limit[]) {
    const now = Date.now();
    for (const [key, entry] of this.fallback)
      if (entry.until <= now) this.fallback.delete(key);
    let wait = 0;
    for (const rule of limits) {
      const key = this.key(rule.name, rule.identity);
      let entry = this.fallback.get(key);
      if (!entry) {
        if (this.fallback.size >= 10000) {
          wait = Math.max(wait, 60000);
          continue;
        }
        entry = { count: 0, until: now + rule.ttl };
        this.fallback.set(key, entry);
      }
      if (++entry.count > rule.limit) wait = Math.max(wait, entry.until - now);
    }
    return wait;
  }
  async consume(
    limits: Limit[],
    sensitive: boolean,
  ): Promise<{ wait: number; unavailable: boolean }> {
    try {
      if (!this.redis || this.redis.status !== 'ready')
        throw new Error('unavailable');
      const wait = Number(
        await this.redis.eval(
          INCREMENT,
          limits.length,
          ...limits.map((r) => this.key(r.name, r.identity)),
          ...limits.flatMap((r) => [r.limit, r.ttl]),
        ),
      );
      this.state(false);
      return { wait, unavailable: false };
    } catch {
      this.state(true);
      return {
        wait: sensitive ? 0 : this.local(limits),
        unavailable: sensitive,
      };
    }
  }
  async importLock(
    admin: string,
  ): Promise<{ release: () => Promise<void>; busy: boolean }> {
    const key = this.key('import-lock', admin);
    const token = randomUUID();
    if (!this.redis || this.redis.status !== 'ready')
      throw new Error('unavailable');
    const result = await this.redis.set(key, token, 'PX', 120000, 'NX');
    return {
      busy: result !== 'OK',
      release: async () => {
        await this.redis?.eval(RELEASE, 1, key, token);
      },
    };
  }
  async close() {
    this.redis?.disconnect();
  }
}
