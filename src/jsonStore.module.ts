import { Global, Module, DynamicModule, Provider } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JsonStore, JsonStoreIdentifier } from "./jsonStore.service";
import { JsonStoreEntity } from "./entities/jsonStore.entity";
import {
  CleanupOptions,
  JsonStoreCleanupService,
  JsonStoreCleanupServiceIdentifier,
} from "./jsonStoreCleanup.service";
import { getRepositoryToken } from "@nestjs/typeorm";

export interface JsonStoreModuleOptions {
  /**
   * Enable automatic cleanup of expired entries
   * @default false
   */
  enableCleanup?: boolean;

  /**
   * Options for the cleanup service
   * Only used if enableCleanup is true
   */
  cleanupOptions?: CleanupOptions;
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([JsonStoreEntity])],
  providers: [
    {
      provide: JsonStoreIdentifier,
      useClass: JsonStore,
    },
  ],
  exports: [JsonStoreIdentifier],
})
export class JsonStoreModule {
  /**
   * Register the JsonStore module with optional cleanup service
   */
  static register(options?: JsonStoreModuleOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: JsonStoreIdentifier,
        useClass: JsonStore,
      },
    ];

    if (options?.enableCleanup) {
      providers.push({
        provide: JsonStoreCleanupServiceIdentifier,
        useFactory: (repository: any) =>
          new JsonStoreCleanupService(repository, options.cleanupOptions),
        inject: [getRepositoryToken(JsonStoreEntity)],
      });
    }

    return {
      module: JsonStoreModule,
      imports: [TypeOrmModule.forFeature([JsonStoreEntity])],
      providers,
      exports: [
        JsonStoreIdentifier,
        ...(options?.enableCleanup ? [JsonStoreCleanupServiceIdentifier] : []),
      ],
    };
  }
}
