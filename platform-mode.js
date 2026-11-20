(function () {
  const db = window.db;
  if (!db) {
    console.error("Supabase client not found");
    return;
  }

  const nav = document.getElementById("nav");
  const content = document.querySelector(".content");

  if (!nav || !content) {
    console.error("Dashboard elements not found");
    return;
  }

  async function setupPlatformMode() {
    const { data: userData, error: userError } =
      await db.auth.getUser();

    if (userError || !userData.user) return;

    const userId = userData.user.id;

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("platform_role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || profile?.platform_role !== "super_admin") {
      return;
    }

    const button = document.createElement("button");
    button.textContent = "Platform Mode";
    button.style.cssText =
      "width:100%;padding:12px;margin-top:8px;border:0;border-radius:8px;background:#263b59;color:white;font-weight:bold;";

    nav.appendChild(button);

    const panel = document.createElement("section");
    panel.style.cssText =
      "display:none;padding:20px;margin:15px;background:white;border:1px solid #ddd;border-radius:12px;";

    panel.innerHTML = `
      <h2>Platform Mode Control</h2>
      <p>Current Mode: <strong id="platformModeValue">Loading...</strong></p>
      <button id="testModeBtn" style="padding:12px;margin:5px;background:#2563eb;color:white;border:0;border-radius:8px;">TEST MODE</button>
      <button id="liveModeBtn" style="padding:12px;margin:5px;background:#15803d;color:white;border:0;border-radius:8px;">LIVE MODE</button>
      <p id="platformModeMessage"></p>
    `;

    content.insertBefore(panel, content.firstChild);

    button.onclick = async function () {
      panel.style.display =
        panel.style.display === "none" ? "block" : "none";
      await loadMode();
    };

    async function loadMode() {
      const label = document.getElementById("platformModeValue");
      const message = document.getElementById("platformModeMessage");

      label.textContent = "Loading...";

      const { data, error } =
        await db.rpc("acd_get_platform_mode");

      if (error) {
        label.textContent = "Error";
        message.textContent = error.message;
        return;
      }

      label.textContent = (data?.mode || "test").toUpperCase();
      message.textContent = "Platform mode loaded.";
    }

    async function changeMode(mode) {
      if (
        mode === "live" &&
        !confirm("LIVE MODE चालू करने से Lab Admin trial शुरू कर सकते हैं। क्या आप तैयार हैं?")
      ) {
        return;
      }

      const message = document.getElementById("platformModeMessage");
      message.textContent = "Saving...";

      const { error } = await db.rpc(
        "acd_superadmin_set_platform_mode",
        { p_mode: mode }
      );

      if (error) {
        message.textContent = "Error: " + error.message;
        return;
      }

      message.textContent =
        "Platform mode changed to " + mode.toUpperCase();

      await loadMode();
    }

    document.getElementById("testModeBtn").onclick =
      () => changeMode("test");

    document.getElementById("liveModeBtn").onclick =
      () => changeMode("live");

    await loadMode();
  }

  setupPlatformMode().catch(console.error);
})();
