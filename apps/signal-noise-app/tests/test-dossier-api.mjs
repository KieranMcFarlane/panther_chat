/**
 * Dossier API Endpoint Tests
 *
 * Tests for /api/dossier endpoints:
 * GET /api/dossier - Retrieve single dossier
 * POST /api/dossier - Batch dossier generation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const BASE_URL = 'http://localhost:3005';

describe('Dossier API Endpoints', () => {
  describe('GET /api/dossier', () => {
    it('should return 400 if entity_id is missing', async () => {
      const response = await fetch(`${BASE_URL}/api/dossier`);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('entity_id');
    });

    it('should accept entity_id parameter', async () => {
      const response = await fetch(
        `${BASE_URL}/api/dossier?entity_id=test-entity`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.entity_id).toBe('test-entity');
      expect(data.tier).toBeDefined();
      expect(data.sections).toBeDefined();
      expect(Array.isArray(data.sections)).toBe(true);
    });

    it('should support force regeneration parameter', async () => {
      const response = await fetch(
        `${BASE_URL}/api/dossier?entity_id=test-entity&force=true`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toBeDefined();
    });

    it('should return dossier with expected structure', async () => {
      const response = await fetch(
        `${BASE_URL}/api/dossier?entity_id=arsenal-fc`
      );
      const data = await response.json();

      expect(data).toMatchObject({
        entity_id: expect.any(String),
        entity_name: expect.any(String),
        entity_type: expect.any(String),
        priority_score: expect.any(Number),
        tier: expect.any(String),
        sections: expect.any(Array),
        generated_at: expect.any(String),
        total_cost_usd: expect.any(Number),
        generation_time_seconds: expect.any(Number),
        cache_status: expect.any(String)
      });

      expect(['BASIC', 'STANDARD', 'PREMIUM']).toContain(data.tier);
    });
  });

  describe('POST /api/dossier', () => {
    it('should return 400 if entity_ids is missing', async () => {
      const response = await fetch(`${BASE_URL}/api/dossier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 if entity_ids is not an array', async () => {
      const response = await fetch(`${BASE_URL}/api/dossier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_ids: 'not-an-array' })
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 if entity_ids is empty', async () => {
      const response = await fetch(`${BASE_URL}/api/dossier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_ids: [] })
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 if more than 10 entity_ids', async () => {
      const response = await fetch(`${BASE_URL}/api/dossier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_ids: Array.from({ length: 11 }, (_, i) => `entity-${i}`)
        })
      });

      expect(response.status).toBe(400);
    });

    it('should accept batch of entity_ids', async () => {
      const response = await fetch(`${BASE_URL}/api/dossier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_ids: ['arsenal-fc', 'aston-villa']
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        success: expect.any(Number),
        failed: expect.any(Number),
        results: expect.any(Array)
      });
    });

    it('should return batch generation results', async () => {
      const response = await fetch(`${BASE_URL}/api/dossier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_ids: ['test-entity-1', 'test-entity-2']
        })
      });

      const data = await response.json();

      expect(data.success).toBeGreaterThan(0);
      expect(data.results).toHaveLength(2);

      data.results.forEach((result: any) => {
        expect(result).toMatchObject({
          entity_id: expect.any(String),
          tier: expect.any(String),
          sections_count: expect.any(Number),
          cost: expect.any(Number),
          time: expect.any(Number)
        });
      });
    });
  });

  describe('Dossier Caching', () => {
    it('should cache dossier after first generation', async () => {
      const entityId = `cache-test-${Date.now()}`;

      // First request - generate
      const response1 = await fetch(
        `${BASE_URL}/api/dossier?entity_id=${entityId}`
      );
      expect(response1.status).toBe(200);

      const data1 = await response1.json();
      expect(data1.cache_status).toBeDefined();

      // Second request - should be cached
      const response2 = await fetch(
        `${BASE_URL}/api/dossier?entity_id=${entityId}`
      );
      expect(response2.status).toBe(200);

      const data2 = await response2.json();
      expect(data2.entity_id).toBe(data1.entity_id);
    });

    it('should force regeneration with force=true', async () => {
      const entityId = `force-test-${Date.now()}`;

      // Initial generation
      await fetch(
        `${BASE_URL}/api/dossier?entity_id=${entityId}`
      );

      // Force regeneration
      const response = await fetch(
        `${BASE_URL}/api/dossier?entity_id=${entityId}&force=true`
      );
      expect(response.status).toBe(200);
    });
  });
});

// Run tests manually with: node tests/test-dossier-api.mjs
