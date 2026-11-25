import type { UserProfile } from '../types/domain';
import { ApiClientError, apiRequest } from './apiClient';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  campusId: string;
  department: string;
  password: string;
}

export const authService = {
  async register(payload: RegisterPayload): Promise<UserProfile> {
    const data = await apiRequest<{ user: UserProfile }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.user;
  },

  async login(payload: LoginPayload): Promise<UserProfile> {
    const data = await apiRequest<{ user: UserProfile }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.user;
  },

  async logout(): Promise<void> {
    await apiRequest<{ message: string }>('/api/v1/auth/logout', {
      method: 'POST',
    });
  },

  async getMe(): Promise<UserProfile | null> {
    try {
      const data = await apiRequest<{ user: UserProfile }>('/api/v1/auth/me', {
        method: 'GET',
      });
      return data.user;
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        return null;
      }
      throw error;
    }
  },
};
