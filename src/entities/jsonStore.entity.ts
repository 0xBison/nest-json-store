import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "json_store" })
export class JsonStoreEntity {
  @PrimaryColumn({ name: "key" })
  public key: string;

  @Column({
    name: "data",
    type: "jsonb",
  })
  public data: string;

  @Column({
    name: "expiration_date",
    nullable: true,
    type: "timestamp",
  })
  public expirationTimestamp: Date | null | undefined;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  public createdAt: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  public updatedAt: Date;
}
