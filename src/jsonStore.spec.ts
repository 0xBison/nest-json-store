import {
  beforeAll,
  describe,
  expect,
  jest,
  it,
  beforeEach,
} from "@jest/globals";
import { JsonStore } from "./jsonStore.service";
import { JsonStoreEntity } from "./entities/jsonStore.entity";

const createStoreEntity = (overrides: Partial<JsonStoreEntity> = {}) => {
  const storeItem = new JsonStoreEntity();
  storeItem.data = JSON.stringify({ a: "b" });
  storeItem.key = "someKey";
  storeItem.expirationTimestamp = null;
  storeItem.createdAt = new Date();
  storeItem.updatedAt = new Date();
  return Object.assign(storeItem, overrides);
};

describe("jsonStore", () => {
  let jsonStore: JsonStore, mockRepository: any;

  beforeAll(async () => {
    mockRepository = {
      findOne: jest.fn(async (query: any) => {
        const key = query.where.key;

        if (key === "existingKey")
          return createStoreEntity({ key: "existingKey" });

        if (key === "expiredKey")
          return createStoreEntity({
            key: "expiredKey",
            expirationTimestamp: new Date(Date.now() - 1000),
          });

        if (key === "nonExpiringKey")
          return createStoreEntity({
            key: "nonExpiringKey",
            expirationTimestamp: null,
          });

        return undefined;
      }),
      save: jest.fn(async (storeEntity: JsonStoreEntity) => {
        // Simulate TypeORM's behavior of updating the updatedAt field
        if (!storeEntity.updatedAt) {
          storeEntity.updatedAt = new Date();
        }
        return storeEntity;
      }),
      delete: jest.fn(async () => true),
    };
    jsonStore = new JsonStore(mockRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("set (setting a value into the store)", () => {
    it("stores a value with no expiration when TTL=0 (default)", async () => {
      await jsonStore.set("key", { a: "b" });
      expect(
        mockRepository.save.mock.lastCall[0].expirationTimestamp
      ).toBeUndefined();
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it("stores a value with no expiration when TTL=0 (explicit)", async () => {
      await jsonStore.set("key", { a: "b" }, { ttl: 0 });
      expect(
        mockRepository.save.mock.lastCall[0].expirationTimestamp
      ).toBeUndefined();
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it("stores a value with expiration when TTL>0", async () => {
      const ttl = 100;
      await jsonStore.set("key", { a: "b" }, { ttl });
      const savedExpiration =
        mockRepository.save.mock.lastCall[0].expirationTimestamp.getTime();
      const expectedExpiration = Date.now() + ttl * 1000;
      expect(Math.abs(savedExpiration - expectedExpiration)).toBeLessThan(100); // Allow 100ms difference
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it("handles non-JSON-serializable values", async () => {
      const circular = { a: {} };
      circular.a = circular;
      const result = await jsonStore.set("key", circular);
      expect(result).toBe(false);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it("sets updatedAt field when saving an entity", async () => {
      const result = await jsonStore.set("key", { a: "b" });
      // @ts-ignore
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it("stores primitive values correctly", async () => {
      // Test with different primitive types
      const testCases = [
        { key: "string-value", value: "just a string" },
        { key: "number-value", value: 12345 },
        { key: "boolean-value", value: true },
        { key: "null-value", value: null },
      ];

      for (const { key, value } of testCases) {
        jest.clearAllMocks();
        const result = await jsonStore.set(key, value);

        // Verify the value was JSON stringified correctly
        expect(mockRepository.save).toHaveBeenCalledTimes(1);
        expect(mockRepository.save.mock.calls[0][0].data).toBe(value);

        // Verify we can retrieve and parse it back
        mockRepository.findOne.mockResolvedValueOnce(
          createStoreEntity({ key, data: JSON.stringify(value) })
        );
        const retrieved = await jsonStore.get(key);
        expect(retrieved).toEqual(value);
      }
    });
  });

  describe("get (getting a value from the store)", () => {
    it("returns the value for a non-expiring key", async () => {
      const result = await jsonStore.get("nonExpiringKey");
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ a: "b" });
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it("returns the value for an existing key", async () => {
      const result = await jsonStore.get("existingKey");
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ a: "b" });
    });

    it("returns undefined if the key does not exist", async () => {
      const result = await jsonStore.get("someKey");
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it("returns undefined and deletes if the value is expired", async () => {
      const result = await jsonStore.get("expiredKey");
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
      expect(mockRepository.delete).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });
  });

  describe("delete (deletes a key from the store)", () => {
    it("returns undefined if the key does not exist", async () => {
      const result = await jsonStore.delete("someKey");
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
      expect(mockRepository.delete).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("deletes the value if it exists", async () => {
      const result = await jsonStore.delete("existingKey");
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
      expect(mockRepository.delete).toHaveBeenCalledTimes(1);
      expect(result).toBeTruthy();
    });
  });

  describe("clear (clears the store)", () => {
    it("deletes all entries from the store", async () => {
      const result = await jsonStore.clear();
      expect(mockRepository.delete).toHaveBeenCalledTimes(1);
      expect(mockRepository.delete).toHaveBeenCalledWith({});
      expect(result).toBeTruthy();
    });
  });

  describe("update behavior", () => {
    it("updates the updatedAt timestamp when modifying an existing entry", async () => {
      // Setup: Mock repository to simulate an existing entry
      const initialDate = new Date(Date.now() - 10000); // 10 seconds ago
      const existingEntry = createStoreEntity({
        key: "updateTestKey",
        updatedAt: initialDate,
        createdAt: initialDate,
      });

      // @ts-ignore
      mockRepository.findOne = jest.fn().mockResolvedValueOnce(existingEntry);

      // Simulate TypeORM's behavior of updating the entity
      mockRepository.save = jest.fn().mockImplementation((entity) => {
        // @ts-ignore
        entity.updatedAt = new Date(); // TypeORM would update this
        return entity;
      });

      // Act: Update the entry
      await jsonStore.set("updateTestKey", { updated: true });

      // Assert: updatedAt should be newer than the initial date
      const savedEntity = mockRepository.save.mock.calls[0][0];
      expect(savedEntity.updatedAt.getTime()).toBeGreaterThan(
        initialDate.getTime()
      );
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });
  });
});
