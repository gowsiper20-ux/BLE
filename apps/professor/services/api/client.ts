const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = {
  async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    
    // In future phases, inject Authorization header here from secure storage
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      let errorMessage = 'Network response was not ok';
      try {
        const errData = await response.json();
        errorMessage = errData.error?.message || errData.message || errorMessage;
      } catch (e) {
        // ignore
      }
      throw new ApiError(response.status, errorMessage);
    }
    
    return response.json() as Promise<T>;
  },
  
  get<T>(endpoint: string, options?: RequestInit) {
    return this.fetch<T>(endpoint, { ...options, method: 'GET' });
  },
  
  post<T>(endpoint: string, data?: any, options?: RequestInit) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
};
