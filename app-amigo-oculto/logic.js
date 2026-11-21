(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.AmigoOculto = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();
  // Chave fixa só para o nome não aparecer legível no link. Quem tem o link vê o resultado.
  const MASK = [79, 99, 117, 108, 116, 111, 65, 109, 105, 103, 111];

  function cleanName(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function createId() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  // Sattolo: permutação em um único ciclo. Ninguém tira a si mesmo
  // e o grupo não se divide em duplas que se tiram.
  function sattolo(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * i);
      const current = copy[i];
      copy[i] = copy[j];
      copy[j] = current;
    }
    return copy;
  }

  function isFullCycle(assignments) {
    if (!assignments.length) return false;
    const next = new Map(assignments.map((row) => [row.giverId, row.receiverId]));
    let current = assignments[0].giverId;
    const seen = new Set();

    for (let i = 0; i < assignments.length; i += 1) {
      if (seen.has(current) || !next.has(current)) return false;
      seen.add(current);
      current = next.get(current);
    }

    return current === assignments[0].giverId && seen.size === assignments.length;
  }

  function draw(people) {
    if (!Array.isArray(people) || people.length < 3) {
      throw new Error("Cadastre pelo menos 3 pessoas.");
    }

    const receivers = sattolo(people);
    const assignments = people.map((giver, index) => ({
      giverId: giver.id,
      receiverId: receivers[index].id,
    }));

    if (!isFullCycle(assignments)) {
      throw new Error("Não foi possível sortear. Tente de novo.");
    }

    return assignments;
  }

  function xorBytes(bytes) {
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) {
      out[i] = bytes[i] ^ MASK[i % MASK.length];
    }
    return out;
  }

  function bytesToBase64Url(bytes) {
    let base64;
    if (typeof Buffer !== "undefined") {
      base64 = Buffer.from(bytes).toString("base64");
    } else {
      let binary = "";
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      base64 = btoa(binary);
    }
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(value) {
    const pad = (4 - (value.length % 4)) % 4;
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(base64, "base64"));
    }
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }

  function encodeResult({ eventName, giverName, receiverName }) {
    const payload = {
      v: 1,
      e: eventName || "Amigo Oculto",
      g: giverName,
      r: receiverName,
    };
    const body = xorBytes(textEncoder.encode(JSON.stringify(payload)));
    const packed = new Uint8Array(body.length + 1);
    packed[0] = 1;
    packed.set(body, 1);
    return bytesToBase64Url(packed);
  }

  function decodeResult(token) {
    if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
    try {
      const packed = base64UrlToBytes(token);
      if (packed[0] !== 1) return null;
      const json = textDecoder.decode(xorBytes(packed.slice(1)));
      const data = JSON.parse(json);
      if (!data || data.v !== 1) return null;
      if (typeof data.g !== "string" || typeof data.r !== "string") return null;
      if (!data.g.trim() || !data.r.trim()) return null;
      return {
        eventName: typeof data.e === "string" && data.e.trim() ? data.e : "Amigo Oculto",
        giverName: data.g,
        receiverName: data.r,
      };
    } catch (error) {
      return null;
    }
  }

  function buildMessage({ giverName, eventName, revealUrl }) {
    const event = cleanName(eventName) || "Amigo Oculto";
    return [
      `Oi, ${giverName}! 🎁`,
      "",
      `O amigo oculto "${event}" foi sorteado.`,
      "Abra o link para ver só o seu resultado:",
      "",
      revealUrl,
      "",
      "Não encaminhe esta mensagem.",
    ].join("\n");
  }

  function parseHash(hash) {
    const match = /^#\/v\/([A-Za-z0-9_-]+)$/.exec(hash || "");
    if (!match) return { type: "home" };
    return { type: "reveal", token: match[1] };
  }

  function revealUrl(token) {
    const url = new URL(window.location.href);
    url.hash = `/v/${token}`;
    url.search = "";
    return url.toString();
  }

  return {
    cleanName,
    createId,
    draw,
    encodeResult,
    decodeResult,
    buildMessage,
    parseHash,
    revealUrl,
  };
});
