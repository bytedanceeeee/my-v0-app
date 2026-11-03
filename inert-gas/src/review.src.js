// Admin and moderator APIs. build.js appends this file after worker.src.js.
const APP_STATUSES = ["pending", "accepted", "rejected"];
const KINDS = ["posts", "comments", "requests"];

async function lockedOut(db, key) {
  const r = await db.prepare("SELECT n,exp FROM limits WHERE k=?").bind(key).first();
  return !!r && r.exp > Date.now() && r.n >= 10;
}

async function listItems(db, kind, status, forAdmin) {
  if (kind === "comments") {
    const { results } = await db
      .prepare(
        `SELECT c.id,c.post_id,c.text,c.status,c.reason,c.publish_at,c.created_at${forAdmin ? ",c.ip" : ""},p.text post_text,(SELECT COUNT(*) FROM comment_reports r WHERE r.comment_id=c.id) reports,(SELECT group_concat(r.reason || ': ' || COALESCE(r.details,''), char(10)) FROM comment_reports r WHERE r.comment_id=c.id) report_notes FROM comments c LEFT JOIN posts p ON p.id=c.post_id WHERE c.status=? ORDER BY c.id DESC LIMIT 200`,
      )
      .bind(status)
      .all();
    return results;
  }
  if (kind === "requests") {
    const { results } = await db
      .prepare(
        `SELECT id,text,status,reason,created_at${forAdmin ? ",ip" : ""} FROM poll_requests WHERE status=? ORDER BY id DESC LIMIT 200`,
      )
      .bind(status)
      .all();
    return results;
  }
  const { results } = await db
    .prepare(
      `SELECT p.id,p.text,p.edited_text,p.status,p.reason,p.publish_at,p.created_at,p.tag${forAdmin ? ",p.ip" : ""},(SELECT COUNT(*) FROM reports r WHERE r.post_id=p.id) reports,(SELECT group_concat(r.reason || ': ' || COALESCE(r.details,''), char(10)) FROM reports r WHERE r.post_id=p.id) report_notes,(SELECT COALESCE(SUM(n),0) FROM reaction_counts rc WHERE rc.post_id=p.id) score FROM posts p WHERE p.status=? ORDER BY p.id DESC LIMIT 200`,
    )
    .bind(status)
    .all();
  return results;
}

async function applyAction(db, kind, action, id, by, extra) {
  const now = Date.now();
  if (kind === "requests") {
    const st = { approve: "approved", archive: "pending", delete: "dismissed" }[action];
    if (!st) return "Invalid action.";
    await db.prepare("UPDATE poll_requests SET status=? WHERE id=?").bind(st, id).run();
    return null;
  }
  const table = kind === "comments" ? "comments" : "posts";
  if (action === "approve")
    await db
      .prepare(`UPDATE ${table} SET status='live',reason=NULL,threshold=100,publish_at=? WHERE id=?`)
      .bind(now, id)
      .run();
  else if (action === "archive")
    await db.prepare(`UPDATE ${table} SET status='archived',reason=? WHERE id=?`).bind(by, id).run();
  else if (action === "delete")
    await db.prepare(`UPDATE ${table} SET status='deleted' WHERE id=?`).bind(id).run();
  else if (action === "restore")
    await db.prepare(`UPDATE ${table} SET status='archived',reason='restored' WHERE id=?`).bind(id).run();
  else if (action === "edit" && table === "posts") {
    const t = safeText(extra && extra.text);
    if (t.length < 5 || t.length > 1000) return "Edited text must be 5 to 1000 characters.";
    await db.prepare("UPDATE posts SET edited_text=? WHERE id=?").bind(t, id).run();
  } else return "Invalid action.";
  return null;
}

