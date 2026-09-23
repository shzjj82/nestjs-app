import { Injectable } from '@nestjs/common';
import type { CreateUserDto, User } from '@app/common';

@Injectable()
export class UsercenterService {
  private readonly users = new Map<string, User>([
    ['u-1', { id: 'u-1', name: 'Alice', email: 'alice@example.com' }],
    ['u-2', { id: 'u-2', name: 'Bob', email: 'bob@example.com' }],
  ]);

  health() {
    return { status: 'ok' };
  }

  findAll(): User[] {
    return [...this.users.values()];
  }

  findOne(id: string): User | null {
    return this.users.get(id) ?? null;
  }

  create(dto: CreateUserDto): User {
    const user: User = {
      id: `u-${Date.now()}`,
      name: dto.name.trim(),
      email: dto.email.trim(),
    };
    this.users.set(user.id, user);
    return user;
  }
}
