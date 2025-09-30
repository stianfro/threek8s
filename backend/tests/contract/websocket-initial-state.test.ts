import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";

describe("WebSocket Initial State Contract", () => {
  let ws: WebSocket;
  const WS_URL = "ws://localhost:3002/ws";

  afterAll(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  it("should send initial_state message after connection", (done) => {
    ws = new WebSocket(WS_URL);
    let messageCount = 0;

    ws.on("message", (data) => {
      messageCount++;

      // Skip connection message
      if (messageCount === 1) return;

      const message = JSON.parse(data.toString());

      expect(message).toHaveProperty("type", "initial_state");
      expect(message).toHaveProperty("data");
      expect(message).toHaveProperty("timestamp");

      const messageData = message.data;
      expect(messageData).toHaveProperty("nodes");
      expect(messageData).toHaveProperty("pods");
      expect(messageData).toHaveProperty("namespaces");

      expect(Array.isArray(messageData.nodes)).toBe(true);
      expect(Array.isArray(messageData.pods)).toBe(true);
      expect(Array.isArray(messageData.namespaces)).toBe(true);

      done();
    });

    ws.on("error", (error) => {
      done(error);
    });
  });

  it("should include proper node structure in initial state", (done) => {
    ws = new WebSocket(WS_URL);
    let messageCount = 0;

    ws.on("message", (data) => {
      messageCount++;
      if (messageCount === 1) return; // Skip connection message

      const message = JSON.parse(data.toString());

      if (message.type === "initial_state" && message.data.nodes.length > 0) {
        const node = message.data.nodes[0];

        expect(node).toHaveProperty("name");
        expect(node).toHaveProperty("uid");
        expect(node).toHaveProperty("status");
        expect(node).toHaveProperty("role");
        expect(node).toHaveProperty("capacity");
        expect(node).toHaveProperty("conditions");
        expect(node).toHaveProperty("labels");
        expect(node).toHaveProperty("creationTimestamp");

        expect(node.capacity).toHaveProperty("cpu");
        expect(node.capacity).toHaveProperty("memory");
        expect(node.capacity).toHaveProperty("pods");

        done();
      }
    });

    ws.on("error", (error) => {
      done(error);
    });
  });

  it("should include proper pod structure in initial state", (done) => {
    ws = new WebSocket(WS_URL);
    let messageCount = 0;

    ws.on("message", (data) => {
      messageCount++;
      if (messageCount === 1) return; // Skip connection message

      const message = JSON.parse(data.toString());

      if (message.type === "initial_state" && message.data.pods.length > 0) {
        const pod = message.data.pods[0];

        expect(pod).toHaveProperty("name");
        expect(pod).toHaveProperty("uid");
        expect(pod).toHaveProperty("namespace");
        expect(pod).toHaveProperty("nodeName");
        expect(pod).toHaveProperty("phase");
        expect(pod).toHaveProperty("status");
        expect(pod).toHaveProperty("containers");
        expect(pod).toHaveProperty("labels");
        expect(pod).toHaveProperty("creationTimestamp");

        expect(Array.isArray(pod.containers)).toBe(true);

        done();
      }
    });

    ws.on("error", (error) => {
      done(error);
    });
  });
});
