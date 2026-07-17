import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, LoginPayload } from './auth.service';
import { beforeEach, describe, it } from 'node:test';
import { PrismaService } from 'src/prisma/prisma.service';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService, PrismaService],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('returns a placeholder login payload', async () => {
    const result = await controller.login({ name: 'demo', password: 'secret' });

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('message');
    expect(result.user.email).toBe('demo@example.com');
  });

  it('returns a placeholder register payload', async () => {
    const result = await controller.register({ email: 'demo@example.com', password: 'secret', name: 'Demo' });

    expect(result).toHaveProperty('token');
    expect(result.user.name).toBe('Demo');
  });

  it('uses the shared validation helper for token checks', async () => {
    const valid = controller.checkToken('Bearer placeholder-token');
    const invalid = controller.checkToken('invalid-token');

    expect(valid.valid).toBe(true);
    expect(invalid.valid).toBe(false);
  });
});
function expect(result: LoginPayload) {
  throw new Error('Function not implemented.');
}

