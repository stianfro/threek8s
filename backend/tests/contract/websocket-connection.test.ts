import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";

describe("WebSocket Connection Contract", () => {
  let ws: WebSocket;
  const WS_URL = "ws://localhost:3002/ws";

  afterAll(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  it("should accept WebSocket connection on /ws endpoint", (done) => {
    ws = new WebSocket(WS_URL);

    ws.on("open", () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      done();
    });

    ws.on("error", (error) => {
      done(error);
    });
  });

  it("should send connection acknowledgment message on connect", (done) => {
    ws = new WebSocket(WS_URL);

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());

      expect(message).toHaveProperty("type", "connection");
      expect(message).toHaveProperty("status", "connected");
      expect(message).toHaveProperty("timestamp");
      expect(message).toHaveProperty("cluster");
      expect(message.cluster).toHaveProperty("name");
      expect(message.cluster).toHaveProperty("version");

      done();
    });

    ws.on("error", (error) => {
      done(error);
    });
  });

  it("should accept optional namespace query parameters", (done) => {
    const wsWithParams = new WebSocket(`${WS_URL}?namespaces=default,kube-system`);

    wsWithParams.on("open", () => {
      expect(wsWithParams.readyState).toBe(WebSocket.OPEN);
      wsWithParams.close();
      done();
    });

    wsWithParams.on("error", (error) => {
      done(error);
    });
  });
});
