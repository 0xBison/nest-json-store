import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JsonStoreEntity } from "./entities/jsonStore.entity";

export const DEFAULT_TTL = 0; // 0 means never expires

export interface IJsonStoreKeyOptions {
  /** Time to live in seconds. 0 means never expires */
  ttl?: number;
}

export const JsonStoreIdentifier = "JsonStoreIdentifier";

@Injectable()
export class JsonStore {
  protected readonly logger: Logger = new Logger(JsonStore.name);

  constructor(
    @InjectRepository(JsonStoreEntity)
    private jsonStoreRepository: Repository<JsonStoreEntity>
  ) {}

  /**
   * Gets a value from the store by key
   * @param key The key to retrieve
   * @returns The stored value cast to type T, or undefined if not found or expired
   */
  async get<T>(key: string): Promise<T | undefined> {
    const storeEntry = await this.jsonStoreRepository.findOne({
      where: { key },
    });
    if (!storeEntry) return undefined;

    // Check expiration only if TTL was set (expiration date is in the past)
    if (
      storeEntry.expirationTimestamp &&
      storeEntry.expirationTimestamp.getTime() < Date.now()
    ) {
      await this.jsonStoreRepository.delete({ key });
      return undefined;
    }

    return JSON.parse(storeEntry.data) as T;
  }

  /**
   * Stores a value in the store
   * @param key The key under which to store the value
   * @param value The value to store (must be JSON serializable)
   * @param options Storage options including TTL
   * @returns The created/updated store entry or false if serialization failed
   */
  async set<T>(key: string, value: T, options?: IJsonStoreKeyOptions) {
    const { ttl = DEFAULT_TTL } = options || {};

    let jsonValue: string;
    try {
      jsonValue = JSON.stringify(value);
    } catch (e) {
      this.logger.error(`Failed to JSON.stringify value for key '${key}'`, e);
      return false;
    }

    const newStoreEntry = new JsonStoreEntity();
    newStoreEntry.data = jsonValue;
    newStoreEntry.key = key;
    // Only set expiration if TTL > 0
    newStoreEntry.expirationTimestamp =
      ttl > 0 ? new Date(Date.now() + ttl * 1000) : undefined;

    return this.jsonStoreRepository.save(newStoreEntry);
  }

  /**
   * Deletes a key from the store
   * @param key The key to delete
   * @returns The deletion result or undefined if key not found
   */
  async delete(key: string) {
    const foundItem = await this.jsonStoreRepository.findOne({
      where: { key },
    });
    if (!foundItem) return undefined;
    return this.jsonStoreRepository.delete({ key });
  }

  /**
   * Removes all entries from the store
   * @returns The deletion result
   */
  async clear() {
    return this.jsonStoreRepository.delete({});
  }
}