async function moderator(req, env, p, set) {
  const db = env.DB;
  const ih = await hmac(env.SALT, "ip" + ipOf(req)),
    lockKey = "modfail:" + ih;
  if (await lockedOut(db, lockKey))
    return J({ error: "Too many failed sign-ins. Try again in 15 minutes." }, 429);
  const mod = await authModerator(req, env);
  if (!mod) {
    await hit(db, lockKey, 10, 15 * MIN);
    return J({ error: "Incorrect moderator credentials." }, 401);
  }
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const url = new URL(req.url);
  if (p === "/api/mod/me") return J({ username: mod.username });
  if (p === "/api/mod/list") {
    const kind = url.searchParams.get("kind") === "comments" ? "comments" : "posts";
    return J({ items: await listItems(db, kind, "archived", false), admin_only: await adminOnlyReasons(db) });
  }
  if (p === "/api/mod/action" && req.method === "POST") {
    const id = Number(body.id),
      kind = body.kind === "comments" ? "comments" : "posts";
    if (!id || !["approve", "archive", "delete"].includes(body.action))
      return J({ error: "Invalid review action." }, 400);
    const row = await db.prepare(`SELECT id,reason FROM ${kind} WHERE id=?`).bind(id).first();
    if (!row) return J({ error: "Item not found." }, 404);
    if (body.action === "approve" && (await adminOnlyReasons(db)).includes(row.reason))
      return J({ error: "This item needs an admin review." }, 403);
    const err = await applyAction(db, kind, body.action, id, "moderator:" + mod.username);
    return err ? J({ error: err }, 400) : J({ ok: true });
  }
  if (p === "/api/mod/chat/summary") {
    const un = async (room, extra, ...args) =>
      +(await db
        .prepare(`SELECT COUNT(*) n FROM mod_msgs m WHERE m.room=? ${extra} AND NOT EXISTS (SELECT 1 FROM mod_seen s WHERE s.msg_id=m.id AND s.mod_id=?)`)
        .bind(room, ...args, mod.id)
        .first()).n || 0;
    return J({
      announce: await un("announce", ""),
      lounge: await un("lounge", "AND NOT (m.sender='mod' AND m.mod_id=?)", mod.id),
      dm: await un("dm", "AND m.mod_id=? AND m.sender='admin'", mod.id),
    });
  }
  if (p === "/api/mod/chat") {
    const room = CHAT_ROOMS.includes(url.searchParams.get("room")) ? url.searchParams.get("room") : "announce",
      after = Math.max(0, +url.searchParams.get("after") || 0),
      msgs = await chatMsgs(db, room, mod.id, after);
    // Moderators never learn who has read what. Only the admin sees that.
    const fresh = msgs.filter((m) => !(m.sender === "mod" && m.mod_id === mod.id));
    if (fresh.length && url.searchParams.get("peek") !== "1") {
      const now = Date.now();
      await db.batch(fresh.map((m) => db.prepare("INSERT OR IGNORE INTO mod_seen(msg_id,mod_id,seen_at) VALUES(?,?,?)").bind(m.id, mod.id, now)));
    }
    return J({
      room,
      can_post: room !== "announce",
      messages: msgs.map((m) => ({ id: m.id, from: m.sender === "admin" ? "admin" : m.mod_id === mod.id ? "me" : "mod", name: chatName(m), body: m.body, created_at: m.created_at })),
    });
  }
  if (p === "/api/mod/chat/send" && req.method === "POST") {
    const room = String(body.room),
      text = safeText(body.text);
    if (room === "announce") return J({ error: "Only the admin can post in Announcements." }, 403);
    if (!["lounge", "dm"].includes(room)) return J({ error: "Unknown chat." }, 400);
    if (text.length < 1 || text.length > 1000) return J({ error: "Write between 1 and 1000 characters." }, 400);
    if (!(await hit(db, "mc:" + mod.id, 60, 5 * MIN))) return J({ error: "Slow down a little." }, 429);
    const m = await chatPost(db, room, mod.id, "mod", text);
    return J({ ok: true, message: { id: m.id, from: "me", name: mod.username, body: text, created_at: m.created_at } });
  }
  return NF();
}


// ---------- Moderator chat: announcements (admin posts), lounge (everyone), private line to the admin ----------
const CHAT_ROOMS = ["announce", "lounge", "dm"];
async function chatMsgs(db, room, modId, after) {
  const where = room === "dm" ? "m.room='dm' AND m.mod_id=?" : "m.room=?",
    bv = room === "dm" ? modId : room,
    cols = "m.id,m.sender,m.mod_id,m.body,m.created_at,u.username name",
    from = `FROM mod_msgs m LEFT JOIN mods u ON u.id=m.mod_id WHERE ${where}`;
  const { results } = after
    ? await db.prepare(`SELECT ${cols} ${from} AND m.id>? ORDER BY m.id LIMIT 200`).bind(bv, after).all()
    : await db.prepare(`SELECT * FROM (SELECT ${cols} ${from} ORDER BY m.id DESC LIMIT 150) ORDER BY id`).bind(bv).all();
  return results;
}
const chatName = (m) => (m.sender === "admin" ? "Admin" : m.name || "Moderator");
async function chatPost(db, room, modId, sender, body) {
  const now = Date.now(),
    r = await db
      .prepare("INSERT INTO mod_msgs(room,mod_id,sender,body,created_at) VALUES(?,?,?,?,?) RETURNING id")
      .bind(room, room === "dm" ? modId : sender === "admin" ? 0 : modId, sender, body, now)
      .first();
  return { id: r.id, created_at: now };
}

async function createMod(db, u) {
  const pass = rnd(14),
    salt = rnd(16),
    hash = await modHash(pass, salt);
  try {
    await db.prepare("INSERT INTO mods(username,pw_hash,salt,iters,created_at) VALUES(?,?,?,?,?)").bind(u, hash, salt, 0, Date.now()).run();
    return pass;
  } catch {
    return null;
  }
}

