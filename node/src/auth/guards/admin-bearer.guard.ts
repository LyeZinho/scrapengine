import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AdminBearerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('INVALID_API_KEY');
    }

    const token = authHeader.slice(7);
    const adminKey = process.env.ADMIN_API_KEY;

    if (!adminKey || token !== adminKey) {
      throw new UnauthorizedException('INVALID_API_KEY');
    }

    return true;
  }
}
