interface CacheEntry<T> {
	value: T;
	expiresAt: number;
	prev?: CacheEntry<T>;
	next?: CacheEntry<T>;
}

interface LRUCacheOptions {
	maxSize: number;
	ttl: number;
}

export class LRUCache<T> {
	private maxSize: number;
	private ttl: number;
	private cache = new Map<string, CacheEntry<T>>();
	private head?: CacheEntry<T>;
	private tail?: CacheEntry<T>;

	constructor(options: LRUCacheOptions) {
		this.maxSize = options.maxSize;
		this.ttl = options.ttl;
	}

	get(key: string): T | undefined {
		const entry = this.cache.get(key);

		if (!entry) {
			return undefined;
		}

		if (Date.now() > entry.expiresAt) {
			this.delete(key);
			return undefined;
		}

		this.moveToHead(entry);

		return entry.value;
	}

	set(key: string, value: T): void {
		const now = Date.now();
		const expiresAt = now + this.ttl;

		const existingEntry = this.cache.get(key);

		if (existingEntry) {
			existingEntry.value = value;
			existingEntry.expiresAt = expiresAt;
			this.moveToHead(existingEntry);
			return;
		}

		const newEntry: CacheEntry<T> = {
			value,
			expiresAt,
		};

		this.cache.set(key, newEntry);
		this.addToHead(newEntry);

		if (this.cache.size > this.maxSize) {
			this.evictLRU();
		}
	}

	delete(key: string): boolean {
		const entry = this.cache.get(key);

		if (!entry) {
			return false;
		}

		this.cache.delete(key);
		this.removeFromList(entry);

		return true;
	}

	clear(): void {
		this.cache.clear();
		this.head = undefined;
		this.tail = undefined;
	}

	size(): number {
		return this.cache.size;
	}

	has(key: string): boolean {
		const entry = this.cache.get(key);

		if (!entry) {
			return false;
		}

		// Check if entry has expired
		if (Date.now() > entry.expiresAt) {
			this.delete(key);
			return false;
		}

		return true;
	}

	cleanup(): number {
		const now = Date.now();
		const expiredKeys: string[] = [];

		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				expiredKeys.push(key);
			}
		}

		expiredKeys.forEach((key) => this.delete(key));

		return expiredKeys.length;
	}

	private addToHead(entry: CacheEntry<T>): void {
		if (!this.head) {
			this.head = entry;
			this.tail = entry;
			return;
		}

		entry.next = this.head;
		this.head.prev = entry;
		this.head = entry;
	}

	private removeFromList(entry: CacheEntry<T>): void {
		if (entry.prev) {
			entry.prev.next = entry.next;
		} else {
			this.head = entry.next;
		}

		if (entry.next) {
			entry.next.prev = entry.prev;
		} else {
			this.tail = entry.prev;
		}

		entry.prev = undefined;
		entry.next = undefined;
	}

	private moveToHead(entry: CacheEntry<T>): void {
		this.removeFromList(entry);
		this.addToHead(entry);
	}

	private evictLRU(): void {
		if (!this.tail) {
			return;
		}

		const keyToEvict = this.findKeyByEntry(this.tail);
		if (keyToEvict) {
			this.delete(keyToEvict);
		}
	}

	private findKeyByEntry(targetEntry: CacheEntry<T>): string | undefined {
		for (const [key, entry] of this.cache.entries()) {
			if (entry === targetEntry) {
				return key;
			}
		}
		return undefined;
	}
}
