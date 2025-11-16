import request from 'supertest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

describe('Users Endpoints (e2e)', () => {
  describe('GET /users', () => {
    it('should return an array of users', () => {
      return request(API_BASE_URL)
        .get('/users')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('name');
          expect(res.body[0]).toHaveProperty('email');
          expect(res.body[0]).toHaveProperty('createdAt');
        });
    });

    it('should return users with correct structure', () => {
      return request(API_BASE_URL)
        .get('/users')
        .expect(200)
        .expect((res) => {
          const user = res.body[0];
          expect(typeof user.id).toBe('number');
          expect(typeof user.name).toBe('string');
          expect(typeof user.email).toBe('string');
          expect(typeof user.createdAt).toBe('string');
        });
    });
  });

  describe('GET /users/:id', () => {
    it('should return a user by id', () => {
      return request(API_BASE_URL)
        .get('/users/1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 1);
          expect(res.body).toHaveProperty('name');
          expect(res.body).toHaveProperty('email');
        });
    });

    it('should return 404 for non-existent user', () => {
      return request(API_BASE_URL).get('/users/999').expect(404);
    });

    it('should return 400 for invalid id format', () => {
      return request(API_BASE_URL).get('/users/invalid').expect(400);
    });
  });
});

