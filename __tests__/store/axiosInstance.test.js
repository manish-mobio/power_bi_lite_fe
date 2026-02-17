import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import axiosInstance from '../../src/store/axiosInstance'; // Adjust the import path if necessary

describe('axiosInstance', () => {
  let mock;

  beforeEach(() => {
    mock = new MockAdapter(axiosInstance);
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    mock.reset();
    localStorage.removeItem('token');
  });

  it('should include the Authorization header in requests', async () => {
    mock.onGet('/test-endpoint').reply(200, {});

    const response = await axiosInstance.get('/test-endpoint');

    expect(response.config.headers.Authorization).toBe('Bearer test-token');
  });

  it('should use the correct baseURL', async () => {
    const expectedBaseURL = process.env.NEXT_PUBLIC_API_URL || '';

    mock.onGet('/test-endpoint').reply(200, {});

    const response = await axiosInstance.get('/test-endpoint');

    expect(response.config.baseURL).toBe(expectedBaseURL);
  });

  it('should handle request interceptor error', async () => {
    const errorMock = new MockAdapter(axiosInstance);
    errorMock.onGet('/error-endpoint').networkError();

    try {
      await axiosInstance.get('/error-endpoint');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
