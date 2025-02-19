import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "json_store" })
export class JsonStoreEntity {
  @PrimaryColumn()
  public key: string;

  @Column({
    type: "jsonb",
  })
  public data: string;

  @Column({
    name: "expirationDate",
    nullable: true,
    type: "timestamp",
  })
  public expirationTimestamp: Date | null | undefined;

  @CreateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  public createdAt: Date;
}
