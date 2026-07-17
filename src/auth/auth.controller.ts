import { BadRequestException, Body, Controller, Get, Ip, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Matches } from 'class-validator';

class LoginDto {
  @Matches(/^[a-zA-Z0-9_]{3,15}$/, {
    message: "Invalid credentials."
  })
  name!: string;

  @Matches(/^(?=.*[0-9])[a-zA-Z0-9!@#$%^&*]{8,20}$/, {
    message: 'Invalid credentials.',
  })
  password!: string;
}

class RegisterDto {
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message: "Must be a valid email address."
  })
  email!: string;

  @Matches(/^(?=.*[0-9])[a-zA-Z0-9!@#$%^&*]{8,20}$/, {
    message: 'Password must be 8-20 characters long and contain at least one number.',
  })
  password!: string;

  @Matches(/^[a-zA-Z0-9_]{3,15}$/, {
    message: "Username can only contain alphanumeric characters and underscores and be between 3 and 15 characters long."
  })
  name!: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto, @Ip() ip: string) {
    if (!body)
      return new BadRequestException("No body provided.")
    return this.authService.login(body.name, body.password, ip);
  }

  @Post('register')
  async register(@Body() body: RegisterDto, @Ip() ip: string) {
    console.log(body)
    return this.authService.register(body.email, body.password, body.name, ip);
  }

  @Get('check-token')
  checkToken(@Query('token') token?: string) {
    console.log(token)
    return this.authService.checkToken(token ?? '');
  }

  @Get('logout')
  async logout(@Query('token') token?: string) {
    return this.authService.logout(token??'');
  }
}
