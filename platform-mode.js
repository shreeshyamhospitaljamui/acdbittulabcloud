/* ============================================================================
   ACD BITTU LAB CLOUD — Super Admin Controls Compatibility Bridge
   Platform Mode (TEST/LIVE) and Per-Lab Feature Visibility Controls are
   integrated directly inside the unified Super Admin Control Center
   (#superAdminCenter) in dashboard.html so there are no duplicate sidebars.
   ============================================================================ */
(() => {
  "use strict";

  window.ACDPlatformModeBridge = Object.freeze({
    unified: true,
    openSuperAdminTab(tabKey = "overview") {
      const saNavBtn = document.querySelector('#nav button[data-page="Super Admin"]');
      if (saNavBtn) saNavBtn.click();
      if (typeof window.switchSuperAdminTab === "function") {
        window.switchSuperAdminTab(tabKey);
      }
    }
  });
})();