async function admin(req, env, p, url) {
  const db = env.DB,
    ih = await hmac(env.SALT, "ip" + ipOf(req)),
    lockKey = "adminfail:" + ih;
  if (await lockedOut(db, lockKey))
    return J({ error: "Too many failed sign-ins. Try again in 15 minutes." }, 429);
  if (!(await authAdmin(req, env))) {
    await hit(db, lockKey, 10, 15 * MIN);
    return J({ error: "Wrong password." }, 401);
  }
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (p === "/api/admin/dashboard") {
    const count = async (sql) => (await db.prepare(sql).all()).results;
    const posts = await count("SELECT status,COUNT(*) n FROM posts GROUP BY status");
    const comments = await count("SELECT status,COUNT(*) n FROM comments GROUP BY status");
    const requests = await count("SELECT status,COUNT(*) n FROM poll_requests GROUP BY status");
    const days = await count(
      "SELECT date(created_at/1000,'unixepoch') d,COUNT(*) n FROM posts WHERE created_at IS NOT NULL GROUP BY d ORDER BY d DESC LIMIT 14",
    );
    const mods = await count("SELECT id,username,created_at FROM mods ORDER BY id");
    const since = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
    const visitsRes = await db.prepare("SELECT day d,COUNT(*) n FROM visits WHERE day>=? GROUP BY day ORDER BY day DESC").bind(since).all();
    const tw = await db
      .prepare("SELECT COUNT(*) waiting,COALESCE(SUM(urgent),0) urgent FROM threads WHERE status='open' AND last_from='visitor'")
      .first();
    const fl = await db.prepare("SELECT COUNT(*) n FROM flags WHERE status='flagged'").first();
    return J({
      apps_pending: +(await db.prepare("SELECT COUNT(*) n FROM mod_apps WHERE status='pending'").first()).n || 0,
      flags_active: +fl.n || 0,
      admin_only: await adminOnlyReasons(db),
      posts, comments, requests, days, mods,
      visits: visitsRes.results,
      threads_waiting: +tw.waiting || 0,
      threads_urgent: +tw.urgent || 0,
      settings: await settings(db),
      poll: await pollData(db),
    });
  }
  if (p === "/api/admin/list") {
    const kind = KINDS.includes(url.searchParams.get("kind")) ? url.searchParams.get("kind") : "posts";
    const statuses = kind === "requests" ? ["pending", "approved", "dismissed"] : ["live", "archived", "deleted"];
    const st = statuses.includes(url.searchParams.get("status")) ? url.searchParams.get("status") : statuses[kind === "requests" ? 0 : 1];
    return J({ items: await listItems(db, kind, st, true) });
  }
  if (p === "/api/admin/action" && req.method === "POST") {
    const kind = KINDS.includes(b.kind) ? b.kind : "posts";
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Boolean).slice(0, 200);
    if (!ids.length) return J({ error: "Nothing selected." }, 400);
    for (const id of ids) {
      const err = await applyAction(db, kind, String(b.action), id, "admin", b);
      if (err) return J({ error: err }, 400);
    }
    return J({ ok: true });
  }
  if (p === "/api/admin/settings") {
    if (req.method === "GET") return J(await settings(db));
    const allowed = ["delay_min", "delay_max", "post_cooldown_min", "comment_cooldown_min", "report_threshold", "banner", "helplines", "rules_json", "comments_on", "cotd_id", "mod_path", "weekly_theme", "weekly_prompt", "flood_on", "flood_max", "flood_window_sec", "urgent_words", "mod_apply_on", "mod_apply_domains", "mod_apply_id_regex", "mod_apply_code", "share_limit"];
    const maxLen = { weekly_theme: 60, weekly_prompt: 200, mod_apply_domains: 200, mod_apply_id_regex: 80, mod_apply_code: 60 };
    for (const [k, v] of Object.entries(b || {})) {
      if (!allowed.includes(k)) continue;
      let val = String(v).slice(0, maxLen[k] || 4000);
      if (k in maxLen) val = val.trim();
      if (k === "urgent_words") {
        try { val = JSON.stringify(cleanWords(JSON.parse(String(v)), 200)); } catch { return J({ error: "Urgent words must be a list." }, 400); }
      }
      if (k === "mod_apply_on") val = v === "1" || v === true ? "1" : "0";
      if (k === "mod_apply_id_regex" && val) {
        if (UNSAFE_RE.test(val)) return J({ error: "That roll number pattern is too risky. Keep it simple." }, 400);
        try { new RegExp(val, "i"); } catch { return J({ error: "That roll number pattern is not valid." }, 400); }
      }
      if (k === "share_limit") val = String(clampN(v, 1, 1000, 20));
      if (k === "flood_on") val = v === "0" || v === false ? "0" : "1";
      if (k === "flood_max") val = String(clampN(v, 2, 100000, 100));
      if (k === "flood_window_sec") val = String(clampN(v, 10, 86400, 200));
      if (k === "mod_path") {
        val = val.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
        if (!val || ["api", "demo", "admin", "index"].includes(val) || val === env.ADMIN_PATH) continue;
      }
      await db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)").bind(k, val).run();
    }
    return J({ ok: true });
  }
  if (p === "/api/admin/kill" && req.method === "POST") {
    await db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('killed',?)").bind(b.on ? "1" : "0").run();
    return J({ ok: true });
  }
  if (p === "/api/admin/export") {
    const { results: posts } = await db
      .prepare("SELECT id,created_at,publish_at,ip,status,reason,tag,text,edited_text FROM posts ORDER BY id")
      .all();
    const { results: comments } = await db
      .prepare("SELECT id,post_id,created_at,publish_at,ip,status,reason,text FROM comments ORDER BY id")
      .all();
    return J({ exported_at: Date.now(), posts, comments });
  }
  if (p === "/api/admin/poll" && req.method === "POST") {
    const q = safeText(b.question),
      opts = Array.isArray(b.options) ? b.options.map(safeText).filter((x) => x && x.length < 100).slice(0, 4) : [];
    if (q.length < 5 || q.length > 200 || opts.length < 2) return J({ error: "Add a question and at least two options." }, 400);
    await db.prepare("UPDATE polls SET status='archived' WHERE status='live'").run();
    await db
      .prepare("INSERT INTO polls(question,options_json,status,created_at) VALUES(?,?,'live',?)")
      .bind(q, JSON.stringify(opts), Date.now())
      .run();
    return J({ ok: true });
  }
  if (p === "/api/admin/poll/close" && req.method === "POST") {
    await db.prepare("UPDATE polls SET status='archived' WHERE status='live'").run();
    return J({ ok: true });
  }
  if (p === "/api/admin/mod" && req.method === "POST") {
    const u = safeText(b.username);
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(u)) return J({ error: "Use 3 to 20 letters, numbers or underscores." }, 400);
    const pass = await createMod(db, u);
    return pass ? J({ ok: true, password: pass }) : J({ error: "That moderator username is taken." }, 409);
  }
  if (p === "/api/admin/mod/revoke" && req.method === "POST") {
    const mid = Number(b.id) || 0;
    await db.prepare("DELETE FROM mods WHERE id=?").bind(mid).run();
    await db.prepare("DELETE FROM mod_msgs WHERE room='dm' AND mod_id=?").bind(mid).run();
    await db.prepare("DELETE FROM mod_seen WHERE mod_id=?").bind(mid).run();
    return J({ ok: true });
  }

  // ---- Messages from visitors (admin only; moderators have no access) ----
  if (p === "/api/admin/threads") {
    const st = url.searchParams.get("status") === "closed" ? "closed" : "open";
    const { results } = await db
      .prepare(
        `SELECT t.id,t.status,t.urgent,t.created_at,t.last_at,t.last_from,t.ip,
          (SELECT COUNT(*) FROM thread_msgs m WHERE m.thread_id=t.id) msgs,
          (SELECT body FROM thread_msgs m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) preview
         FROM threads t WHERE t.status=?
         ORDER BY t.urgent DESC,(t.last_from='visitor') DESC,t.last_at DESC LIMIT 200`,
      )
      .bind(st)
      .all();
    return J({
      items: results.map((r) => ({ ...r, preview: String(r.preview || "").slice(0, 140), waiting: r.status === "open" && r.last_from === "visitor" })),
    });
  }
  if (p === "/api/admin/thread") {
    const id = Number(url.searchParams.get("id")) || 0,
      after = Math.max(0, Number(url.searchParams.get("after")) || 0);
    const t = await db.prepare("SELECT id,status,urgent,created_at,last_at,last_from,ip FROM threads WHERE id=?").bind(id).first();
    if (!t) return J({ error: "Conversation not found." }, 404);
    const { results } = after
      ? await db.prepare("SELECT id,from_admin,body,created_at,ip,seen_at FROM thread_msgs WHERE thread_id=? AND id>? ORDER BY id LIMIT 200").bind(id, after).all()
      : await db.prepare("SELECT * FROM (SELECT id,from_admin,body,created_at,ip,seen_at FROM thread_msgs WHERE thread_id=? ORDER BY id DESC LIMIT 300) ORDER BY id").bind(id).all();
    // Admin messages that are still unseen can change later, so send their current state each time.
    const { results: unseen } = after
      ? await db.prepare("SELECT id,seen_at FROM thread_msgs WHERE thread_id=? AND from_admin=1 AND id<=? AND seen_at IS NOT NULL AND id>?").bind(id, after, Math.max(0, after - 60)).all()
      : { results: [] };
    return J({ thread: t, messages: results, partial: !!after, seen: unseen });
  }
  if (p === "/api/admin/thread/reply" && req.method === "POST") {
    const id = Number(b.id) || 0,
      text = safeText(b.text);
    if (text.length < 1 || text.length > 1000) return J({ error: "Write between 1 and 1000 characters." }, 400);
    const t = await db.prepare("SELECT id,status FROM threads WHERE id=?").bind(id).first();
    if (!t) return J({ error: "Conversation not found." }, 404);
    if (t.status !== "open") return J({ error: "Reopen the conversation before replying." }, 400);
    const now = Date.now();
    const m = await db.prepare("INSERT INTO thread_msgs(thread_id,from_admin,body,created_at) VALUES(?,?,?,?) RETURNING id").bind(id, 1, text, now).first();
    await db.prepare("UPDATE threads SET last_at=?,last_from='admin' WHERE id=?").bind(now, id).run();
    return J({ ok: true, message: { id: m.id, from_admin: 1, body: text, created_at: now, seen_at: null } });
  }
  if (p === "/api/admin/thread/status" && req.method === "POST") {
    const id = Number(b.id) || 0;
    if (!["open", "closed"].includes(b.status)) return J({ error: "Invalid status." }, 400);
    await db.prepare("UPDATE threads SET status=? WHERE id=?").bind(b.status, id).run();
    return J({ ok: true });
  }


  // ---- Editable site content (rules, prompts, privacy policy, announcement, every public text, apply form) ----
  if (p === "/api/admin/content") {
    const set = await settings(db),
      c = siteContent(set),
      texts = c.texts;
    return J({
      rules: c.rules,
      prompts: c.prompts,
      report_reasons: c.report_reasons,
      privacy: c.privacy,
      announce: { on: set.announce_on === "1", title: set.announce_title || "", body: set.announce_body || "", v: set.announce_v || "0" },
      apply_questions: applyQs(set).map(([id, q, min]) => ({ id, q, min })),
      apply_consents: applyCs(set).map(([id, t]) => ({ id, t })),
      texts: TEXT_REGISTRY.map((r) => ({ k: r.k, g: r.g, d: r.d, v: Object.prototype.hasOwnProperty.call(texts, r.k) ? String(texts[r.k]) : null })),
      custom: { rules: !!set.rules_list, prompts: !!set.prompts_list, report_reasons: !!set.report_reasons, privacy: !!set.privacy_text, apply_questions: !!set.apply_questions, apply_consents: !!set.apply_consents },
    });
  }
  if (p === "/api/admin/content/save" && req.method === "POST") {
    const put = (k, v) => db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)").bind(k, v).run(),
      list = (a, max, len) => (Array.isArray(a) ? a.map((x) => safeText(x).slice(0, len)).filter(Boolean).slice(0, max) : null);
    const reset = Array.isArray(b.reset) ? b.reset : [];
    const KEYMAP = { rules: "rules_list", prompts: "prompts_list", report_reasons: "report_reasons", privacy: "privacy_text", apply_questions: "apply_questions", apply_consents: "apply_consents", texts: "texts_json" };
    for (const k of reset) if (KEYMAP[k]) await put(KEYMAP[k], "");
    if ("rules" in b) { const a = list(b.rules, 80, 400); if (!a || !a.length) return J({ error: "Add at least one rule." }, 400); await put("rules_list", JSON.stringify(a)); }
    if ("prompts" in b) { const a = list(b.prompts, 100, 200); if (!a || !a.length) return J({ error: "Add at least one prompt." }, 400); await put("prompts_list", JSON.stringify(a)); }
    if ("report_reasons" in b) { const a = list(b.report_reasons, 15, 60); if (!a || a.length < 2) return J({ error: "Keep at least two report reasons." }, 400); await put("report_reasons", JSON.stringify(a)); }
    if ("privacy" in b) { const t = String(b.privacy || "").slice(0, 14000); if (t.trim().length < 20) return J({ error: "The privacy policy is too short." }, 400); await put("privacy_text", t); }
    if ("texts" in b && b.texts && typeof b.texts === "object") {
      const out = {};
      for (const r of TEXT_REGISTRY) {
        const v = b.texts[r.k];
        if (typeof v === "string" && v.trim() && v.trim() !== r.d) out[r.k] = v.trim().slice(0, 1200);
      }
      await put("texts_json", Object.keys(out).length ? JSON.stringify(out) : "");
    }
    if ("announce" in b && b.announce && typeof b.announce === "object") {
      const a = b.announce, title = safeText(a.title).slice(0, 120), body = String(a.body || "").trim().slice(0, 4000), cur = await settings(db);
      const on = a.on === true || a.on === "1";
      if (on && !title && !body) return J({ error: "Write a title or a message first." }, 400);
      await put("announce_on", on ? "1" : "0");
      await put("announce_title", title);
      await put("announce_body", body);
      // A new version number makes the full page open once more for every visitor.
      if (a.republish || title !== (cur.announce_title || "") || body !== (cur.announce_body || "") || (on && cur.announce_on !== "1")) await put("announce_v", String(Date.now()));
    }
    if ("apply_questions" in b) {
      if (!Array.isArray(b.apply_questions)) return J({ error: "Questions must be a list." }, 400);
      const seen = new Set(), out = [];
      for (const x of b.apply_questions.slice(0, 25)) {
        const q = safeText(x && x.q).slice(0, 400);
        if (!q) continue;
        let id = String((x && x.id) || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
        if (!id || seen.has(id)) id = "q" + (out.length + 1) + rnd(3).replace(/[^a-z0-9]/gi, "").toLowerCase();
        seen.add(id);
        out.push({ id, q, min: clampN(x.min, 0, 500, 0) });
      }
      if (!out.length) return J({ error: "Keep at least one question." }, 400);
      await put("apply_questions", JSON.stringify(out));
    }
    if ("apply_consents" in b) {
      if (!Array.isArray(b.apply_consents)) return J({ error: "Confirmations must be a list." }, 400);
      const seen = new Set(), out = [];
      for (const x of b.apply_consents.slice(0, 10)) {
        const t = safeText(x && x.t).slice(0, 500);
        if (!t) continue;
        let id = String((x && x.id) || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
        if (!id || seen.has(id)) id = "c" + (out.length + 1) + rnd(3).replace(/[^a-z0-9]/gi, "").toLowerCase();
        seen.add(id);
        out.push({ id, t });
      }
      if (!out.length) return J({ error: "Keep at least one confirmation." }, 400);
      await put("apply_consents", JSON.stringify(out));
    }
    return J({ ok: true });
  }

  // ---- Downtime schedule: the site vanishes (looks like a domain that does not exist) at chosen times ----
  if (p === "/api/admin/schedule") {
    const set = await settings(db);
    if (req.method === "POST") {
      const clean = { on: b.on !== false, tz: Number.isFinite(+b.tz) && +b.tz >= -720 && +b.tz <= 840 ? Math.round(+b.tz) : 345, weekly: [], once: [] };
      const okT = (s) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(s || ""));
      for (const w of (Array.isArray(b.weekly) ? b.weekly : []).slice(0, 60)) {
        const days = [...new Set((Array.isArray(w.days) ? w.days : []).map(Number).filter((d) => d >= 0 && d <= 6))].sort();
        if (!days.length || !okT(w.from) || !okT(w.to)) return J({ error: "Every routine needs at least one day and a start and end time." }, 400);
        clean.weekly.push({ days, from: String(w.from), to: String(w.to), note: safeText(w.note).slice(0, 80) });
      }
      const okD = (s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(s || ""));
      for (const o of (Array.isArray(b.once) ? b.once : []).slice(0, 60)) {
        if (!okD(o.from) || !okD(o.to)) return J({ error: "Every one-off break needs a start and an end date and time." }, 400);
        if (String(o.to) <= String(o.from)) return J({ error: "A one-off break must end after it starts." }, 400);
        clean.once.push({ from: String(o.from), to: String(o.to), note: safeText(o.note).slice(0, 80) });
      }
      await db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('sched_json',?)").bind(JSON.stringify(clean)).run();
      set.sched_json = JSON.stringify(clean);
    }
    const sc = jparse(set.sched_json, null) || { on: false, tz: 345, weekly: [], once: [] };
    return J({ schedule: { on: sc.on !== false && !!set.sched_json, tz: tzMin(set), weekly: sc.weekly || [], once: sc.once || [] }, down_now: schedDown(set), killed: set.killed === "1", now: Date.now() });
  }

  // ---- Moderator chat (admin side). Only the admin sees who has read what. ----
  if (p === "/api/admin/modchat/summary") {
    const rd = async (k) => +((await db.prepare("SELECT last_id FROM mod_admin_reads WHERE k=?").bind(k).first())?.last_id) || 0;
    const { results } = await db
      .prepare(
        `SELECT u.id,u.username,
          (SELECT COUNT(*) FROM mod_msgs m WHERE m.room='dm' AND m.mod_id=u.id AND m.sender='mod' AND m.id>COALESCE((SELECT last_id FROM mod_admin_reads r WHERE r.k='dm:'||u.id),0)) unread,
          (SELECT body FROM mod_msgs m WHERE m.room='dm' AND m.mod_id=u.id ORDER BY m.id DESC LIMIT 1) last_body,
          (SELECT created_at FROM mod_msgs m WHERE m.room='dm' AND m.mod_id=u.id ORDER BY m.id DESC LIMIT 1) last_at
         FROM mods u ORDER BY (last_at IS NULL),last_at DESC,u.username`,
      )
      .all();
    const lr = await rd("lounge"),
      lounge = await db.prepare("SELECT COUNT(*) n FROM mod_msgs WHERE room='lounge' AND sender='mod' AND id>?").bind(lr).first();
    return J({ mods: results.map((r) => ({ ...r, last_body: String(r.last_body || "").slice(0, 80) })), lounge_unread: +lounge.n || 0, total: results.length });
  }
  if (p === "/api/admin/modchat") {
    const room = CHAT_ROOMS.includes(url.searchParams.get("room")) ? url.searchParams.get("room") : "announce",
      modId = Number(url.searchParams.get("mod")) || 0,
      after = Math.max(0, Number(url.searchParams.get("after")) || 0);
    if (room === "dm" && !modId) return J({ error: "Choose a moderator." }, 400);
    const msgs = await chatMsgs(db, room, modId, after),
      total = +(await db.prepare("SELECT COUNT(*) n FROM mods").first()).n || 0;
    const seenBy = {};
    // Re-send the reader list for recent messages so ticks and names update live.
    const recent = after ? await chatMsgs(db, room, modId, Math.max(0, after - 40)) : msgs,
      ids = [...new Set([...recent, ...msgs].map((m) => m.id))];
    if (ids.length) {
      const { results } = await db
        .prepare(`SELECT s.msg_id,u.username,s.seen_at FROM mod_seen s JOIN mods u ON u.id=s.mod_id WHERE s.msg_id IN (${ids.map(() => "?").join(",")}) ORDER BY s.seen_at`)
        .bind(...ids)
        .all();
      for (const r of results) (seenBy[r.msg_id] ||= []).push({ name: r.username, at: r.seen_at });
    }
    const shape = (m) => ({ id: m.id, from: m.sender === "admin" ? "admin" : "mod", name: chatName(m), body: m.body, created_at: m.created_at, seen_by: seenBy[m.id] || [] });
    const outMsgs = msgs.map(shape),
      refresh = after ? recent.filter((m) => m.id <= after).map(shape) : [];
    if (msgs.length) {
      const key = room === "dm" ? "dm:" + modId : room,
        top = Math.max(...msgs.map((m) => m.id));
      await db.prepare("INSERT INTO mod_admin_reads(k,last_id) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET last_id=MAX(last_id,excluded.last_id)").bind(key, top).run();
    }
    return J({ room, total, messages: outMsgs, refresh });
  }
  if (p === "/api/admin/modchat/send" && req.method === "POST") {
    const room = String(b.room),
      text = safeText(b.text);
    if (!CHAT_ROOMS.includes(room)) return J({ error: "Unknown chat." }, 400);
    if (text.length < 1 || text.length > 1500) return J({ error: "Write between 1 and 1500 characters." }, 400);
    let modId = 0;
    if (room === "dm") {
      modId = Number(b.mod) || 0;
      if (!(await db.prepare("SELECT id FROM mods WHERE id=?").bind(modId).first())) return J({ error: "That moderator no longer exists." }, 404);
    }
    const m = await chatPost(db, room, modId, "admin", text);
    return J({ ok: true, message: { id: m.id, from: "admin", name: "Admin", body: text, created_at: m.created_at, seen_by: [] } });
  }

  // ---- Flagged senders (message flood) ----
  if (p === "/api/admin/flags") {
    const st = url.searchParams.get("status") === "cleared" ? "cleared" : "flagged";
    const { results } = await db
      .prepare(
        `SELECT f.id,f.ip,f.kind,f.count,f.window_sec,f.status,f.created_at,f.cleared_at,
          (SELECT COUNT(*) FROM thread_msgs m WHERE m.ip=f.ip AND m.from_admin=0) sent,
          (SELECT MAX(m.thread_id) FROM thread_msgs m WHERE m.ip=f.ip AND m.from_admin=0) last_thread
         FROM flags f WHERE f.status=? ORDER BY f.id DESC LIMIT 200`,
      )
      .bind(st)
      .all();
    return J({ items: results });
  }
  if (p === "/api/admin/flag/clear" && req.method === "POST") {
    const f = await db.prepare("SELECT id,ih FROM flags WHERE id=? AND status='flagged'").bind(Number(b.id) || 0).first();
    if (!f) return J({ error: "That flag is already cleared." }, 404);
    await db.prepare("UPDATE flags SET status='cleared',cleared_at=? WHERE id=?").bind(Date.now(), f.id).run();
    await db.prepare("DELETE FROM limits WHERE k=?").bind("fl:" + f.ih).run(); // the count restarts from zero
    return J({ ok: true });
  }
  if (p === "/api/admin/flag/add" && req.method === "POST") {
    const t = await db.prepare("SELECT ip FROM threads WHERE id=?").bind(Number(b.thread_id) || 0).first();
    if (!t || !t.ip) return J({ error: "No network address is stored for that conversation." }, 404);
    const ih = await hmac(env.SALT, "ip" + t.ip);
    if (await db.prepare("SELECT id FROM flags WHERE ih=? AND status='flagged'").bind(ih).first()) return J({ error: "This sender is already flagged." }, 409);
    await db.prepare("INSERT INTO flags(ih,ip,kind,count,window_sec,status,created_at) VALUES(?,?,'manual',0,0,'flagged',?)").bind(ih, t.ip, Date.now()).run();
    return J({ ok: true });
  }

  // ---- Filter rules ----
  if (p === "/api/admin/rules") {
    const rs = await getRuleset(db);
    return J({ rules: rs.rules, allow: rs.allow, urgent: await urgentList(db), custom: rs.custom });
  }
  if (p === "/api/admin/rules/save" && req.method === "POST") {
    const c = cleanRules(b);
    if (c.error) return J({ error: c.error }, 400);
    const urgent = cleanWords(b.urgent, 200);
    await db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('rules_v2',?)").bind(JSON.stringify({ rules: c.rules, allow: c.allow })).run();
    await db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('urgent_words',?)").bind(urgent.length ? JSON.stringify(urgent) : "").run();
    return J({ ok: true });
  }
  if (p === "/api/admin/rules/reset" && req.method === "POST") {
    for (const k of ["rules_v2", "urgent_words", "rules_json"]) await db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES(?,'')").bind(k).run();
    return J({ ok: true });
  }
  if (p === "/api/admin/rules/test" && req.method === "POST") {
    const text = String(b.text || "").slice(0, 1000);
    if (Array.isArray(b.rules)) { // preview using the edits on screen, before saving
      const c = cleanRules(b);
      if (c.error) return J({ error: c.error }, 400);
      const h = firstHit(compileRuleset(c), text), uw = cleanWords(b.urgent, 200), ure = wordsRe(uw.length ? uw : DEFAULT_URGENT);
      return J({ reason: h ? h.reason : "", rule: h ? h.id : "", urgent: !!ure && ure.test(text) });
    }
    const m = await matchRule(db, text);
    return J({ reason: m ? m.reason : "", rule: m ? m.id : "", urgent: await isUrgent(db, text) });
  }

  // ---- Moderator applications (admin only) ----
  if (p === "/api/admin/apps") {
    const st = APP_STATUSES.includes(url.searchParams.get("status")) ? url.searchParams.get("status") : "pending";
    const { results } = await db
      .prepare("SELECT id,status,name,roll,program,year,created_at,decided_at,has_id,mod_username FROM mod_apps WHERE status=? ORDER BY id DESC LIMIT 200")
      .bind(st)
      .all();
    return J({ items: results });
  }
  if (p === "/api/admin/app") {
    const a = await db.prepare("SELECT * FROM mod_apps WHERE id=?").bind(Number(url.searchParams.get("id")) || 0).first();
    if (!a) return J({ error: "Application not found." }, 404);
    let answers = [];
    try { answers = JSON.parse(a.answers_json || "[]"); } catch {}
    const { dedupe, answers_json, ...rest } = a;
    return J({ app: { ...rest, answers } });
  }
  if (p === "/api/admin/app/id") {
    const f = await db.prepare("SELECT mime,data FROM mod_app_ids WHERE app_id=?").bind(Number(url.searchParams.get("id")) || 0).first();
    if (!f) return J({ error: "No ID photo is stored for this application." }, 404);
    const bin = atob(f.data), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Response(bytes, { headers: { "content-type": f.mime, "cache-control": "no-store", "x-content-type-options": "nosniff", "content-disposition": "inline" } });
  }
  if (p === "/api/admin/app/decide" && req.method === "POST") {
    const a = await db.prepare("SELECT id,status FROM mod_apps WHERE id=?").bind(Number(b.id) || 0).first();
    if (!a) return J({ error: "Application not found." }, 404);
    if (a.status !== "pending") return J({ error: "This application was already decided." }, 400);
    const note = safeText(b.note).slice(0, 300);
    let password = null, username = null;
    if (b.decision === "accept") {
      username = safeText(b.username);
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return J({ error: "Choose a moderator username: 3 to 20 letters, numbers or underscores." }, 400);
      password = await createMod(db, username);
      if (!password) return J({ error: "That moderator username is taken." }, 409);
    } else if (b.decision !== "reject") return J({ error: "Invalid decision." }, 400);
    await db.prepare("UPDATE mod_apps SET status=?,decided_at=?,note=?,mod_username=?,has_id=0 WHERE id=?")
      .bind(b.decision === "accept" ? "accepted" : "rejected", Date.now(), note, username, a.id).run();
    await db.prepare("DELETE FROM mod_app_ids WHERE app_id=?").bind(a.id).run(); // the ID photo is deleted on any decision
    return J({ ok: true, password, username });
  }
  if (p === "/api/admin/app/erase" && req.method === "POST") {
    const id = Number(b.id) || 0;
    await db.prepare("UPDATE mod_apps SET name=NULL,roll=NULL,program=NULL,year=NULL,email=NULL,phone=NULL,answers_json=NULL,ip=NULL,dedupe=NULL,has_id=0,note=NULL WHERE id=?").bind(id).run();
    await db.prepare("DELETE FROM mod_app_ids WHERE app_id=?").bind(id).run();
    return J({ ok: true });
  }
  return NF();
}
