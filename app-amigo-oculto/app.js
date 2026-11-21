(function () {
  "use strict";

  const { AmigoOculto } = window;
  const STORAGE_KEY = "amigo-oculto-v1";
  const app = document.querySelector("#app");

  const draft = { name: "" };
  let editingId = null;
  let formError = "";
  let state = loadState();

  function emptyState() {
    return { eventName: "", people: [], assignments: null, drawnAt: null };
  }

  function validPerson(person) {
    return Boolean(person && typeof person.id === "string" && typeof person.name === "string");
  }

  function validAssignment(row) {
    return Boolean(
      row &&
        typeof row.giverId === "string" &&
        typeof row.receiverId === "string" &&
        typeof row.token === "string"
    );
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const next = emptyState();
      if (!saved || typeof saved !== "object") return next;
      next.eventName = typeof saved.eventName === "string" ? saved.eventName.slice(0, 60) : "";
      next.people = Array.isArray(saved.people) ? saved.people.filter(validPerson) : [];
      const assignments = Array.isArray(saved.assignments)
        ? saved.assignments.filter(validAssignment).map((row) => ({ ...row, sent: Boolean(row.sent) }))
        : [];
      next.assignments = assignments.length ? assignments : null;
      next.drawnAt = typeof saved.drawnAt === "number" ? saved.drawnAt : null;
      return next;
    } catch (error) {
      return emptyState();
    }
  }

  function saveState() {
    const persisted = {
      eventName: state.eventName,
      people: state.people,
      assignments: state.assignments,
      drawnAt: state.drawnAt,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else node.setAttribute(key, String(value));
    });
    children.flat(Infinity).forEach((child) => {
      if (child == null || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function giftIcon() {
    const wrap = document.createElement("div");
    wrap.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="20" width="32" height="20" rx="4" fill="#9c2f2c"/><rect x="6" y="14" width="36" height="9" rx="3" fill="#e2b15a"/><path d="M24 14v26" stroke="#f8efe2" stroke-width="3"/><path d="M24 16c-3.2-7-11-7-11-2.2S19 16 24 18c5-2 11-.2 11-5S27.2 9 24 16z" fill="#1e6a45"/></svg>';
    return wrap.firstChild;
  }

  function needsPublicHost() {
    return (
      location.protocol === "file:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1"
    );
  }

  function hue(name) {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
    return hash;
  }

  function initials(name) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase("pt-BR");
  }

  function avatar(name) {
    return el("span", {
      class: "avatar",
      text: initials(name) || "?",
      style: `background: hsl(${hue(name)} 42% 38%)`,
    });
  }

  function countLabel(total) {
    if (total === 0) return "Nenhuma pessoa";
    if (total === 1) return "1 pessoa";
    return `${total} pessoas`;
  }

  function captureDraft() {
    const eventInput = document.querySelector("#event-name");
    const nameInput = document.querySelector("#person-name");
    if (eventInput) state.eventName = eventInput.value;
    if (nameInput) draft.name = nameInput.value;
  }

  function toast(message) {
    let node = document.querySelector(".toast");
    if (!node) {
      node = el("div", { class: "toast", role: "status" });
      document.body.append(node);
    }
    node.textContent = message;
    node.classList.add("is-visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("is-visible"), 2400);
  }

  function delay(ms) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || ms === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function findPerson(id) {
    return state.people.find((person) => person.id === id) || null;
  }

  function sameName(a, b) {
    return a.toLocaleLowerCase("pt-BR") === b.toLocaleLowerCase("pt-BR");
  }

  function onEventInput(event) {
    state.eventName = event.target.value;
    saveState();
  }

  function onDraftInput(event) {
    draft[event.target.name] = event.target.value;
    if (!formError) return;
    formError = "";
    document.querySelector("#form-error")?.remove();
  }

  function submitPerson(event) {
    event.preventDefault();
    const name = AmigoOculto.cleanName(draft.name);

    if (!name) {
      formError = "Escreva o nome.";
    } else if (name.length > 40) {
      formError = "Use um nome de até 40 letras.";
    } else if (state.people.some((person) => person.id !== editingId && sameName(person.name, name))) {
      formError = "Esse nome já está na lista.";
    } else if (editingId) {
      const person = findPerson(editingId);
      if (!person) {
        editingId = null;
        formError = "Não encontrei essa pessoa. Adicione de novo.";
      } else {
        person.name = name;
        editingId = null;
        draft.name = "";
        formError = "";
        saveState();
        toast(`${name} foi atualizado.`);
      }
    } else {
      state.people.push({ id: AmigoOculto.createId(), name });
      draft.name = "";
      formError = "";
      saveState();
      toast(`${name} entrou na lista.`);
    }

    renderHome({ preserveDraft: true });
    document.querySelector("#person-name")?.focus();
  }

  function startEdit(person) {
    editingId = person.id;
    draft.name = person.name;
    formError = "";
    renderHome({ preserveDraft: true });
    document.querySelector("#person-name")?.focus();
  }

  function cancelEdit() {
    editingId = null;
    draft.name = "";
    formError = "";
    renderHome({ preserveDraft: true });
  }

  function removePerson(person) {
    state.people = state.people.filter((item) => item.id !== person.id);
    if (editingId === person.id) {
      editingId = null;
      draft.name = "";
      formError = "";
    }
    saveState();
    renderHome({ preserveDraft: true });
    toast(`${person.name} saiu da lista.`);
  }

  async function startDraw() {
    if (state.drawing) return;
    captureDraft();
    state.eventName = AmigoOculto.cleanName(state.eventName).slice(0, 60);
    if (state.people.length < 3) {
      toast("Cadastre pelo menos 3 pessoas.");
      return;
    }

    state.drawing = true;
    renderHome({ preserveDraft: true });
    await delay(700);
    if (AmigoOculto.parseHash(location.hash).type !== "home") {
      state.drawing = false;
      return;
    }

    try {
      const pairs = AmigoOculto.draw(state.people);
      const eventName = state.eventName || "Amigo Oculto";
      state.assignments = pairs.map((pair) => {
        const giver = findPerson(pair.giverId);
        const receiver = findPerson(pair.receiverId);
        return {
          giverId: pair.giverId,
          receiverId: pair.receiverId,
          giverName: giver.name,
          receiverName: receiver.name,
          sent: false,
          token: AmigoOculto.encodeResult({
            eventName,
            giverName: giver.name,
            receiverName: receiver.name,
          }),
        };
      });
      state.drawnAt = Date.now();
      saveState();
    } catch (error) {
      toast(error.message || "Não foi possível sortear.");
    }

    state.drawing = false;
    renderHome({ scrollTop: true });
  }

  function undoDraw() {
    const confirmed = window.confirm(
      "Desfazer o sorteio? Quem já abriu um link antigo continua vendo o resultado antigo."
    );
    if (!confirmed) return;
    state.assignments = null;
    state.drawnAt = null;
    saveState();
    renderHome({ scrollTop: true });
  }

  function clearAll() {
    const confirmed = window.confirm("Resetar? Os nomes e o sorteio salvos neste navegador serão apagados.");
    if (!confirmed) return;
    state = emptyState();
    editingId = null;
    draft.name = "";
    formError = "";
    saveState();
    renderHome({ scrollTop: true, preserveDraft: true });
  }

  function resetButton() {
    if (!state.people.length && !state.eventName && !state.assignments) return null;
    return el("button", {
      class: "btn btn-reset",
      type: "button",
      text: "Reset",
      onClick: clearAll,
    });
  }

  function markSent(giverId, sent) {
    const row = state.assignments?.find((item) => item.giverId === giverId);
    if (!row) return;
    row.sent = sent;
    saveState();
    renderHome();
  }

  function messageFor(row) {
    return AmigoOculto.buildMessage({
      giverName: row.giverName,
      eventName: state.eventName,
      revealUrl: AmigoOculto.revealUrl(row.token),
    });
  }

  async function copyMessage(row) {
    const message = messageFor(row);
    try {
      await navigator.clipboard.writeText(message);
      toast(`Texto de ${row.giverName} copiado.`);
    } catch (error) {
      window.prompt("Copie o texto:", message);
    }
  }

  function hostingNote() {
    if (!needsPublicHost()) {
      return el("aside", { class: "note" }, el("strong", { text: "Texto pronto para encaminhar" }), el("p", { text: "Copie o texto de cada pessoa e cole na conversa. O link mostra só o resultado dela." }));
    }
    return el(
      "aside",
      { class: "note" },
      el("strong", { text: "Para o link abrir no celular" }),
      el("p", {}, "Neste computador dá para testar. Para o link abrir no celular, publique a pasta de graça no ", el("a", { href: "https://app.netlify.com/drop", target: "_blank", rel: "noopener noreferrer", text: "Netlify Drop" }), " e copie o texto no endereço publicado.")
    );
  }

  function helpBlock() {
    return el(
      "details",
      { class: "help" },
      el("summary", { text: "Como funciona" }),
      el("ol", {}, [
        el("li", { text: "Cadastre pelo menos 3 nomes." }),
        el("li", { text: "Sorteie. Ninguém tira o próprio nome, nem fecha uma dupla em que as duas pessoas se tiram." }),
        el("li", { text: "Copie o texto de cada pessoa e encaminhe você mesma. O texto já traz o link." }),
        el("li", { text: "A pessoa abre o link, toca em Revelar e vê somente quem ela tirou." }),
      ]),
      el("p", {
        class: "help-copy",
        text: "O resultado fica codificado no próprio link. Quem receber o link consegue ver o nome, então peça para não encaminhar.",
      })
    );
  }

  function personForm() {
    return el(
      "form",
      { novalidate: "true", onSubmit: submitPerson },
      el("label", { class: "field" }, el("span", { text: "Nome" }), el("input", {
        id: "person-name",
        name: "name",
        type: "text",
        maxlength: "40",
        autocomplete: "name",
        spellcheck: "false",
        placeholder: "Ex.: Ana Souza",
        value: draft.name,
        onInput: onDraftInput,
      })),
      formError ? el("p", { id: "form-error", class: "error", role: "alert", text: formError }) : null,
      el("div", { class: editingId ? "actions pair" : "actions" }, [
        el("button", { class: "btn btn-primary", type: "submit", text: editingId ? "Salvar" : "Adicionar" }),
        editingId ? el("button", { class: "btn btn-secondary", type: "button", text: "Cancelar", onClick: cancelEdit }) : null,
      ])
    );
  }

  function peopleList() {
    if (!state.people.length) {
      return el("p", { class: "hint", text: "Ninguém na lista ainda." });
    }
    return el(
      "ul",
      { class: "people" },
      state.people.map((person) =>
        el("li", { class: "person-row" }, [
          avatar(person.name),
          el("div", { class: "who" }, el("strong", { text: person.name })),
          el("button", {
            class: "icon-btn",
            type: "button",
            text: "Editar",
            onClick: () => startEdit(person),
          }),
          el("button", {
            class: "icon-btn",
            type: "button",
            text: "Remover",
            "aria-label": `Remover ${person.name}`,
            onClick: () => removePerson(person),
          }),
        ])
      )
    );
  }

  function setupCard() {
    const ready = state.people.length >= 3;
    return el("section", { class: "card stack" }, [
      el("label", { class: "field" }, [
        el("span", { text: "Nome do sorteio" }),
        el("input", {
          id: "event-name",
          type: "text",
          maxlength: "60",
          placeholder: "Ex.: Natal da família",
          value: state.eventName,
          onInput: onEventInput,
        }),
      ]),
      personForm(),
      el("div", { class: "section-head" }, [
        el("h2", { class: "section-label", text: "Participantes" }),
        el("p", { text: countLabel(state.people.length) }),
      ]),
      peopleList(),
      el("button", {
        class: "btn btn-primary",
        type: "button",
        disabled: ready ? null : "true",
        text: ready ? "Sortear" : 3 - state.people.length === 1 ? "Falta 1 pessoa" : `Faltam ${3 - state.people.length} pessoas`,
        onClick: startDraw,
      }),
      resetButton(),
      helpBlock(),
    ]);
  }

  function resultViews() {
    return (state.assignments || []).map((row) => {
      const giver = findPerson(row.giverId);
      const receiver = findPerson(row.receiverId);
      return {
        ...row,
        giverName: row.giverName || giver?.name || "",
        receiverName: row.receiverName || receiver?.name || "",
      };
    });
  }

  function sendCard(row) {
    return el("article", { class: "person-card" }, [
      el("div", { class: "person-head" }, [
        avatar(row.giverName),
        el("div", { class: "who" }, el("strong", { text: row.giverName })),
        el("span", {
          class: row.sent ? "badge is-sent" : "badge",
          text: row.sent ? "Enviado" : "Pendente",
        }),
      ]),
      el("pre", { class: "message", text: messageFor(row) }),
      el("div", { class: "actions pair" }, [
        el("button", {
          class: "btn btn-primary",
          type: "button",
          text: "Copiar texto",
          onClick: () => copyMessage(row),
        }),
        el("button", {
          class: "btn btn-secondary",
          type: "button",
          text: row.sent ? "Desmarcar" : "Já enviei",
          onClick: () => markSent(row.giverId, !row.sent),
        }),
      ]),
    ]);
  }

  function resultCard() {
    const rows = resultViews();
    if (rows.some((row) => !row.giverName || !row.receiverName)) {
      return el("section", { class: "card stack" }, [
        el("h2", { class: "section-label", text: "Não encontrei alguém deste sorteio" }),
        el("button", { class: "btn btn-primary", type: "button", text: "Desfazer sorteio", onClick: undoDraw }),
        resetButton(),
      ]);
    }

    const sentCount = rows.filter((row) => row.sent).length;
    const when = state.drawnAt
      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(state.drawnAt)
      : "";

    return el("section", { class: "card stack" }, [
      el("div", { class: "section-head" }, [
        el("div", {}, [
          el("h2", { class: "section-label", text: "Sorteio pronto" }),
          el("p", {
            class: "status-line",
            text: `${sentCount} de ${rows.length} marcados como enviados.${when ? ` Sorteado em ${when}.` : ""}`,
          }),
        ]),
        resetButton(),
      ]),
      el("p", {
        class: "hint",
        text: "Copie o texto e encaminhe para a pessoa. O nome sorteado só abre no link. Se sortear de novo, um link antigo continua com o resultado antigo.",
      }),
      rows.map((row) => sendCard(row)),
      el("button", { class: "btn btn-secondary", type: "button", text: "Desfazer sorteio", onClick: undoDraw }),
      helpBlock(),
    ]);
  }

  function drawingCard() {
    return el("section", { class: "card drawing" }, [
      el("div", { class: "pulse" }, giftIcon()),
      el("h2", { class: "section-label", text: "Misturando os nomes..." }),
      el("p", { class: "hint", text: "Ninguém fica com o próprio nome." }),
    ]);
  }

  function renderHome(options = {}) {
    if (!options.preserveDraft) captureDraft();
    const y = options.scrollTop ? 0 : window.scrollY;
    document.title = "Amigo Oculto";

    app.replaceChildren(
      el("main", { class: "stage" }, el("div", { class: "sheet" }, [
        el("header", { class: "hero" }, [
          el("div", { class: "mark" }, giftIcon()),
          el("p", { class: "eyebrow", text: "Sorteio gratuito" }),
          el("h1", { text: "Amigo Oculto" }),
          el("p", {
            class: "lede",
            text: "Cadastre os nomes, sorteie e copie um texto com o link secreto de cada pessoa.",
          }),
        ]),
        hostingNote(),
        state.drawing ? drawingCard() : state.assignments ? resultCard() : setupCard(),
        el("p", {
          class: "footer",
          text: "A lista fica salva neste navegador.",
        }),
      ]))
    );

    window.scrollTo(0, y);
  }

  function burst(container) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#9c2f2c", "#e2b15a", "#1e6a45", "#f6e6c8", "#fffdf9"];
    for (let i = 0; i < 22; i += 1) {
      const piece = el("span", { class: "confetti" });
      const angle = (Math.PI * 2 * i) / 22;
      const distance = 90 + (i % 5) * 18;
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      piece.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      container.append(piece);
    }
  }

  function renderReveal(token) {
    const result = AmigoOculto.decodeResult(token);
    document.title = "Amigo Oculto";
    app.replaceChildren(el("main", { class: "stage" }, el("div", { class: "sheet reveal" })));
    const sheet = app.querySelector(".sheet");

    if (!result) {
      sheet.append(
        el("p", { class: "eyebrow", text: "Amigo Oculto" }),
        el("h1", { text: "Link incompleto" }),
        el("p", { class: "lede", text: "Peça para a pessoa que organizou o sorteio enviar de novo." }),
        el("p", {}, el("a", { class: "text-link", href: "#/", text: "Criar um sorteio" }))
      );
      return;
    }

    const wrap = el("div", { class: "seal-wrap" });
    sheet.append(
      el("p", { class: "eyebrow", text: result.eventName }),
      el("h1", { text: `Olá, ${result.giverName}` }),
      el("p", { class: "lede", text: "Seu resultado está escondido. Toque no selo para ver quem você tirou." }),
      wrap
    );

    const seal = el("button", {
      class: "seal",
      type: "button",
      text: "Revelar",
      onClick: () => {
        document.title = `Você tirou ${result.receiverName}`;
        sheet.replaceChildren(
          el("p", { class: "eyebrow", text: result.eventName }),
          el("p", { class: "lede", text: `${result.giverName}, você tirou` }),
          el("p", { class: "revealed-name", text: result.receiverName }),
          el("p", { class: "lede", text: "Guarde segredo e não encaminhe o link." })
        );
        burst(sheet);
      },
    });
    wrap.append(seal);
  }

  function render() {
    const route = AmigoOculto.parseHash(location.hash);
    if (route.type === "reveal") renderReveal(route.token);
    else renderHome({ preserveDraft: true });
  }

  window.addEventListener("hashchange", render);
  render();
})();
