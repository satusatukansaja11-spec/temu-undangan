const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
function fixture() {
  class Element {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.attributes = {};
      this.parentElement = null;
      this.dataset = {};
    }
    append(...nodes) {
      for (const node of nodes) {
        node.remove();
        this.children.push(node);
        node.parentElement = this;
      }
    }
    remove() {
      if (this.parentElement) {
        const siblings = this.parentElement.children,
          index = siblings.indexOf(this);
        if (index >= 0) siblings.splice(index, 1);
        this.parentElement = null;
      }
    }
    addEventListener(type, listener) {
      this["on" + type] = listener;
    }
    setAttribute(key, value) {
      this.attributes[key] = value;
    }
    removeAttribute(key) {
      delete this.attributes[key];
    }
    contains(node) {
      return (
        node === this || this.children.some((child) => child.contains(node))
      );
    }
  }
  let now = 0,
    id = 0;
  const timers = new Map(),
    storage = new Map(),
    body = new Element("body");
  const document = {
    body,
    hidden: false,
    readyState: "loading",
    createElement: (tag) => new Element(tag),
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
  const context = {
    window: {},
    document,
    performance: { now: () => now },
    sessionStorage: { setItem: (k, v) => storage.set(k, v) },
    setTimeout: (fn, delay) => {
      timers.set(++id, { fn, time: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../public/snackbar.js"), "utf8"),
    context,
  );
  const advance = (ms) => {
    const end = now + ms;
    while (true) {
      const next = Array.from(timers).sort((a, b) => a[1].time - b[1].time)[0];
      if (!next || next[1].time > end) break;
      now = next[1].time;
      timers.delete(next[0]);
      next[1].fn();
    }
    now = end;
  };
  return {
    snackbar: context.window.snackbar,
    cards: () => body.children[0]?.children || [],
    advance,
    storage,
  };
}
test("Snackbar variants, safe text, deduplication, stack limit and dismissal", () => {
  const f = fixture();
  for (const type of ["success", "info", "warning", "error"])
    f.snackbar.show(type, type);
  assert.equal(f.cards().length, 4);
  assert.equal(f.cards().at(-1).attributes.role, "alert");
  assert.equal(f.cards()[0].attributes.role, "status");
  f.snackbar.show("error", "error");
  assert.equal(f.cards().length, 4);
  f.snackbar.show("<img src=x onerror=alert(1)>", "info");
  assert.equal(f.cards().length, 4);
  assert.equal(
    f.cards().at(-1).children[1].children[1].textContent,
    "<img src=x onerror=alert(1)>",
  );
  assert.ok(
    !f
      .cards()
      .some((card) => card.children[1].children[1].textContent === "success"),
  );
  f.cards().at(-1).children[2].onclick();
  assert.equal(f.cards().length, 3);
  f.snackbar.clear();
  assert.equal(f.cards().length, 0);
});
test("Independent snackbar timers and paused hover do not dismiss newer messages", () => {
  const f = fixture();
  f.snackbar.show("First", "info", { duration: 1000 });
  f.advance(500);
  f.snackbar.show("Second", "success", { duration: 2000 });
  f.advance(600);
  assert.equal(f.cards().length, 1);
  assert.equal(f.cards()[0].children[1].children[1].textContent, "Second");
  f.cards()[0].onpointerenter();
  f.advance(10000);
  assert.equal(f.cards().length, 1);
  f.cards()[0].onpointerleave();
  f.advance(1500);
  assert.equal(f.cards().length, 0);
  f.snackbar.show("Keyboard", "info", { duration: 1000 });
  f.cards()[0].onfocusin();
  f.advance(5000);
  assert.equal(f.cards().length, 1);
  f.cards()[0].onfocusout({ relatedTarget: null });
  f.advance(1100);
  assert.equal(f.cards().length, 0);
});
test("Mutation notices reflect completed requests and authentication survives redirect", () => {
  const f = fixture();
  f.snackbar.requestSuccess("/api/admin/shop", "PUT", {});
  assert.equal(f.cards().length, 1);
  assert.equal(f.cards()[0].dataset.type, "success");
  f.snackbar.clear();
  f.snackbar.requestSuccess("/api/themes", "GET", {});
  assert.equal(f.cards().length, 0);
  f.snackbar.requestSuccess("/api/events/event", "PUT", {});
  assert.equal(
    f.cards().length,
    0,
    "Editor uses its own detailed completion message",
  );
  f.snackbar.requestSuccess("/auth/register", "POST", {});
  assert.equal(f.cards().length, 0);
  const flash = JSON.parse(f.storage.get("temu-snackbar-flash"));
  assert.equal(flash.type, "success");
  assert.match(flash.message, /Akun berhasil dibuat/);
});
