import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('ag_prompts')
export class PromptEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'text' })
  body: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
