import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@splitwise/validation';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = registerSchema.parse(req.body);
      const { user, token } = await AuthService.register(validated);

      AuthService.setSessionCookie(res, token);

      return res.status(201).json({
        success: true,
        data: { user, token },
        message: 'Account created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = loginSchema.parse(req.body);
      const { user, token } = await AuthService.login(validated);

      AuthService.setSessionCookie(res, token);

      return res.status(200).json({
        success: true,
        data: { user, token },
        message: 'Logged in successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      AuthService.clearSessionCookie(res);
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = forgotPasswordSchema.parse(req.body);
      await AuthService.forgotPassword(validated.email);

      // Generic response to avoid email enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been dispatched.'
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = resetPasswordSchema.parse(req.body);
      await AuthService.resetPassword(validated);

      return res.status(200).json({
        success: true,
        message: 'Your password has been successfully reset. You may now log in.'
      });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      return res.status(200).json({
        success: true,
        data: req.user
      });
    } catch (error) {
      next(error);
    }
  }
}
