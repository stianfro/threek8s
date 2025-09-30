import { describe, it, expect, beforeAll, afterAll } from "vitest";

const API_URL = "http://localhost:3002/api";

describe("REST API Endpoints Contract", () => {
  describe("GET /api/health", () => {
    it("should return health status", async () => {
      const response = await fetch(`${API_URL}/health`);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("status");
      expect(["healthy", "degraded", "unhealthy"]).toContain(data.status);
      expect(data).toHaveProperty("cluster");
      expect(data.cluster).toHaveProperty("connected");
      expect(data).toHaveProperty("timestamp");
    });
  });

  describe("GET /api/cluster/info", () => {
    it("should return cluster information", async () => {
      const response = await fetch(`${API_URL}/cluster/info`);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("name");
        expect(data).toHaveProperty("version");
        expect(data).toHaveProperty("apiServer");
        expect(data).toHaveProperty("connected");
        expect(data).toHaveProperty("nodeCount");
        expect(data).toHaveProperty("namespaceCount");
      } else {
        expect(response.status).toBe(503); // Service unavailable
      }
    });
  });

  describe("GET /api/nodes", () => {
    it("should return list of nodes", async () => {
      const response = await fetch(`${API_URL}/nodes`);

      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);

        if (data.length > 0) {
          const node = data[0];
          expect(node).toHaveProperty("name");
          expect(node).toHaveProperty("uid");
          expect(node).toHaveProperty("status");
          expect(node).toHaveProperty("role");
          expect(node).toHaveProperty("capacity");
          expect(node).toHaveProperty("labels");
          expect(node).toHaveProperty("creationTimestamp");
        }
      } else {
        expect(response.status).toBe(503);
      }
    });
  });

  describe("GET /api/pods", () => {
    it("should return list of pods", async () => {
      const response = await fetch(`${API_URL}/pods`);

      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);

        if (data.length > 0) {
          const pod = data[0];
          expect(pod).toHaveProperty("name");
          expect(pod).toHaveProperty("uid");
          expect(pod).toHaveProperty("namespace");
          expect(pod).toHaveProperty("nodeName");
          expect(pod).toHaveProperty("phase");
          expect(pod).toHaveProperty("status");
          expect(pod).toHaveProperty("containers");
          expect(pod).toHaveProperty("labels");
        }
      } else {
        expect(response.status).toBe(503);
      }
    });

    it("should filter pods by namespace", async () => {
      const response = await fetch(`${API_URL}/pods?namespace=default`);

      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);

        data.forEach((pod) => {
          expect(pod.namespace).toBe("default");
        });
      }
    });

    it("should filter pods by node", async () => {
      const response = await fetch(`${API_URL}/pods?node=node-1`);

      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);

        data.forEach((pod) => {
          expect(pod.nodeName).toBe("node-1");
        });
      }
    });
  });

  describe("GET /api/namespaces", () => {
    it("should return list of namespaces", async () => {
      const response = await fetch(`${API_URL}/namespaces`);

      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);

        if (data.length > 0) {
          const namespace = data[0];
          expect(namespace).toHaveProperty("name");
          expect(namespace).toHaveProperty("uid");
          expect(namespace).toHaveProperty("status");
          expect(["Active", "Terminating"]).toContain(namespace.status);
          expect(namespace).toHaveProperty("podCount");
        }
      } else {
        expect(response.status).toBe(503);
      }
    });
  });
});
