import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import type { FriendsRepository } from './repository';
import type { FriendRequest, FriendProfile } from './types';
import type { SendRequestDto, RespondRequestDto } from './dto';

export class FriendsService {
  constructor(private readonly repo: FriendsRepository) {}

  async sendRequest(senderId: string, dto: SendRequestDto): Promise<FriendRequest> {
    const { targetUserId } = dto;

    if (senderId === targetUserId) {
      throw new ValidationError('Cannot send a friend request to yourself');
    }

    if (await this.repo.isFriends(senderId, targetUserId)) {
      throw new ConflictError('Already friends with this user');
    }

    const pending = await this.repo.findPendingBetween(senderId, targetUserId);
    if (pending) {
      // Tell the user whether they or the other side already sent a request
      if (pending.receiverId === senderId) {
        throw new ConflictError('This user already sent you a friend request — accept or reject it');
      }
      throw new ConflictError('Friend request already sent');
    }

    // createRequest returns null when a non-rejected conflicting request exists (race condition)
    const request = await this.repo.createRequest(senderId, targetUserId);
    if (!request) {
      throw new ConflictError('Friend request already exists');
    }

    return request;
  }

  async acceptRequest(userId: string, dto: RespondRequestDto): Promise<FriendRequest> {
    // Scope to receiver — users cannot accept requests they sent
    const request = await this.repo.findPendingForReceiver(dto.requestId, userId);
    if (!request) {
      throw new NotFoundError('Friend request');
    }

    return this.repo.acceptAndCreateFriendship(dto.requestId, request.senderId, userId);
  }

  async rejectRequest(userId: string, dto: RespondRequestDto): Promise<FriendRequest> {
    const request = await this.repo.findPendingForReceiver(dto.requestId, userId);
    if (!request) {
      throw new NotFoundError('Friend request');
    }

    return this.repo.rejectRequest(dto.requestId);
  }

  async listFriends(userId: string): Promise<FriendProfile[]> {
    return this.repo.listFriends(userId);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) {
      throw new ValidationError('Cannot remove yourself as a friend');
    }

    const existed = await this.repo.removeFriendship(userId, friendId);
    if (!existed) {
      throw new NotFoundError('Friendship');
    }
  }
}
