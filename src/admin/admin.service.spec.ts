import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(() => {
    service = new AdminService();
  });

  it('extracts a token from query, body, or authorization header', () => {
    const queryRequest = {
      query: { token: 'query-token' },
      body: { token: 'body-token' },
      headers: {},
    } as any;
    expect(service.resolveToken(queryRequest, 'query-token', 'body-token')).toBe('query-token');

    const bodyRequest = {
      query: {},
      body: { token: 'body-token' },
      headers: {},
    } as any;
    expect(service.resolveToken(bodyRequest, undefined, 'body-token')).toBe('body-token');

    const headerRequest = {
      query: {},
      body: {},
      headers: { authorization: 'Bearer header-token' },
    } as any;
    expect(service.resolveToken(headerRequest, undefined, undefined)).toBe('header-token');
  });
});
