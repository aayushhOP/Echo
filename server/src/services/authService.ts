import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import User, { IUser } from "../models/User";
import { ENV } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

export interface RegisterDTO {
  username: string;
  email: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface UserSummary {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  status?: string;
  isOnline: boolean;
  lastSeen: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

const formatUser = (user: IUser): UserSummary => ({
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  avatarUrl: user.avatarUrl,
  status: user.status,
  isOnline: user.isOnline,
  lastSeen: user.lastSeen,
});

export const register = async (data: RegisterDTO): Promise<AuthTokens> => {
  const existingUser = await User.findOne({
    $or: [{ email: data.email.toLowerCase() }, { username: data.username }],
  });

  if (existingUser) {
    if (existingUser.email.toLowerCase() === data.email.toLowerCase()) {
      throw new AppError("Email is already registered", 409);
    }
    throw new AppError("Username is already taken", 409);
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(data.password, saltRounds);

  const user = await User.create({
    username: data.username,
    email: data.email.toLowerCase(),
    passwordHash,
  });

  const accessTokenOptions: SignOptions = {
    expiresIn: ENV.JWT_ACCESS_EXPIRY as any,
  };
  const refreshTokenOptions: SignOptions = {
    expiresIn: ENV.JWT_REFRESH_EXPIRY as any,
  };

  const accessToken = jwt.sign({ userId: user._id.toString() }, ENV.JWT_SECRET, accessTokenOptions);
  const refreshToken = jwt.sign({ userId: user._id.toString() }, ENV.JWT_REFRESH_SECRET, refreshTokenOptions);

  return {
    accessToken,
    refreshToken,
    user: formatUser(user),
  };
};

export const login = async (data: LoginDTO): Promise<AuthTokens> => {
  const user = await User.findOne({ email: data.email.toLowerCase() });
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isPasswordMatch = await bcrypt.compare(data.password, user.passwordHash);
  if (!isPasswordMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  const accessTokenOptions: SignOptions = {
    expiresIn: ENV.JWT_ACCESS_EXPIRY as any,
  };
  const refreshTokenOptions: SignOptions = {
    expiresIn: ENV.JWT_REFRESH_EXPIRY as any,
  };

  const accessToken = jwt.sign({ userId: user._id.toString() }, ENV.JWT_SECRET, accessTokenOptions);
  const refreshToken = jwt.sign({ userId: user._id.toString() }, ENV.JWT_REFRESH_SECRET, refreshTokenOptions);

  return {
    accessToken,
    refreshToken,
    user: formatUser(user),
  };
};

export const refresh = async (token: string): Promise<{ accessToken: string; user: UserSummary }> => {
  if (!token) {
    throw new AppError("Refresh token missing", 401);
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_REFRESH_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError("User not found", 401);
    }

    const accessTokenOptions: SignOptions = {
      expiresIn: ENV.JWT_ACCESS_EXPIRY as any,
    };
    const accessToken = jwt.sign({ userId: user._id.toString() }, ENV.JWT_SECRET, accessTokenOptions);

    return {
      accessToken,
      user: formatUser(user),
    };
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new AppError("Refresh token expired", 401);
    }
    throw new AppError("Invalid refresh token", 401);
  }
};

export const logout = async (_userId?: string): Promise<{ success: boolean; message: string }> => {
  return { success: true, message: "Logged out successfully" };
};
