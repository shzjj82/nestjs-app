import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('uc_users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  username: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, nullable: true })
  email: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 128, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 64, default: '' })
  nickname: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar: string | null;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
