import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { JsonStoreEntity } from "./entities/jsonStore.entity";

export interface CleanupOptions {
  /**
   * Interval in seconds between cleanup runs
   * @default 3600 (1 hour)
   */
  interval?: number;

  /**
   * Whether to run cleanup on module initialization
   * @default true
   */
  runOnInit?: boolean;
}

export const JsonStoreCleanupServiceIdentifier =
  "JsonStoreCleanupServiceIdentifier";

@Injectable()
export class JsonStoreCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JsonStoreCleanupService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private readonly options: Required<CleanupOptions>;

  constructor(
    @InjectRepository(JsonStoreEntity)
    private readonly jsonStoreRepository: Repository<JsonStoreEntity>,
    options?: CleanupOptions
  ) {
    // Set default options
    this.options = {
      interval: options?.interval ?? 3600, // Default: 1 hour
      runOnInit: options?.runOnInit ?? true,
    };
  }

  async onModuleInit() {
    if (this.options.runOnInit) {
      await this.cleanup();
    }

    // Schedule periodic cleanup
    this.intervalId = setInterval(() => {
      this.cleanup().catch((err) => {
        this.logger.error("Error during scheduled cleanup", err);
      });
    }, this.options.interval * 1000);

    this.logger.log(`Scheduled cleanup every ${this.options.interval} seconds`);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Manually trigger a cleanup of expired entries
   * @returns The number of deleted entries
   */
  async cleanup(): Promise<number> {
    const now = new Date();

    try {
      // Find and delete expired entries
      const result = await this.jsonStoreRepository.delete({
        expirationTimestamp: LessThan(now),
      });

      const deletedCount = result.affected || 0;
      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} expired entries`);
      }

      return deletedCount;
    } catch (error) {
      this.logger.error("Failed to clean up expired entries", error);
      throw error;
    }
  }
}
