import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard — Protects routes requiring a valid JWT Bearer token.
 * Attach with @UseGuards(JwtAuthGuard) on controllers or individual routes.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
