
/* ACD BITTU LAB CLOUD — Super Admin Controls
 * Requires dashboard.html to expose its existing Supabase client:
 * immediately after const db=window.supabase.createClient(...), add:
 * window.db = db;
 * This file does not modify Patient Entry, catalogue, billing, printing or login.
 */
(() => {
  "use strict";

  const db = window.db;
  const nav = document.getElementById("nav");
  const workspace = document.getElementById("workspace");
  if (!db || !nav || !workspace) {
    console.error("Super Admin controls: dashboard client or container not found.");
    return;
  }

  const state = { role: null, labId: null, labs: [], devices: [], controls: [] };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

  const style = document.createElement("style");
  style.textContent = `
    #acdSuperAdminPanel{display:none;background:#f7f9fc;min-height:360px;gap:12px}
    #acdSuperAdminPanel .sa-card{background:#fff;border:1px solid #dce3eb;border-radius:9px;padding:14px;box-shadow:0 1px 3px #152b4510}
    #acdSuperAdminPanel h2{font-size:17px;margin:0 0 5px;color:#173f83}
    #acdSuperAdminPanel h3{font-size:13px;margin:0 0 10px;color:#173f83}
    #acdSuperAdminPanel .sa-muted{color:#667085;font-size:11px}
    #acdSuperAdminPanel .sa-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    #acdSuperAdminPanel .sa-row>*{max-width:100%}
    #acdSuperAdminPanel select,#acdSuperAdminPanel input{min-width:160px;max-width:320px;height:34px;border:1px solid #d0d7e2;border-radius:6px;padding:6px 9px;background:white}
    #acdSuperAdminPanel .sa-tabs{display:flex;gap:6px;flex-wrap:wrap}
    #acdSuperAdminPanel .sa-tabs button{border:1px solid #d0d7e2;background:#fff;border-radius:6px;padding:8px 11px;cursor:pointer;font-size:11px}
    #acdSuperAdminPanel .sa-tabs button.active{background:#075bd4;color:#fff;border-color:#075bd4}
    #acdSuperAdminPanel .sa-table{width:100%;border-collapse:collapse;font-size:11px}
    #acdSuperAdminPanel .sa-table th{background:#173f83;color:white;text-align:left;padding:9px}
    #acdSuperAdminPanel .sa-table td{border:1px solid #e2e7ee;padding:8px;vertical-align:middle}
    #acdSuperAdminPanel .sa-switch{width:18px;height:18px;min-width:18px;vertical-align:middle}
    #acdSuperAdminPanel .sa-status{font-size:10px;font-weight:700;border-radius:20px;padding:4px 8px;background:#e8eef6;color:#344054}
    #acdSuperAdminPanel .sa-online{background:#dcfce7;color:#166534}
    #acdSuperAdminPanel .sa-offline{background:#fee2e2;color:#991b1b}
    #acdSuperAdminPanel .sa-message{font-size:11px;min-height:18px;color:#067647;margin-top:8px}
    #acdSuperAdminPanel .sa-danger{background:#b42318!important;color:#fff!important}
    @media(max-width:600px){#acdSuperAdminPanel .sa-table{min-width:680px}#acdSuperAdminPanel .sa-scroll{overflow:auto}}
  `;
  document.head.appendChild(style);

  const panel = document.createElement("section");
  panel.id = "acdSuperAdminPanel";
  panel.innerHTML = `
    <div class="sa-card">
      <div class="sa-row" style="justify-content:space-between">
        <div><h2>Super Admin Console</h2><div class="sa-muted">Platform-wide controls. Changes are saved securely in Supabase.</div></div>
        <button class="btn light" id="saRefresh">↻ Refresh</button>
      </div>
      <div class="sa-tabs" style="margin-top:13px">
        <button data-sa-tab="devices" class="active">Device Management</button>
        <button data-sa-tab="platform">Platform Mode</button>
        <button data-sa-tab="features">Master Control</button>
      </div>
    </div>
    <div id="saDevices" class="sa-card">
      <h3>Device Management</h3>
      <div class="sa-muted">View current device locks and reset a user's active device session when required.</div>
      <div class="sa-scroll" style="margin-top:12px">
        <table class="sa-table"><thead><tr><th>User</th><th>Role</th><th>Laboratory</th><th>Device ID</th><th>Last Heartbeat</th><th>Status</th><th>Action</th></tr></thead>
        <tbody id="saDeviceRows"><tr><td colspan="7">Loading device sessions…</td></tr></tbody></table>
      </div>
      <div id="saDeviceMessage" class="sa-message" aria-live="polite"></div>
    </div>
    <div id="saPlatform" class="sa-card" style="display:none">
      <h3>Platform Mode</h3>
      <p class="sa-muted">TEST/LIVE mode is platform-wide. LIVE mode can start or resume eligible trial periods.</p>
      <div class="sa-row" style="margin-top:12px">
        <strong>Current mode:</strong><span id="saCurrentMode" class="sa-status">Loading…</span>
        <button class="btn" id="saTestMode">Set TEST Mode</button>
        <button class="btn green" id="saLiveMode">Set LIVE Mode</button>
      </div>
      <div id="saPlatformMessage" class="sa-message" aria-live="polite"></div>
    </div>
    <div id="saFeatures" class="sa-card" style="display:none">
      <h3>Master Control — Lab Feature Visibility</h3>
      <div class="sa-row">
        <label for="saLabSelect"><strong>Select laboratory:</strong></label>
        <select id="saLabSelect"><option value="">Loading laboratories…</option></select>
        <button class="btn light" id="saLoadFeatures">Load Controls</button>
      </div>
      <div class="sa-muted" style="margin:8px 0 12px">Hide or show a module for the selected lab. You can separately allow its Lab Admin to customize the module settings.</div>
      <div class="sa-scroll">
        <table class="sa-table"><thead><tr><th>Module</th><th>Visible to lab</th><th>Lab Admin can customize</th><th>Save</th></tr></thead>
        <tbody id="saFeatureRows"><tr><td colspan="4">Select a laboratory.</td></tr></tbody></table>
      </div>
      <div id="saFeatureMessage" class="sa-message" aria-live="polite"></div>
    </div>
  `;
  workspace.appendChild(panel);

  const controls = [
    { key: "devices", label: "Device Management" },
    { key: "platform", label: "Platform Mode" },
    { key: "features", label: "Master Control" }
  ];
  const navButtons = controls.map(item => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.saNav = item.key;
    b.textContent = item.key === "devices" ? "▣ Device Management" :
                    item.key === "platform" ? "◉ Platform Mode" : "⚙ Master Control";
    b.style.cssText = "margin-top:2px;color:#ffcf8b";
    nav.appendChild(b);
    return b;
  });

  function showConsole(tab = "devices") {
    document.querySelectorAll(".nav button").forEach(b => b.classList.remove("active"));
    const clicked = navButtons.find(b => b.dataset.saNav === tab);
    if (clicked) clicked.classList.add("active");
    $("entryPage")?.classList.add("hidden");
    $("cataloguePage")?.classList.add("hidden");
    $("otherPage")?.classList.add("hidden");
    panel.style.display = "grid";
    $("pageTitle").textContent = "Super Admin — " + controls.find(x => x.key === tab).label;
    setTab(tab);
  }

  function setTab(tab) {
    document.querySelectorAll("[data-sa-tab]").forEach(b =>
      b.classList.toggle("active", b.dataset.saTab === tab)
    );
    $("saDevices").style.display = tab === "devices" ? "block" : "none";
    $("saPlatform").style.display = tab === "platform" ? "block" : "none";
    $("saFeatures").style.display = tab === "features" ? "block" : "none";
    if (tab === "devices") loadDevices();
    if (tab === "platform") loadPlatformMode();
    if (tab === "features") loadLabs();
  }

  navButtons.forEach(b => b.addEventListener("click", () => showConsole(b.dataset.saNav)));
  panel.querySelectorAll("[data-sa-tab]").forEach(b =>
    b.addEventListener("click", () => setTab(b.dataset.saTab))
  );

  async function requireSuperAdmin() {
    const { data: userData, error: userError } = await db.auth.getUser();
    if (userError || !userData?.user) return false;
    const { data: profile, error } = await db.from("profiles")
      .select("platform_role").eq("id", userData.user.id).maybeSingle();
    if (error) throw error;
    state.role = profile?.platform_role || null;
    return state.role === "super_admin";
  }

  async function loadDevices() {
    const body = $("saDeviceRows");
    body.innerHTML = '<tr><td colspan="7">Loading…</td></tr>';
    try {
      const { data, error } = await db.rpc("acd_superadmin_list_device_sessions");
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      state.devices = rows;
      body.innerHTML = rows.length ? rows.map(d => {
        const online = d.status === "online";
        const time = d.heartbeat_at ? new Date(d.heartbeat_at).toLocaleString() : "—";
        return `<tr>
          <td><strong>${esc(d.full_name || d.email || d.user_id)}</strong><br><span class="sa-muted">${esc(d.email || "")}</span></td>
          <td>${esc(d.platform_role || "lab user")}</td>
          <td>${esc((d.lab_names || []).join(", ") || "—")}</td>
          <td><code>${esc(d.device_id || "—")}</code></td>
          <td>${esc(time)}</td>
          <td><span class="sa-status ${online ? "sa-online" : "sa-offline"}">${online ? "ONLINE" : "OFFLINE"}</span>${d.takeover_pending ? "<br><small>Takeover pending</small>" : ""}</td>
          <td><button class="btn sa-danger" data-reset-user="${esc(d.user_id)}" ${d.user_id === window.acdCurrentUserId ? "disabled" : ""}>Force Reset</button></td>
        </tr>`;
      }).join("") : '<tr><td colspan="7">No device sessions found.</td></tr>';
      body.querySelectorAll("[data-reset-user]").forEach(button => {
        button.addEventListener("click", () => resetDevice(button.dataset.resetUser, button));
      });
      $("saDeviceMessage").textContent = "Device list updated.";
    } catch (e) {
      body.innerHTML = `<tr><td colspan="7">Could not load devices: ${esc(e.message)}</td></tr>`;
      $("saDeviceMessage").textContent = "Device list load failed.";
    }
  }

  async function resetDevice(userId, button) {
    if (!confirm("इस user का मौजूदा device session reset करना है? User को दोबारा login करना होगा.")) return;
    button.disabled = true;
    try {
      const { data, error } = await db.rpc("acd_superadmin_force_device_reset", { p_user_id: userId });
      if (error) throw error;
      $("saDeviceMessage").textContent = data ? "Device session reset successfully." : "इस user का कोई active device session नहीं मिला.";
      await loadDevices();
    } catch (e) {
      $("saDeviceMessage").textContent = "Reset failed: " + e.message;
      button.disabled = false;
    }
  }

  async function loadPlatformMode() {
    $("saCurrentMode").textContent = "Loading…";
    try {
      const { data, error } = await db.rpc("acd_get_platform_mode");
      if (error) throw error;
      const mode = String(data?.mode || "test").toLowerCase();
      $("saCurrentMode").textContent = mode.toUpperCase();
      $("saCurrentMode").className = "sa-status " + (mode === "live" ? "sa-online" : "");
      $("saPlatformMessage").textContent = "Mode loaded from Supabase.";
    } catch (e) {
      $("saCurrentMode").textContent = "ERROR";
      $("saPlatformMessage").textContent = "Could not load mode: " + e.message;
    }
  }

  async function changePlatformMode(mode) {
    if (mode === "live" && !confirm("LIVE MODE चालू करने से eligible Lab Admin trials शुरू/फिर से शुरू हो सकते हैं। क्या आप सुनिश्चित हैं?")) return;
    if (mode === "test" && !confirm("Platform को TEST MODE में बदलना है?")) return;
    $("saTestMode").disabled = $("saLiveMode").disabled = true;
    $("saPlatformMessage").textContent = "Saving…";
    try {
      const { data, error } = await db.rpc("acd_superadmin_set_platform_mode", { p_mode: mode });
      if (error) throw error;
      $("saPlatformMessage").textContent = `Saved successfully. Resumed trials: ${Number(data?.resumed_trials || 0)}.`;
      await loadPlatformMode();
    } catch (e) {
      $("saPlatformMessage").textContent = "Save failed: " + e.message;
    } finally {
      $("saTestMode").disabled = $("saLiveMode").disabled = false;
    }
  }
  $("saTestMode").addEventListener("click", () => changePlatformMode("test"));
  $("saLiveMode").addEventListener("click", () => changePlatformMode("live"));

  async function loadLabs() {
    const select = $("saLabSelect");
    if (!state.labs.length) {
      select.innerHTML = '<option value="">Loading laboratories…</option>';
      try {
        const { data, error } = await db.from("cloud_labs")
          .select("id,name").eq("is_active", true).order("name");
        if (error) throw error;
        state.labs = data || [];
      } catch (e) {
        select.innerHTML = `<option value="">Load error: ${esc(e.message)}</option>`;
        $("saFeatureMessage").textContent = "Could not load labs.";
        return;
      }
    }
    select.innerHTML = '<option value="">Choose laboratory</option>' +
      state.labs.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("");
    if (state.labId && state.labs.some(l => l.id === state.labId)) select.value = state.labId;
    else if (state.labs.length === 1) { select.value = state.labs[0].id; state.labId = select.value; }
    if (select.value) await loadFeatureControls();
  }
  $("saLabSelect").addEventListener("change", async () => {
    state.labId = $("saLabSelect").value;
    await loadFeatureControls();
  });
  $("saLoadFeatures").addEventListener("click", loadFeatureControls);

  async function loadFeatureControls() {
    const labId = $("saLabSelect").value;
    state.labId = labId;
    if (!labId) {
      $("saFeatureRows").innerHTML = '<tr><td colspan="4">पहले laboratory चुनें।</td></tr>';
      return;
    }
    $("saFeatureRows").innerHTML = '<tr><td colspan="4">Loading controls…</td></tr>';
    try {
      const { data, error } = await db.rpc("acd_lab_get_feature_controls", { p_lab_id: labId });
      if (error) throw error;
      state.controls = Array.isArray(data) ? data : [];
      $("saFeatureRows").innerHTML = state.controls.length ? state.controls.map(item => `
        <tr data-feature="${esc(item.feature_key)}">
          <td><strong>${esc(item.feature_name)}</strong><br><small class="sa-muted">${esc(item.feature_key)}</small></td>
          <td><input class="sa-switch" type="checkbox" data-visible ${item.is_visible ? "checked" : ""} aria-label="Visible"></td>
          <td><input class="sa-switch" type="checkbox" data-customize ${item.lab_admin_can_customize ? "checked" : ""} aria-label="Lab Admin can customize"></td>
          <td><button class="btn" data-save-feature>Save</button></td>
        </tr>`).join("") : '<tr><td colspan="4">No active features found in feature catalogue.</td></tr>';
      $("saFeatureRows").querySelectorAll("[data-save-feature]").forEach(button => {
        button.addEventListener("click", () => saveFeature(button.closest("tr"), button));
      });
      $("saFeatureMessage").textContent = "Feature controls loaded.";
    } catch (e) {
      $("saFeatureRows").innerHTML = `<tr><td colspan="4">Could not load controls: ${esc(e.message)}</td></tr>`;
      $("saFeatureMessage").textContent = "Load failed: " + e.message;
    }
  }

  async function saveFeature(row, button) {
    const featureKey = row.dataset.feature;
    const visible = row.querySelector("[data-visible]").checked;
    const customize = row.querySelector("[data-customize]").checked;
    button.disabled = true;
    try {
      const existingSettings =
        state.controls.find(item => item.feature_key === featureKey)?.settings || {};
      const { error } = await db.rpc("acd_superadmin_set_lab_feature", {
        p_lab_id: state.labId,
        p_feature_key: featureKey,
        p_is_visible: visible,
        p_lab_admin_can_customize: customize,
        p_settings: existingSettings
      });
      if (error) throw error;
      $("saFeatureMessage").textContent = `${featureKey}: saved successfully.`;
    } catch (e) {
      $("saFeatureMessage").textContent = `Save failed (${featureKey}): ${e.message}`;
    } finally {
      button.disabled = false;
    }
  }

  $("saRefresh").addEventListener("click", async () => {
    if ($("saDevices").style.display !== "none") await loadDevices();
    if ($("saPlatform").style.display !== "none") await loadPlatformMode();
    if ($("saFeatures").style.display !== "none") await loadFeatureControls();
  });

  (async () => {
    try {
      const allowed = await requireSuperAdmin();
      if (!allowed) {
        navButtons.forEach(b => b.remove());
        panel.remove();
        style.remove();
        return;
      }
      const { data } = await db.auth.getUser();
      window.acdCurrentUserId = data?.user?.id || null;

      // Keep existing navigation behavior intact; Super Admin controls use their own view.
      const originalButtons = [...nav.querySelectorAll("button[data-page]")];
      originalButtons.forEach(b => {
        if (b.dataset.page === "Super Admin") {
          // Capture phase prevents the old placeholder handler from replacing this console.
          b.addEventListener("click", event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            showConsole("devices");
          }, true);
        } else {
          b.addEventListener("click", () => { panel.style.display = "none"; });
        }
      });

      // Do not change the dashboard's existing landing page on login.
      // The console opens only when the Super Admin navigation item is selected.
    } catch (e) {
      console.error("Super Admin initialization failed:", e);
      navButtons.forEach(b => b.remove());
      panel.remove();
      style.remove();
    }
  })();
})();
