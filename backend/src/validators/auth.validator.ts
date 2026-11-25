import { z } from 'zod';

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(160, 'Full name must not exceed 160 characters.'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Provide a valid university email address.')
      .max(255),
    campusId: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^[A-Z0-9-]{5,32}$/,
        'Campus ID must be 5 to 32 alphanumeric or hyphen characters.',
      ),
    department: z
      .string()
      .trim()
      .min(2, 'Department is required.')
      .max(160, 'Department must not exceed 160 characters.'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long.')
      .max(128, 'Password must not exceed 128 characters.')
      .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
      .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
      .regex(/[0-9]/, 'Password must include at least one digit.'),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Provide a valid email address.')
      .max(255),
    password: z
      .string()
      .min(1, 'Password is required.')
      .max(128, 'Password must not exceed 128 characters.'),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
