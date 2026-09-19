import type { IncomingHttpHeaders } from 'http';

export interface VercelRequest {
  method?: string;
  headers: IncomingHttpHeaders & Record<string, string | string[] | undefined>;
  body: any;
  query: Record<string, string | string[] | undefined>;
  [key: string]: any;
}

export interface VercelResponse {
  status: (statusCode: number) => VercelResponse;
  json: (data: any) => VercelResponse;
  setHeader: (name: string, value: string | number | readonly string[]) => VercelResponse;
  end: (chunk?: any) => VercelResponse;
  [key: string]: any;
}
