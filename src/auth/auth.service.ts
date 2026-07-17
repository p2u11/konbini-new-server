import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'node-argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto'
import { User, UserToken } from '@prisma/client';

export interface AuthUser {
  id: number;
  email: string;
  name: string;

  is_admin: boolean,
  can_upload: boolean
}

export interface LoginPayload {
  user: AuthUser;
  token: string;
  message: string;
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) { }

  userToAuthUser(user: User | null | undefined): AuthUser | null {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,

      is_admin: user.is_admin,
      can_upload: user.can_upload
    }
  }

  async generateToken(user_id: number): Promise<string> {
    const base64String = crypto.randomBytes(32).toString('base64url');

    const token = await this.prisma.userToken.create(
      {
        data: {
          userid: user_id,
          tokenhash: await argon2.hash(base64String)
        }
      }
    );

    return `${token.id.toString()}:${base64String}`;
  }

  async logout(token: string): Promise<{ success: true | false }> {
    const tokenObj = await this.validateToken(token)
    if (!tokenObj) {
      console.log('No token found')
      return { success: false }
    }
    await this.prisma.userToken.delete({ where: { id: tokenObj.token.id } })
    return { success: true }
  }

  async login(name: string, password: string, ip: string): Promise<LoginPayload> {
    ip ??= "0.0.0.0"

    console.log(ip)

    if (!name || !password) {
      throw new UnauthorizedException('Username and password are required.');
    }

    const user = await this.prisma.user.findUnique({ where: { name } });
    if (!user) {
      throw new UnauthorizedException(`Invalid credentials.`);
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { last_login_ip: ip } })

    if (!await argon2.verify({ hash: user.password_hash, password })) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const token = await this.generateToken(user.id)

    return {
      user: this.userToAuthUser(user) ?? { id: 0, email: "", name: "", is_admin: false, can_upload: false },
      token,
      message: 'Login succeeded.',
    };
  }

  async register(email: string, password: string, name: string, ip: string): Promise<LoginPayload> {
    if (!email || !password || !name) {
      throw new UnauthorizedException('Email, password and username are required.');
    }

    console.log(ip)

    // check if username exists
    if (await this.prisma.user.findUnique({ where: { name } })) {
      throw new UnauthorizedException('Username already exists.');
    }

    // check if username exists
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new UnauthorizedException('Email already registered.');
    }

    const password_hash = await argon2.hash(password);

    const userCount = await this.prisma.user.count()

    const user = await this.prisma.user.create(
      {
        data: {
          name,
          email,
          password_hash,
          register_ip: ip,
          last_login_ip: ip,
          is_admin: userCount == 0,
          can_upload: true
        }
      }
    )

    var token: string;
    try {
      token = await this.generateToken(user.id)
    } catch (error) {
      console.error(error)
      throw new InternalServerErrorException("We created your account successfully, but token generation failed. Try logging in.")
    }

    return {
      user: this.userToAuthUser(user) ?? { id: 0, email: "", name: "", is_admin: false, can_upload: false },
      token,
      message: 'Registration succeeded.',
    };
  }

  async validateToken(token: string): Promise<{ user: User, token: UserToken } | null> {
    if (!token) {
      console.log('no token')
      return null;
    }

    const [tokenId, base64token] = token.split(":", 2);

    if (!tokenId || !base64token) {
      console.log('failed to split')
      return null;
    }

    if (!/^\d+$/.test(tokenId)) {
      // invalid token id
      console.log('invalid token id')
      return null
    }

    const tokenObj = await this.prisma.userToken.findUnique({ where: { id: parseInt(tokenId), } })
    if (!tokenObj) {
      console.log('token id not valid')
      return null
    }

    if (tokenObj.expires.getTime() < Date.now()) {
      console.log('expired')
      await this.prisma.userToken.delete({ where: { id: tokenObj.id } })
      return null
    }
    if (!await argon2.verify({ hash: tokenObj.tokenhash, password: base64token })) {
      console.log('invalid hash');
      return null
    }

    const user = await this.prisma.user.findUnique({ where: { id: tokenObj.userid } });
    if (!user) {
      console.log('No user found')
      return null
    }
    return { user: user, token: tokenObj }
  }

  async checkToken(token: string): Promise<{ valid: boolean; user?: AuthUser }> {
    const normalized = token?.startsWith('Bearer ') ? token.slice(7).trim() : token?.trim();
    const user = await this.validateToken(normalized);

    return {
      valid: !!user,
      user: this.userToAuthUser(user?.user) ?? undefined,
    };
  }
}
