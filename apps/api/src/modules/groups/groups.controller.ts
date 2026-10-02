import { Response, NextFunction } from 'express';
import { GroupsService } from './groups.service';
import { createGroupSchema, addMemberSchema, joinGroupSchema } from '@splitwise/validation';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { GroupRequest } from '../../middleware/groupAuth.middleware';

export class GroupsController {
  static async createGroup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = createGroupSchema.parse(req.body);
      const group = await GroupsService.createGroup(req.user!.id, validated);
      return res.status(201).json({
        success: true,
        data: group,
        message: 'Group created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async listUserGroups(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const groups = await GroupsService.listUserGroups(req.user!.id);
      return res.status(200).json({
        success: true,
        data: groups
      });
    } catch (error) {
      next(error);
    }
  }

  static async getGroup(req: GroupRequest, res: Response, next: NextFunction) {
    try {
      const groupId = String(req.params.groupId);
      const group = await GroupsService.getGroupById(groupId);
      return res.status(200).json({
        success: true,
        data: group
      });
    } catch (error) {
      next(error);
    }
  }

  static async addMember(req: GroupRequest, res: Response, next: NextFunction) {
    try {
      const validated = addMemberSchema.parse(req.body);
      const groupId = String(req.params.groupId);
      const group = await GroupsService.addMember(groupId, validated);
      return res.status(200).json({
        success: true,
        data: group,
        message: 'Member added successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeMember(req: GroupRequest, res: Response, next: NextFunction) {
    try {
      const groupId = String(req.params.groupId);
      const memberUserId = String(req.params.userId);
      await GroupsService.removeMember(groupId, memberUserId, req.user!.id);
      return res.status(200).json({
        success: true,
        message: 'Member removed from group'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getGroupPreview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const inviteCode = String(req.params.inviteCode);
      const preview = await GroupsService.getGroupPreview(inviteCode, req.user?.id);
      return res.status(200).json({
        success: true,
        data: preview
      });
    } catch (error) {
      next(error);
    }
  }

  static async joinGroup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = joinGroupSchema.parse(req.body);
      const result = await GroupsService.joinGroupByInviteCode(req.user!.id, validated);
      return res.status(200).json({
        success: true,
        data: result.group,
        alreadyMember: result.alreadyMember,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }
}
