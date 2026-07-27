import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { loginSchema, registerSchema } from '../validators/auth.validators';

export const authRouter = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a business, investor, or admin account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [BUSINESS, INVESTOR, ADMIN] }
 *               adminSecret: { type: string, description: Required when role is ADMIN }
 *     responses:
 *       201: { description: Account created, returns token and user }
 *       409: { description: Email already registered }
 */
authRouter.post(
  '/register',
  validate({ body: registerSchema }),
  asyncHandler((req, res) => authController.register(req, res)),
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate and receive a JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Returns token and user }
 *       401: { description: Invalid credentials }
 */
authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler((req, res) => authController.login(req, res)),
);

/**
 * @openapi
 * /auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The current user }
 *       401: { description: Missing or invalid token }
 */
authRouter.get(
  '/profile',
  authenticate,
  asyncHandler((req, res) => authController.profile(req, res)),
);
