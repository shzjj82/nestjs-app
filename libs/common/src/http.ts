export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
}

export function ok<T>(
  data: T,
  message = 'ok',
  code = 200,
): ApiResponse<T> {
  return { success: true, code, message, data };
}

export function fail(code: number, message: string): ApiResponse<null> {
  return { success: false, code, message, data: null };
}

export function unwrapData<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    'service' in payload &&
    'instance' in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export function isApiResponse(payload: unknown): payload is ApiResponse<unknown> {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    'code' in payload &&
    'message' in payload &&
    'data' in payload
  );
}
