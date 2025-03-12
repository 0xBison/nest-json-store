# NestJS JSON Store

A simple, persistent JSON key-value store for NestJS applications using TypeORM. Features include:

- Persistent storage of JSON data with string keys
- Optional TTL (Time To Live) for entries
- Automatic JSON serialization/deserialization
- Full TypeScript support

## Installation

```bash
npm install nest-json-store
```

## Configuration

1. First, ensure you have TypeORM configured in your NestJS application. Add the following to your `ormconfig.js` or TypeORM configuration:

```typescript
import { JsonStoreEntity, CreateJsonStore1710000000000 } from 'nest-json-store';

export const config = {
  migrations: [
    __dirname + '/migrations/**/*{.ts,.js}',
    CreateJsonStore1710000000000,
  ],
  entities: [__dirname + '/../**/*.entity{.ts,.js}', JsonStoreEntity],
  // the rest of your config
};
```

2. Import the `JsonStoreModule` in your app module:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JsonStoreModule } from 'nest-json-store';

@Module({
  imports: [
    TypeOrmModule.forRoot(), // Your TypeORM config
    JsonStoreModule,
  ],
})
export class AppModule {}
```

## Usage

### Basic Usage

```typescript
import { Injectable } from '@nestjs/common';
import { JsonStore } from 'nest-json-store';

@Injectable()
export class YourService {
  constructor(private jsonStore: JsonStore) {}

  async saveData() {
    // Store data (never expires)
    await this.jsonStore.set('myKey', { hello: 'world' });
    
    // Store data with 1 hour TTL
    await this.jsonStore.set('expiringKey', { temp: 'data' }, { ttl: 3600 });
    
    // Retrieve data
    const data = await this.jsonStore.get('myKey');
    
    // Delete data
    await this.jsonStore.delete('myKey');
    
    // Clear all data
    await this.jsonStore.clear();
  }
}
```

### Type Safety

The store supports TypeScript generics for type-safe storage and retrieval:

```typescript
interface UserData {
  name: string;
  age: number;
}

// Store typed data
await jsonStore.set<UserData>('user:1', { name: 'John', age: 30 });

// Retrieve with type information
const user = await jsonStore.get<UserData>('user:1');
// user is typed as UserData | undefined
```

### TTL (Time To Live)

- Default TTL is 0 (never expires)
- Set custom TTL in seconds:

```typescript
// Expires in 1 hour
await jsonStore.set('key', value, { ttl: 3600 });

// Never expires (explicit)
await jsonStore.set('key', value, { ttl: 0 });
```

### JsonStore Cleanup Service

#### Why It's Needed

The JsonStore service deletes expired entries only when they are retrieved. This on-demand approach is efficient for frequently accessed and a pre-defined set of keys. But it can lead to database bloat if you have dynamic keys and many expire without being accessed. The JsonStoreCleanupService solves this by periodically removing all expired entries.

#### Usage

To enable automatic cleanup, register the JsonStoreModule with cleanup options:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JsonStoreModule } from 'nest-json-store';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // your database configuration
    }),
    JsonStoreModule.register({
      enableCleanup: true,
      cleanupOptions: {
        interval: 3600, // Run cleanup every hour (in seconds)
        runOnInit: true // Run cleanup when the application starts
      }
    }),
  ],
})
export class AppModule {}
```

#### Configuration Options

The cleanup service accepts the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `interval` | number | 3600 | Time between cleanup runs in seconds |
| `runOnInit` | boolean | true | Whether to run cleanup when the module initializes |

#### Manual Cleanup

You can also inject the cleanup service and trigger cleanup manually:

```typescript
import { Injectable } from '@nestjs/common';
import { JsonStoreCleanupService } from 'nest-json-store';

@Injectable()
export class YourService {
  constructor(private readonly cleanupService: JsonStoreCleanupService) {}

  async performMaintenance() {
    // Manually trigger cleanup
    const deletedCount = await this.cleanupService.cleanup();
    console.log(`Cleaned up ${deletedCount} expired entries`);
  }
}
```

#### Best Practices

- For production environments with many stored keys, always enable the cleanup service
- Set the interval based on your application's needs:
  - Shorter intervals (e.g., 15-30 minutes) for applications with many short-lived keys
  - Longer intervals (e.g., 6-12 hours) for applications with mostly long-lived keys
- Consider running cleanup during off-peak hours if your database is under heavy load

### API Reference

#### `JsonStore`

- `set<T>(key: string, value: T, options?: IJsonStoreKeyOptions): Promise<JsonStoreEntity | false>`
  - Stores a value with the given key
  - Returns false if JSON serialization fails
  - Options:
    - `ttl?: number` - Time to live in seconds (0 = never expires)

- `get<T>(key: string): Promise<T | undefined>`
  - Retrieves a value by key
  - Returns undefined if not found or expired
  - Automatically removes expired entries

- `delete(key: string): Promise<DeleteResult>`
  - Deletes an entry by key
  - Returns undefined if key not found

- `clear(): Promise<DeleteResult>`
  - Removes all entries from the store

#### `JsonStoreCleanupService`

- `cleanup(): Promise<number>`
  - Manually triggers a cleanup of all expired entries
  - Returns the number of deleted entries
  - Useful for on-demand maintenance or scheduled jobs

- `onModuleInit(): Promise<void>`
  - Lifecycle hook that initializes the cleanup schedule
  - Runs cleanup immediately if `runOnInit` is true
  - Sets up the interval-based cleanup schedule

- `onModuleDestroy(): void`
  - Lifecycle hook that cleans up resources
  - Cancels any scheduled cleanup tasks
  - Automatically called when the application shuts down

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.