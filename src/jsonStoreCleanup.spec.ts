import {
  beforeAll,
  describe,
  expect,
  jest,
  it,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { JsonStoreCleanupService } from "./jsonStoreCleanup.service";
import { JsonStoreEntity } from "./entities/jsonStore.entity";
import { DeleteResult, Repository } from "typeorm";

describe("JsonStoreCleanupService", () => {
  let cleanupService: JsonStoreCleanupService;
  let mockRepository: any;
  let mockLogger: any;

  // Store the interval callback
  let intervalCallback: Function;
  // Create a fake timer ID (number is fine for testing)
  const fakeTimerId = 123 as unknown as NodeJS.Timeout;

  // Store original functions
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;

  beforeAll(() => {
    // Properly type the mock implementations
    global.setInterval = jest.fn((callback: () => void, ms: number) => {
      intervalCallback = callback;
      return fakeTimerId;
    }) as unknown as typeof global.setInterval;

    global.clearInterval = jest.fn() as unknown as typeof global.clearInterval;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    // Create mock repository with proper TypeORM return type
    const deleteResult = { affected: 0 } as DeleteResult;
    mockRepository = {
      // @ts-ignore
      delete: jest.fn().mockResolvedValue(deleteResult),
    };

    // Create the service with default options
    cleanupService = new JsonStoreCleanupService(
      mockRepository as unknown as Repository<JsonStoreEntity>
    );

    // Replace the logger with a mock
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
    };
    (cleanupService as any).logger = mockLogger;
  });

  afterAll(() => {
    // Restore original functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  describe("initialization", () => {
    it("should set default options when none provided", () => {
      const service = new JsonStoreCleanupService(
        mockRepository as unknown as Repository<JsonStoreEntity>
      );
      expect((service as any).options).toEqual({
        interval: 3600,
        runOnInit: true,
      });
    });

    it("should use provided options", () => {
      const options = { interval: 1800, runOnInit: false };
      const service = new JsonStoreCleanupService(
        mockRepository as unknown as Repository<JsonStoreEntity>,
        options
      );
      expect((service as any).options).toEqual(options);
    });

    it("should merge partial options with defaults", () => {
      const service = new JsonStoreCleanupService(
        mockRepository as unknown as Repository<JsonStoreEntity>,
        {
          interval: 1800,
        }
      );
      expect((service as any).options).toEqual({
        interval: 1800,
        runOnInit: true,
      });
    });
  });

  describe("onModuleInit", () => {
    it("should run cleanup immediately when runOnInit is true", async () => {
      const cleanupSpy = jest
        .spyOn(cleanupService, "cleanup")
        .mockResolvedValue(0);
      await cleanupService.onModuleInit();

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
      expect(global.setInterval).toHaveBeenCalledTimes(1);
      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        3600 * 1000
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Scheduled cleanup every 3600 seconds"
      );
    });

    it("should not run cleanup immediately when runOnInit is false", async () => {
      const service = new JsonStoreCleanupService(
        mockRepository as unknown as Repository<JsonStoreEntity>,
        {
          runOnInit: false,
        }
      );
      (service as any).logger = mockLogger;

      const cleanupSpy = jest.spyOn(service, "cleanup").mockResolvedValue(0);
      await service.onModuleInit();

      expect(cleanupSpy).not.toHaveBeenCalled();
      expect(global.setInterval).toHaveBeenCalledTimes(1);
    });

    it("should schedule cleanup with the specified interval", async () => {
      const service = new JsonStoreCleanupService(
        mockRepository as unknown as Repository<JsonStoreEntity>,
        {
          interval: 1800,
        }
      );
      (service as any).logger = mockLogger;

      jest.spyOn(service, "cleanup").mockResolvedValue(0);
      await service.onModuleInit();

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        1800 * 1000
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Scheduled cleanup every 1800 seconds"
      );
    });
  });

  describe("onModuleDestroy", () => {
    it("should clear the interval when destroyed", async () => {
      // Set the intervalId directly to avoid TypeScript errors
      await cleanupService.onModuleInit();
      (cleanupService as any).intervalId = fakeTimerId;
      cleanupService.onModuleDestroy();

      expect(global.clearInterval).toHaveBeenCalledWith(fakeTimerId);
      expect((cleanupService as any).intervalId).toBeNull();
    });

    it("should not attempt to clear interval if not set", () => {
      (cleanupService as any).intervalId = null;
      cleanupService.onModuleDestroy();

      expect(global.clearInterval).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should delete expired entries", async () => {
      mockRepository.delete.mockResolvedValue({ affected: 5 } as DeleteResult);

      const result = await cleanupService.cleanup();

      expect(result).toBe(5);
      expect(mockRepository.delete).toHaveBeenCalledWith({
        expirationTimestamp: expect.any(Object), // LessThan(now)
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Cleaned up 5 expired entries"
      );
    });

    it("should not log when no entries were deleted", async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 } as DeleteResult);

      const result = await cleanupService.cleanup();

      expect(result).toBe(0);
      expect(mockRepository.delete).toHaveBeenCalled();
      expect(mockLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining("Cleaned up")
      );
    });

    it("should handle errors during cleanup", async () => {
      const error = new Error("Database error");
      mockRepository.delete.mockRejectedValue(error);

      await expect(cleanupService.cleanup()).rejects.toThrow("Database error");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to clean up expired entries",
        error
      );
    });

    it("should run scheduled cleanup when interval triggers", async () => {
      // Setup
      mockRepository.delete.mockResolvedValue({ affected: 3 } as DeleteResult);
      const cleanupSpy = jest.spyOn(cleanupService, "cleanup");

      // Initialize to set up the interval
      await cleanupService.onModuleInit();

      // Reset the spy to clear the initial call
      cleanupSpy.mockClear();

      // Trigger the interval callback
      await intervalCallback();

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Cleaned up 3 expired entries"
      );
    });

    it("should handle errors in scheduled cleanup", async () => {
      // Setup
      const error = new Error("Scheduled cleanup error");

      // Mock the cleanup method to reject with our error
      // but do it AFTER we've set up the interval
      let cleanupSpy: any;

      // Initialize to set up the interval first
      await cleanupService.onModuleInit();

      // Now mock the cleanup method to throw
      cleanupSpy = jest
        .spyOn(cleanupService, "cleanup")
        .mockRejectedValue(error);

      // Trigger the interval callback and catch any errors
      try {
        await intervalCallback();
      } catch (e) {
        // Ignore the error - we expect it to be caught by the service
      }

      // Verify the error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error during scheduled cleanup",
        error
      );
    });
  });
});
