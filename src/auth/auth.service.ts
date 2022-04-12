import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { verifyLink } from './utils/verifyLink.util';
import { MagikLink, MagikLinkDocument } from '../schemas/MagikLink.schema';
import { User, UserDocument } from '../schemas/User.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../schemas/RefreshToken.schema';
import { TokenService } from '../token/token.service';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private token: TokenService,
    @InjectModel(MagikLink.name)
    private magikModel: Model<MagikLinkDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private refreshModel: Model<RefreshTokenDocument>,
  ) {}

  async login(magik: string): Promise<Tokens | false> {
    const link: MagikLinkDocument = await this.magikModel.findOne({ magik });
    if (!verifyLink(link)) return false;

    const { _id } = link.user;

    const accessToken = this.token.createAccess({ _id }, '10m');
    const refresh = new this.refreshModel({
      user: _id,
      token: this.token.createRefresh('1d'),
    });

    try {
      await refresh.save();
    } catch (e) {
      return false;
    }

    return { accessToken, refreshToken: refresh.token };
  }

  async logout(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const delRes = await this.refreshModel.deleteOne({ token });
    return !!delRes.deletedCount;
  }

  async refresh(token: string): Promise<false | Tokens> {
    // todo: Заменить на findOneAndDelete()
    const refresh = await this.refreshModel.findOne({ token });
    if (!refresh) return false;

    const refreshToken = this.token.createRefresh('1d');
    const accessToken = this.token.createAccess({ _id: refresh.user }, '15m');

    refresh.token = refreshToken;
    await refresh.save();

    // fixme: use ResponseInterface
    return {
      accessToken,
      refreshToken,
    };
  }
}
