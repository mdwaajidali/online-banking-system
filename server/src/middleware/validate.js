import { z } from 'zod';

/**
 * Validates req.body against a zod schema and replaces it with the parsed value.
 * Because every field is checked for its exact type, objects like {"$gt": ""}
 * can never reach a database query (this blocks NoSQL injection).
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const first = result.error.issues[0];
    return res.status(400).json({
      error: first.message,
      field: first.path.join('.'),
    });
  }
  req.body = result.data;
  next();
};

const amountRegex = /^\d{1,9}(\.\d{1,2})?$/;
export const amountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => amountRegex.test(v), 'Enter an amount like 500 or 1250.50')
  .refine((v) => Number(v) > 0, 'Amount must be more than zero');

export const accountNumberSchema = z.string().trim().regex(/^\d{12}$/, 'Account numbers are 12 digits');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password needs at least one letter')
  .regex(/\d/, 'Password needs at least one number');
