import { describe, it, expect } from 'vitest';
import { GroupsService } from '../src/modules/groups/groups.service';
import { prisma } from '@splitwise/database';

describe('Group Invitations & Idempotent Joining', () => {
  it('generates a human-friendly invite code', () => {
    // Access private static method for testing
    const code1 = (GroupsService as any).generateInviteCode('Goa Trip');
    expect(code1).toMatch(/^GOA-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);

    const code2 = (GroupsService as any).generateInviteCode('Flat 402');
    expect(code2).toMatch(/^FLA-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  });

  it('allows looking up seeded group preview by invite code', async () => {
    const preview = await GroupsService.getGroupPreview('GOA-7K4P2X');
    expect(preview.name).toBe('Goa Trip');
    expect(preview.inviteCode).toBe('GOA-7K4P2X');
    expect(preview.memberCount).toBe(3);
    expect(preview.creatorName).toBe('Liam Vance');
  });

  it('rejects nonexistent invite codes with NotFoundError', async () => {
    await expect(GroupsService.getGroupPreview('INVALID-CODE-999')).rejects.toThrow(
      'Invalid group invite code'
    );
  });

  it('idempotently handles join requests when user is already a member', async () => {
    const liam = await prisma.user.findUnique({ where: { email: 'liam@example.com' } });
    expect(liam).not.toBeNull();

    const joinResult = await GroupsService.joinGroupByInviteCode(liam!.id, {
      inviteCode: 'GOA-7K4P2X'
    });

    expect(joinResult.alreadyMember).toBe(true);
    expect(joinResult.message).toContain('already a member');
    expect(joinResult.group.name).toBe('Goa Trip');
  });
});
