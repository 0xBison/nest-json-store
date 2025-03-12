import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateJsonStore1710000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "json_store",
        columns: [
          {
            name: "key",
            type: "varchar",
            isPrimary: true,
          },
          {
            name: "data",
            type: "jsonb",
          },
          {
            name: "expiration_date",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP(6)",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP(6)",
          },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("json_store");
  }
}
