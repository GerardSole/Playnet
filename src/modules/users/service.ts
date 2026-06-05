import { ConflictError, NotFoundError } from '../../shared/errors/AppError';
import type { UsersRepository } from './repository';
import type { User } from './types';
import type { CreateUserDto } from './dto';

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const taken = await this.usersRepository.existsByEmailOrUsername(dto.email, dto.username);
    if (taken) {
      throw new ConflictError('Email or username already in use');
    }
    return this.usersRepository.create(dto);
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }
}
