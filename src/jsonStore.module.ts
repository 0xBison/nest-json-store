import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JsonStore, JsonStoreIdentifier } from "./jsonStore.service";
import { JsonStoreEntity } from "./entities/jsonStore.entity";

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
export class JsonStoreModule {}
