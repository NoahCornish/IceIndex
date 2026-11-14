
"use strict";

/*
  IceIndex v0.12.0 — Member Authentication
  Manual Access Edition

  - Supabase authentication
  - No public registration
  - Membership requests by email
  - Administrator approval dashboard
  - Approved-member access for game exports
*/

(() => {
  const URL = "https://kufgsjknsvaufwtxrxsu.supabase.co";
  const KEY = "sb_publishable_nx_C_d1pIRhykXREn0goSw_6XpVKOLp";

  const CONTACT_EMAIL = "noahcornish.github@gmail.com";

  let client;
  let session = null;
  let profile = null;

  const listeners = new Set();

  const $ = id => document.getElementById(id);

  const safe = s =>
    String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  function notify() {
    listeners.forEach(fn => {
      try {
        fn({ session, profile });
      } catch (error) {
        console.warn(error);
      }
    });
  }

  function status() {
    return profile?.approval_status ||
      (session ? "pending" : "visitor");
  }

  function approved() {
    return !!session?.user &&
      profile?.approval_status === "approved";
  }

  function admin() {
    return approved() && profile?.is_admin === true;
  }

  async function refresh() {
    if (!client) return;

    const { data, error } = await client.auth.getUser();

    if (error || !data?.user) {
      session = null;
      profile = null;
      paint();
      notify();
      return;
    }

    session = { user: data.user };

    const result = await client
      .from("member_profiles")
      .select("user_id,email,approval_status,is_admin")
      .eq("user_id", data.user.id)
      .maybeSingle();

    profile = result.data || null;

    paint();
    notify();
  }

  function paint() {
    const button = $("ice-member-button");
    if (!button) return;

    button.textContent = approved()
      ? (admin() ? "Admin account" : "My account")
      : session
        ? "Pending approval"
        : "Log in";

    button.title = session
      ? `Membership: ${status()}`
      : "Log in to IceIndex";
  }

  function message(text, bad = false) {
    const el = $("ice-member-message");

    if (el) {
      el.textContent = text;
      el.style.color = bad ? "#ffb4b4" : "#a9d6ff";
    }
  }

  function modal(open = true) {
    const el = $("ice-member-modal");
    if (!el) return;

    el.hidden = !open;

    if (open) {
      render();
      $("ice-member-email")?.focus();
    }
  }

  function render() {
    const content = $("ice-member-content");
    if (!content) return;

    if (!session) {
      renderLogin();
    } else {
      renderAccount();
    }
  }

  // ==========================================
  // LOGIN
  // ==========================================

  function renderLogin() {
    const content = $("ice-member-content");

    content.innerHTML = `
      <h2 id="ice-member-title">
        IceIndex Members
      </h2>

      <p>
        Sign in to access exclusive IceIndex
        member features.
        Membership is available by request only.
      </p>

      <form id="ice-member-form">

        <label>
          Email
          <input
            id="ice-member-email"
            type="email"
            autocomplete="email"
            required
          >
        </label>

        <label>
          Password
          <input
            id="ice-member-password"
            type="password"
            autocomplete="current-password"
            minlength="8"
            required
          >
        </label>

        <div class="ice-member-actions">

          <button
            type="submit"
            class="btn primary"
          >
            Log in
          </button>

          <button
            type="button"
            class="btn secondary"
            id="ice-member-register"
          >
            Request access
          </button>

        </div>

      </form>

      <p
        id="ice-member-message"
        role="status"
      ></p>
    `;

    $("ice-member-form").onsubmit = async event => {
      event.preventDefault();
      await signIn();
    };

    $("ice-member-register").onclick = renderRequestAccess;
  }

  // ==========================================
  // REQUEST ACCESS — EMAIL ONLY
  // ==========================================

  function renderRequestAccess() {
    const content = $("ice-member-content");

    const subject = encodeURIComponent(
      "IceIndex Membership Request"
    );

    const body = encodeURIComponent(
      "Hello,\n\n" +
      "I would like to request access to " +
      "IceIndex member features.\n\n" +
      "Name:\n" +
      "Email:\n\n" +
      "Thank you."
    );

    const mailto =
      `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

    content.innerHTML = `
      <h2 id="ice-member-title">
        Request IceIndex Access
      </h2>

      <p>
        IceIndex membership is currently
        available by request only.
      </p>

      <p>
        To request an account, please contact
        the IceIndex administrator.
      </p>

      <div style="
        margin: 22px 0;
        padding: 20px;
        border: 1px solid rgba(88,184,255,.25);
        border-radius: 12px;
        background: rgba(88,184,255,.06);
      ">

        <div style="
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: #9fb9cf;
          margin-bottom: 9px;
        ">
          Membership inquiries
        </div>

        <a
          href="${mailto}"
          style="
            color: #58b8ff;
            font-weight: 700;
            overflow-wrap: anywhere;
            text-decoration: none;
          "
        >
          ${CONTACT_EMAIL}
        </a>

      </div>

      <p>
        If your request is accepted, an
        administrator will create your
        account and provide login instructions.
      </p>

      <div class="ice-member-actions">

        <a
          class="btn primary"
          href="${mailto}"
        >
          Email to request access
        </a>

        <button
          type="button"
          class="btn secondary"
          id="ice-member-back"
        >
          Back to login
        </button>

      </div>

      <p
        id="ice-member-message"
        role="status"
      ></p>
    `;

    $("ice-member-back").onclick = renderLogin;
  }

  // ==========================================
  // ACCOUNT
  // ==========================================

  function renderAccount() {
    const content = $("ice-member-content");

    content.innerHTML = `
      <h2 id="ice-member-title">
        Your IceIndex account
      </h2>

      <p>
        <strong>${safe(session.user.email)}</strong>
      </p>

      <p>
        Membership status:
        <strong>${safe(status().toUpperCase())}</strong>
      </p>

      <p>
        ${
          approved()
            ? "You can use member export tools."
            : status() === "rejected"
              ? "This account has not been approved."
              : "Your account is awaiting administrator approval."
        }
      </p>

      <div class="ice-member-actions">

        ${
          admin()
            ? `<button
                 class="btn secondary"
                 id="ice-admin-open"
                 type="button"
               >
                 Review applications
               </button>`
            : ""
        }

        <button
          class="btn secondary"
          id="ice-member-signout"
          type="button"
        >
          Sign out
        </button>

      </div>

      <div id="ice-admin-panel"></div>

      <p
        id="ice-member-message"
        role="status"
      ></p>
    `;

    $("ice-member-signout").onclick = async () => {
      const { error } = await client.auth.signOut();

      if (error) {
        message(error.message, true);
        return;
      }

      session = null;
      profile = null;

      render();
      paint();
      notify();
    };

    if (admin()) {
      $("ice-admin-open").onclick = renderAdmin;
    }
  }

  // ==========================================
  // SIGN IN
  // ==========================================

  async function signIn() {
    if (!client) {
      message("Authentication is unavailable.", true);
      return;
    }

    message("Signing in…");

    const { error } = await client.auth.signInWithPassword({
      email: $("ice-member-email").value.trim(),
      password: $("ice-member-password").value
    });

    if (error) {
      message(error.message, true);
      return;
    }

    await refresh();
    render();
  }

  // ==========================================
  // ADMIN DASHBOARD
  // ==========================================

  async function renderAdmin() {
    const target = $("ice-admin-panel");
    if (!target || !admin()) return;

    target.textContent = "Loading member accounts…";

    const { data, error } = await client
      .from("member_profiles")
      .select("user_id,email,approval_status,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      target.textContent = error.message;
      return;
    }

    const rows = (data || []).filter(
      row => row.user_id !== session.user.id
    );

    target.innerHTML = `
      <h3>Member accounts</h3>

      ${
        rows.length
          ? rows.map(row => `
              <div class="ice-member-row">

                <span>
                  <strong>
                    ${safe(row.email || row.user_id)}
                  </strong>

                  <small>
                    ${safe(row.approval_status)}
                  </small>
                </span>

                <select
                  data-user="${safe(row.user_id)}"
                  aria-label="Approval for ${safe(row.email)}"
                >

                  <option
                    value="pending"
                    ${row.approval_status === "pending"
                      ? "selected" : ""}
                  >
                    Pending
                  </option>

                  <option
                    value="approved"
                    ${row.approval_status === "approved"
                      ? "selected" : ""}
                  >
                    Approved
                  </option>

                  <option
                    value="rejected"
                    ${row.approval_status === "rejected"
                      ? "selected" : ""}
                  >
                    Rejected
                  </option>

                </select>

              </div>
            `).join("")
          : "<p>No member accounts yet.</p>"
      }
    `;

    target
      .querySelectorAll("select[data-user]")
      .forEach(select => {

        select.onchange = async () => {
          const previousStatus = rows.find(
            row => row.user_id === select.dataset.user
          )?.approval_status;

          select.disabled = true;

          const { error } = await client.rpc(
            "iceindex_set_approval",
            {
              target_user: select.dataset.user,
              new_status: select.value
            }
          );

          if (error) {
            message(
              "Approval update failed: " + error.message,
              true
            );

            if (previousStatus) {
              select.value = previousStatus;
            }
          } else {
            message("Membership updated.");
            await renderAdmin();
          }

          select.disabled = false;
        };
      });
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  function init() {
    if (!window.supabase?.createClient) {
      console.error("Supabase library unavailable");
      return;
    }

    client = window.supabase.createClient(URL, KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    $("ice-member-button")?.addEventListener(
      "click",
      () => modal(true)
    );

    $("ice-member-close")?.addEventListener(
      "click",
      () => modal(false)
    );

    $("ice-member-modal")?.addEventListener(
      "click",
      event => {
        if (event.target.id === "ice-member-modal") {
          modal(false);
        }
      }
    );

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        modal(false);
      }
    });

    client.auth.onAuthStateChange(() => {
      setTimeout(refresh, 0);
    });

    refresh();
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  window.IceIndexMembers = {
    isApproved: approved,
    isAdmin: admin,
    getStatus: status,
    open: () => modal(true),
    subscribe: fn => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    refresh
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
