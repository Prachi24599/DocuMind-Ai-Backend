import request from 'supertest';
import app from '../src/app'; // Adjust the import based on your app's export

describe('Health Endpoint', () => {
  it('should return 200 and a health status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'healthy' });
  });

  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/unknown');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not Found' });
  });

  it('should handle malformed JSON', async () => {
    const response = await request(app)
      .post('/api/health')
      .send('{ malformed: json }'); // Sending malformed JSON
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Malformed JSON' });
  });

  it('should handle oversized JSON payloads', async () => {
    const oversizedPayload = new Array(102 * 1024).fill('a').join(''); // 102KB payload
    const response = await request(app)
      .post('/api/health')
      .send(oversizedPayload);
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'Payload Too Large' });
  });
});