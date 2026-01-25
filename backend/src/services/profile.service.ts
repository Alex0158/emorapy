import prisma from '../config/database';
import { Errors } from '../utils/errors';

export class ProfileService {
  async getUserProfile(userId: string) {
    return prisma.userProfile.findUnique({ where: { user_id: userId } });
  }

  async upsertUserProfile(userId: string, data: any) {
    return prisma.userProfile.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        ...data,
      },
      update: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  private async assertPairingMember(pairingId: string, userId: string) {
    const pairing = await prisma.pairing.findUnique({
      where: { id: pairingId },
    });
    if (!pairing) throw Errors.NOT_FOUND('配對不存在');
    if (pairing.user1_id !== userId && pairing.user2_id !== userId) {
      throw Errors.FORBIDDEN('無權訪問此配對檔案');
    }
    return pairing;
  }

  async getRelationshipProfile(pairingId: string, userId: string) {
    await this.assertPairingMember(pairingId, userId);
    return prisma.relationshipProfile.findUnique({
      where: { pairing_id: pairingId },
    });
  }

  async upsertRelationshipProfile(pairingId: string, userId: string, data: any) {
    await this.assertPairingMember(pairingId, userId);
    return prisma.relationshipProfile.upsert({
      where: { pairing_id: pairingId },
      create: {
        pairing_id: pairingId,
        ...data,
      },
      update: {
        ...data,
        last_updated_at: new Date(),
      },
    });
  }
}

export const profileService = new ProfileService();
