import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
    email: z.string().trim().toLowerCase().email('Invalid email address').max(255),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password cannot exceed 128 characters'),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address')
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'Group name must be at least 2 characters').max(100, 'Group name cannot exceed 100 characters')
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address')
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const addFriendSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address')
});

export type AddFriendInput = z.infer<typeof addFriendSchema>;

export const splitItemSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  amountOwed: z.number().int().nonnegative('Amount must be non-negative').optional(),
  percentage: z.number().min(0).max(100).optional()
});

export const createExpenseSchema = z
  .object({
    groupId: z.string().nullable().optional(),
    description: z.string().trim().min(1, 'Description is required').max(255, 'Description too long'),
    totalAmount: z.number().int().positive('Total amount must be greater than zero'), // Minor units (e.g., paise)
    splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE']),
    paidBy: z.string().min(1, 'Payer is required'),
    expenseDate: z.string().datetime().optional(),
    splits: z.array(splitItemSchema).min(1, 'At least one participant is required')
  })
  .superRefine((data, ctx) => {
    // Check duplicate participants
    const userIds = data.splits.map((s) => s.userId);
    const uniqueIds = new Set(userIds);
    if (uniqueIds.size !== userIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate participants found in split',
        path: ['splits']
      });
    }

    if (data.splitType === 'EXACT') {
      const sum = data.splits.reduce((acc, curr) => acc + (curr.amountOwed ?? 0), 0);
      if (sum !== data.totalAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Exact split sum (${sum}) must match total amount (${data.totalAmount})`,
          path: ['splits']
        });
      }
    }

    if (data.splitType === 'PERCENTAGE') {
      const sumPercent = data.splits.reduce((acc, curr) => acc + (curr.percentage ?? 0), 0);
      // Floating tolerance of 0.01
      if (Math.abs(sumPercent - 100) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Percentages must total 100% (currently ${sumPercent}%)`,
          path: ['splits']
        });
      }
    }
  });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z
  .object({
    description: z.string().trim().min(1).max(255).optional(),
    totalAmount: z.number().int().positive().optional(),
    splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE']).optional(),
    paidBy: z.string().min(1).optional(),
    expenseDate: z.string().datetime().optional(),
    splits: z.array(splitItemSchema).min(1).optional()
  })
  .superRefine((data, ctx) => {
    if (data.splits && data.totalAmount) {
      const userIds = data.splits.map((s) => s.userId);
      const uniqueIds = new Set(userIds);
      if (uniqueIds.size !== userIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate participants found in split',
          path: ['splits']
        });
      }
      if (data.splitType === 'EXACT') {
        const sum = data.splits.reduce((acc, curr) => acc + (curr.amountOwed ?? 0), 0);
        if (sum !== data.totalAmount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Exact split sum (${sum}) must match total amount (${data.totalAmount})`,
            path: ['splits']
          });
        }
      }
    }
  });

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100)
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
