export interface HttpReply {
  code(statusCode: number): HttpReply;
  send(payload: unknown): unknown;
}

export interface HttpRequest<Params = Record<string, string>, Body = unknown> {
  params: Params;
  body: Body;
}

export type HttpHandler = (request: HttpRequest<any, any>, reply: HttpReply) => Promise<unknown> | unknown;

export interface RouteRegistrar {
  get(path: string, handler: HttpHandler): unknown;
  post(path: string, handler: HttpHandler): unknown;
}
