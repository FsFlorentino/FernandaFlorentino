const test = require("node:test");
const assert = require("node:assert/strict");
const logic = require("./logic.js");

function person(id, name) {
  return { id, name };
}

function assertSecretSanta(people, assignments) {
  const next = new Map(assignments.map((row) => [row.giverId, row.receiverId]));
  const receivers = new Set(assignments.map((row) => row.receiverId));

  assert.equal(assignments.length, people.length);
  assert.equal(receivers.size, people.length);

  for (const member of people) {
    assert.notEqual(next.get(member.id), member.id);
    assert.equal(receivers.has(member.id), true);
  }

  let current = people[0].id;
  const seen = new Set();
  for (let i = 0; i < people.length; i += 1) {
    assert.equal(seen.has(current), false);
    seen.add(current);
    current = next.get(current);
  }
  assert.equal(current, people[0].id);

  for (const [giver, receiver] of next) {
    assert.notEqual(next.get(receiver), giver);
  }
}

test("sorteio não deixa ninguém tirar a si mesmo nem formar dupla", () => {
  const people = [
    person("a", "Ana"),
    person("b", "Bruno"),
    person("c", "Caio"),
    person("d", "Duda"),
    person("e", "Eva"),
  ];

  for (let i = 0; i < 200; i += 1) {
    assertSecretSanta(people, logic.draw(people));
  }
});

test("exige pelo menos 3 pessoas", () => {
  assert.throws(() => logic.draw([person("a", "Ana"), person("b", "Bruno")]), /3 pessoas/);
});

test("o link esconde o nome e a mensagem não entrega o resultado", () => {
  const token = logic.encodeResult({
    eventName: "Natal da família",
    giverName: "João",
    receiverName: "Conceição",
  });
  const revealed = logic.decodeResult(token);

  assert.deepEqual(revealed, {
    eventName: "Natal da família",
    giverName: "João",
    receiverName: "Conceição",
  });
  assert.equal(token.includes("Conceição"), false);
  assert.equal(token.includes("João"), false);

  const link = `https://amigo.example/#/v/${token}`;
  const text = logic.buildMessage({
    giverName: "João",
    eventName: "Natal da família",
    revealUrl: link,
  });

  assert.equal(text.includes(link), true);
  assert.equal(text.replace(link, "").includes("Conceição"), false);
  assert.equal(text.includes("João"), true);
  assert.equal(logic.decodeResult(`${token}x`), null);
  assert.equal(logic.decodeResult(""), null);
});

test("nomes com acento e símbolo sobrevivem no link", () => {
  const token = logic.encodeResult({
    eventName: "Ação & Cia",
    giverName: "São João",
    receiverName: "Maria 🎁",
  });
  assert.deepEqual(logic.decodeResult(token), {
    eventName: "Ação & Cia",
    giverName: "São João",
    receiverName: "Maria 🎁",
  });
});

test("reconhece a rota do link secreto", () => {
  assert.deepEqual(logic.parseHash("#/v/abc_XYZ-123"), {
    type: "reveal",
    token: "abc_XYZ-123",
  });
  assert.deepEqual(logic.parseHash(""), { type: "home" });
  assert.deepEqual(logic.parseHash("#/outra"), { type: "home" });
});
