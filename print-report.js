/* =========================================================
   ACD BITTU LAB CLOUD — COMBINED A4 PRINT, DESIGN & WHATSAPP MODULE
   ========================================================= */
(function () {
  "use strict";

  const DEFAULT_DESIGN = {
    labName: "",
    tagline: "Computerized Pathology & Diagnostic Laboratory",
    address: "",
    phone: "",
    email: "",
    regNo: "",
    accentColor: "#0b4fa8",
    fontSize: "11px",
    headerLogo: "",
    headerBanner: "",
    leftSigName: "Lab Technician",
    leftSigQual: "DMLT / BMLT",
    leftSigImg: "",
    rightSigName: "Consultant Pathologist",
    rightSigQual: "MBBS, MD (Pathology)",
    rightSigImg: "",
    showQr: true,
    showUnit: true,
    showRef: true,
    showStatus: true,
    showAddress: true,
    showSampleType: true,
    footerNote: "Note: Clinical correlation is essential. Test results pertain only to the sample tested."
  };

  function esc(val) {
    return String(val ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function getDesignStorageKey(currentLabId) {
    return "acd_print_design_" + (currentLabId || "default");
  }

  function loadReportDesign(currentLabId, labObj) {
    let saved = {};
    try {
      const raw = localStorage.getItem(getDesignStorageKey(currentLabId));
      if (raw) saved = JSON.parse(raw);
    } catch (e) {
      console.warn("Design local load warning:", e);
    }

    const merged = Object.assign({}, DEFAULT_DESIGN, saved);
    if (!merged.labName && labObj?.name) merged.labName = labObj.name;
    if (!merged.address && labObj?.address) merged.address = labObj.address;
    if (!merged.phone && labObj?.phone) merged.phone = labObj.phone;
    return merged;
  }

  async function saveReportDesign(currentLabId, designData) {
    // Keep report-only preferences separate from the canonical cloud_labs record.
    // This prevents a print-layout edit from silently changing lab master details.
    const key = getDesignStorageKey(currentLabId);
    localStorage.setItem(key, JSON.stringify(designData));
    return designData;
  }

  function evaluateFlag(resultVal, refRange) {
    const num = Number(String(resultVal ?? "").replace(/,/g, "").trim());
    if (!String(resultVal ?? "").trim() || !Number.isFinite(num)) return "";
    const nums = String(refRange ?? "").match(/\d[\d,]*(?:\.\d+)?/g);
    if (!nums || nums.length < 2) return "";
    const low = Number(nums[0].replace(/,/g, ""));
    const high = Number(nums[1].replace(/,/g, ""));
    if (!Number.isFinite(low) || !Number.isFinite(high)) return "";
    if (num < low) return "Low";
    if (num > high) return "High";
    return "Normal";
  }

  function patientId(report) {
    const p = report.patient || {};
    return p.patient_code || p.patient_uid || p.id || "NOT ASSIGNED";
  }

  function buildQrText(report, design) {
    // Until a secured public-report endpoint exists, QR carries only Patient ID.
    return "ACD BITTU LAB CLOUD | PATIENT ID: " + patientId(report);
  }

  function renderBarcodeInto(container, value) {
    if (!container) return;
    container.innerHTML = "";
    const text = String(value || "").trim();
    if (!text || text === "NOT ASSIGNED") return;
    if (typeof window.JsBarcode === "function") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      container.appendChild(svg);
      try { window.JsBarcode(svg, text, { format: "CODE128", displayValue: true, fontSize: 9, height: 28, margin: 0 }); }
      catch (e) { container.textContent = text; }
    } else {
      container.textContent = text;
      container.classList.add("acd-barcode-fallback");
    }
  }

  function renderQrInto(container, text) {
    if (!container) return;
    container.innerHTML = "";
    try {
      if (typeof window.QRCode === "function") {
        new window.QRCode(container, {
          text: text,
          width: 60,
          height: 60,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.M
        });
        return;
      }
    } catch (e) {
      console.warn("QRCode library fallback:", e);
    }
    container.innerHTML = '<div style="font-size:8px;text-align:center;color:#334155">VERIFIED<br>REPORT</div>';
  }

  function buildFullHeaderHTML(design) {
    const banner = design.headerBanner
      ? `<img src="${design.headerBanner}" class="acd-lab-header-banner" alt="Lab Banner">`
      : "";
    const logo = !design.headerBanner && design.headerLogo
      ? `<img src="${design.headerLogo}" class="acd-lab-logo" alt="Lab Logo">`
      : "";
    const regHtml = design.regNo ? ` • Reg. No: ${esc(design.regNo)}` : "";
    const contactParts = [
      design.address ? esc(design.address) : "",
      design.phone ? "Mob: " + esc(design.phone) : "",
      design.email ? "Email: " + esc(design.email) : ""
    ].filter(Boolean).join(" | ");

    return `
      ${banner}
      <div class="acd-lab-header">
        ${logo}
        <div class="acd-lab-info">
          <h1 class="acd-lab-name">${esc(design.labName || "PATHOLOGY LABORATORY")}</h1>
          ${design.tagline ? `<div class="acd-lab-tagline">${esc(design.tagline)}${regHtml}</div>` : ""}
          ${contactParts ? `<div class="acd-lab-contact">${contactParts}</div>` : ""}
        </div>
      </div>
    `;
  }

  function buildPatientBoxHTML(report, design, pageIndex) {
    const p = report.patient || {};
    const fullName = [p.title, p.patient_name].filter(Boolean).join(" ").trim() || "-";
    const ageGender = [
      p.age !== null && p.age !== undefined && p.age !== "" ? `${p.age} ${p.age_unit || "Y"}` : "",
      p.gender || ""
    ].filter(Boolean).join(" / ") || "-";

    return `
      <div class="acd-patient-box">
        <div class="acd-patient-col">
          <div class="acd-patient-row"><b>Patient Name:</b><span><strong>${esc(fullName)}</strong></span></div>
          <div class="acd-patient-row"><b>Age / Gender:</b><span>${esc(ageGender)}</span></div>
          ${p.mobile ? `<div class="acd-patient-row"><b>Mobile No.:</b><span>${esc(p.mobile)}</span></div>` : ""}
          ${design.showAddress && p.address ? `<div class="acd-patient-row"><b>Address:</b><span>${esc(p.address)}</span></div>` : ""}
        </div>
        <div class="acd-patient-col">
          <div class="acd-patient-row"><b>Patient ID:</b><span>${esc(patientId(report))}</span></div>
          <div class="acd-patient-row"><b>Report Date:</b><span>${esc(report.order_date || "-")}</span></div>
          <div class="acd-barcode-box" data-acd-barcode="${pageIndex}"></div>
          <div class="acd-patient-row"><b>Ref. Doctor:</b><span>${esc(report.ref_doctor || "Self")}</span></div>
          ${design.showSampleType && p.sample_type ? `<div class="acd-patient-row"><b>Sample Type:</b><span>${esc(p.sample_type)}</span></div>` : ""}
        </div>
        ${design.showQr ? `<div class="acd-qr-box" data-acd-qr="${pageIndex}"></div>` : ""}
      </div>
      <div class="acd-report-banner-title">LABORATORY INVESTIGATION REPORT</div>
    `;
  }

  function buildContHeaderHTML(report, design) {
    const p = report.patient || {};
    const fullName = [p.title, p.patient_name].filter(Boolean).join(" ").trim() || "-";
    return `
      <div class="acd-cont-header">
        <div><strong>${esc(design.labName || "LABORATORY")}</strong> — Pathology Report (Continued)</div>
        <div>Patient: <strong>${esc(fullName)}</strong> | ID: ${esc(report.id || "DRAFT")} | Date: ${esc(report.order_date || "-")}</div>
      </div>
    `;
  }

  function buildFooterHTML(design, pageNum, totalPages) {
    const isLast = pageNum === totalPages;
    return `
      <div class="acd-a4-footer">
        <div class="acd-sig-grid">
          <div class="acd-sig-block">
            ${design.leftSigImg ? `<img src="${design.leftSigImg}" class="acd-sig-img" alt="Technician Signature">` : `<div style="height:32px"></div>`}
            <div class="acd-sig-line">${esc(design.leftSigName || "Lab Technician")}</div>
            <div class="acd-sig-sub">${esc(design.leftSigQual || "")}</div>
          </div>
          <div class="acd-footer-center">
            <div><strong>${isLast ? "*** END OF REPORT ***" : "Continued on Next Page →"}</strong></div>
            <div style="margin-top:2px">Page ${pageNum} of ${totalPages}</div>
          </div>
          <div class="acd-sig-block">
            ${design.rightSigImg ? `<img src="${design.rightSigImg}" class="acd-sig-img" alt="Pathologist Signature">` : `<div style="height:32px"></div>`}
            <div class="acd-sig-line">${esc(design.rightSigName || "Consultant Pathologist")}</div>
            <div class="acd-sig-sub">${esc(design.rightSigQual || "")}</div>
          </div>
        </div>
        <div class="acd-footer-note">
          <span>${esc(design.footerNote || "")}</span>
          <span>Powered by ACD BITTU LAB CLOUD</span>
        </div>
      </div>
    `;
  }

  function buildTableHeadHTML(design) {
    return `
      <thead>
        <tr>
          <th style="width:36%">Investigation / Parameter</th>
          <th style="width:18%">Result</th>
          ${design.showUnit ? `<th style="width:14%">Unit</th>` : ""}
          ${design.showRef ? `<th style="width:20%">Reference Range</th>` : ""}
          ${design.showStatus ? `<th style="width:12%">Flag</th>` : ""}
        </tr>
      </thead>
    `;
  }

  function fullTestName(name) {
    const raw = String(name || "").trim();
    const key = raw.toUpperCase().replace(/\s+/g, " ").trim();
    const names = {
      CBC: "COMPLETE BLOOD COUNT (CBC)", KFT: "KIDNEY FUNCTION TEST (KFT)",
      LFT: "LIVER FUNCTION TEST (LFT)", RFT: "RENAL FUNCTION TEST (RFT)",
      TFT: "THYROID FUNCTION TEST (TFT)", ESR: "ERYTHROCYTE SEDIMENTATION RATE (ESR)",
      CRP: "C-REACTIVE PROTEIN (CRP)", HBA1C: "GLYCATED HAEMOGLOBIN (HbA1c)",
      FBS: "FASTING BLOOD SUGAR (FBS)", PPBS: "POST PRANDIAL BLOOD SUGAR (PPBS)",
      RBS: "RANDOM BLOOD SUGAR (RBS)", WIDAL: "WIDAL TEST",
      "URINE R/M": "URINE ROUTINE AND MICROSCOPY", "URINE RE": "URINE ROUTINE EXAMINATION"
    };
    return names[key] || raw.toUpperCase();
  }

  function buildTestGroupRowsHTML(testGroup, design) {
    const colSpan = 2 + (design.showUnit ? 1 : 0) + (design.showRef ? 1 : 0) + (design.showStatus ? 1 : 0);
    const rows = testGroup.rows || [];
    const dilutions = ["1:20", "1:40", "1:80", "1:160", "1:320", "1:640"];
    const antigens = ["S. Typhi O", "S. Typhi H", "S. Para Typhi AH", "S. Para Typhi BH"];
    const overall = rows.find(r => r.parameter_name === "Widal Test (Overall Result)");
    const isWidal = !!overall && antigens.some(a => rows.some(r => r.parameter_name.startsWith(a + " - ")));

    let html = `<tr class="acd-test-group-header"><td colspan="${colSpan}">${esc(fullTestName(testGroup.test_name))}</td></tr>`;

    if (isWidal) {
      html += `
        <tr>
          <td><strong>WIDAL TEST (OVERALL)</strong></td>
          <td><strong>${esc(overall.result_value || "-")}</strong></td>
          ${design.showUnit ? `<td>-</td>` : ""}
          ${design.showRef ? `<td>Positive / Negative</td>` : ""}
          ${design.showStatus ? `<td>-</td>` : ""}
        </tr>
        <tr>
          <td colspan="${colSpan}">
            <table class="acd-widal-table">
              <thead>
                <tr>
                  <th>ANTIGEN</th>
                  ${dilutions.map(d => `<th>${d}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${antigens.map(ant => `
                  <tr>
                    <td>${esc(ant)}</td>
                    ${dilutions.map(d => {
                      const cell = rows.find(x => x.parameter_name === ant + " - " + d);
                      return `<td>${esc(cell?.result_value || "-")}</td>`;
                    }).join("")}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </td>
        </tr>
      `;
      return html;
    }

    rows.forEach(r => {
      const val = String(r.result_value ?? "").trim();
      if (!val) return;
      const flag = r.status_flag || evaluateFlag(val, r.reference_range);
      const isAbnormal = flag === "Low" || flag === "High";
      html += `
        <tr>
          <td>${esc(r.parameter_name)}</td>
          <td class="${isAbnormal ? "acd-res-abnormal" : "acd-res-normal"}">${esc(val)}</td>
          ${design.showUnit ? `<td>${esc(r.unit || "-")}</td>` : ""}
          ${design.showRef ? `<td>${esc(r.reference_range || "-")}</td>` : ""}
          ${design.showStatus ? `<td class="${isAbnormal ? "acd-res-abnormal" : ""}">${esc(flag || "-")}</td>` : ""}
        </tr>
      `;
    });

    return html;
  }

  function createPageShell(report, design, pageIndex) {
    const page = document.createElement("div");
    page.className = "acd-a4-page";
    page.style.setProperty("--report-accent", design.accentColor || "#0b4fa8");
    page.style.setProperty("--report-font-size", design.fontSize || "11px");

    const topHtml = buildFullHeaderHTML(design) + buildPatientBoxHTML(report, design, pageIndex);

    page.innerHTML = `
      <div class="acd-a4-top">${topHtml}</div>
      <div class="acd-a4-body">
        <table class="acd-report-table">
          ${buildTableHeadHTML(design)}
          <tbody></tbody>
        </table>
      </div>
      <div class="acd-a4-footer-slot"></div>
    `;
    return page;
  }

  function applyMobileViewportScale(viewport) {
    const pages = viewport.querySelectorAll(".acd-a4-page");
    if (!pages.length) return;
    const availWidth = Math.max(280, window.innerWidth - 20);
    const a4Px = 794;
    if (window.innerWidth <= 820 && availWidth < a4Px) {
      const scale = availWidth / a4Px;
      pages.forEach(p => {
        p.style.transform = `scale(${scale.toFixed(4)})`;
        p.style.marginBottom = `-${Math.round(1123 * (1 - scale) - 14)}px`;
      });
    } else {
      pages.forEach(p => {
        p.style.transform = "";
        p.style.marginBottom = "";
      });
    }
  }

  function buildWhatsAppMessage(report, design) {
    const p = report.patient || {};
    const fullName = [p.title, p.patient_name].filter(Boolean).join(" ").trim() || "Patient";
    const lines = [
      `*${design.labName || "PATHOLOGY LABORATORY"}*`,
      `📋 *Pathology Investigation Report*`,
      `👤 *Patient:* ${fullName} (${p.age || "-"} ${p.age_unit || "Y"} / ${p.gender || "-"})`,
      `🆔 *Patient ID:* ${patientId(report)}`,
      `📅 *Date:* ${report.order_date || "-"}`,
      `🩺 *Ref. Doctor:* ${report.ref_doctor || "Self"}`,
      `------------------------`
    ];

    (report.tests || []).forEach(t => {
      const filled = (t.rows || []).filter(r => String(r.result_value ?? "").trim() !== "");
      if (!filled.length) return;
      lines.push(`*${t.test_name.toUpperCase()}*`);
      filled.slice(0, 12).forEach(r => {
        const flag = r.status_flag || evaluateFlag(r.result_value, r.reference_range);
        const flagTag = flag && flag !== "Normal" ? ` [${flag}]` : "";
        lines.push(`• ${r.parameter_name}: *${r.result_value}* ${r.unit || ""}${flagTag}`.trim());
      });
      if (filled.length > 12) {
        lines.push(`... (+${filled.length - 12} more parameters in A4 PDF report)`);
      }
    });

    lines.push(`------------------------`);
    lines.push(`Please collect/print full signed A4 report from the laboratory.`);
    return lines.join("\n");
  }

  function shareReportOnWhatsApp(report, currentLabId, labObj) {
    const design = loadReportDesign(currentLabId, labObj);
    const text = buildWhatsAppMessage(report, design);
    const rawMobile = String(report.patient?.mobile || "").replace(/\D/g, "");
    const phone = rawMobile.length === 10 ? "91" + rawMobile : rawMobile;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }

  function ensureOverlay() {
    let overlay = document.getElementById("acdPrintOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "acdPrintOverlay";
    overlay.className = "hidden";
    overlay.innerHTML = `
      <div class="acd-print-toolbar">
        <div class="acd-print-toolbar-title">
          <span>🖨️ Combined A4 Report Preview</span>
          <small id="acdPrintPageCount" style="color:#93c5fd"></small>
        </div>
        <div class="acd-print-toolbar-actions">
          <button type="button" class="acd-btn-print primary" id="acdDoPrintBtn">🖨️ Print / Save PDF</button>
          <button type="button" class="acd-btn-print whatsapp" id="acdDoWhatsappBtn">📲 Send WhatsApp</button>
          <button type="button" class="acd-btn-print close" id="acdClosePrintBtn">✕ Close</button>
        </div>
      </div>
      <div class="acd-print-viewport" id="acdPrintViewport"></div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("acdClosePrintBtn").onclick = () => {
      overlay.classList.add("hidden");
    };
    document.getElementById("acdDoPrintBtn").onclick = () => {
      window.print();
    };
    window.addEventListener("resize", () => {
      if (!overlay.classList.contains("hidden")) {
        applyMobileViewportScale(document.getElementById("acdPrintViewport"));
      }
    });

    return overlay;
  }

  function openCombinedA4Print(report, options = {}) {
    const currentLabId = options.labId || window.labId || null;
    const labObj = options.lab || null;
    const design = loadReportDesign(currentLabId, labObj);

    const validGroups = (report.tests || [])
      .map(t => ({
        test_name: t.test_name,
        rows: (t.rows || []).filter(r => String(r.result_value ?? "").trim() !== "")
      }))
      .filter(t => t.rows.length > 0);

    if (!validGroups.length) {
      alert("Print करने के लिए कम से कम एक Test Result भरें।");
      return;
    }

    const overlay = ensureOverlay();
    const viewport = document.getElementById("acdPrintViewport");
    viewport.innerHTML = "";
    overlay.classList.remove("hidden");

    document.getElementById("acdDoWhatsappBtn").onclick = () => {
      shareReportOnWhatsApp(report, currentLabId, labObj);
    };

    const pages = [];
    let currentPage = createPageShell(report, design, 1);
    currentPage.querySelector(".acd-a4-footer-slot").innerHTML = buildFooterHTML(design, 1, 1);
    viewport.appendChild(currentPage);
    pages.push(currentPage);

    const getMaxBodyHeight = pageEl => {
      const bodyEl = pageEl.querySelector(".acd-a4-body");
      return bodyEl.clientHeight || 620;
    };

    validGroups.forEach(group => {
      const tbody = currentPage.querySelector("tbody");
      const groupHtml = buildTestGroupRowsHTML(group, design);

      const beforeHtml = tbody.innerHTML;
      tbody.insertAdjacentHTML("beforeend", groupHtml);

      const tableHeight = currentPage.querySelector(".acd-report-table").offsetHeight;
      const maxH = getMaxBodyHeight(currentPage);

      if (tableHeight > maxH && beforeHtml.trim() !== "") {
        tbody.innerHTML = beforeHtml;
        currentPage = createPageShell(report, design, pages.length + 1);
        currentPage.querySelector(".acd-a4-footer-slot").innerHTML = buildFooterHTML(design, pages.length + 1, pages.length + 1);
        viewport.appendChild(currentPage);
        pages.push(currentPage);

        const nextTbody = currentPage.querySelector("tbody");
        nextTbody.insertAdjacentHTML("beforeend", groupHtml);
      }

      while (currentPage.querySelector(".acd-report-table").offsetHeight > getMaxBodyHeight(currentPage)) {
        const activeTbody = currentPage.querySelector("tbody");
        const allTrs = [...activeTbody.querySelectorAll("tr")];
        if (allTrs.length <= 2) break;

        const overflowRows = [];
        while (
          currentPage.querySelector(".acd-report-table").offsetHeight > getMaxBodyHeight(currentPage) &&
          activeTbody.querySelectorAll("tr").length > 2
        ) {
          const lastTr = activeTbody.lastElementChild;
          overflowRows.unshift(lastTr.outerHTML);
          lastTr.remove();
        }

        if (!overflowRows.length) break;

        currentPage = createPageShell(report, design, pages.length + 1);
        currentPage.querySelector(".acd-a4-footer-slot").innerHTML = buildFooterHTML(design, pages.length + 1, pages.length + 1);
        viewport.appendChild(currentPage);
        pages.push(currentPage);

        const colSpan = 2 + (design.showUnit ? 1 : 0) + (design.showRef ? 1 : 0) + (design.showStatus ? 1 : 0);
        const contTbody = currentPage.querySelector("tbody");
        contTbody.innerHTML =
          `<tr class="acd-test-group-header"><td colspan="${colSpan}">${esc(fullTestName(group.test_name))} (Contd.)</td></tr>` +
          overflowRows.join("");
      }
    });

    const totalPages = pages.length;
    pages.forEach((pg, idx) => {
      pg.querySelector(".acd-a4-footer-slot").innerHTML = buildFooterHTML(design, idx + 1, totalPages);
    });

    pages.forEach(pg => {
      if (design.showQr) renderQrInto(pg.querySelector("[data-acd-qr]"), buildQrText(report, design));
      renderBarcodeInto(pg.querySelector("[data-acd-barcode]"), patientId(report));
    });

    document.getElementById("acdPrintPageCount").textContent = `(${totalPages} A4 Page${totalPages > 1 ? "s" : ""})`;
    applyMobileViewportScale(viewport);

    if (options.autoPrint) {
      setTimeout(() => window.print(), 250);
    }
  }

  window.ACDPrintModule = {
    DEFAULT_DESIGN,
    loadReportDesign,
    saveReportDesign,
    openCombinedA4Print,
    shareReportOnWhatsApp,
    evaluateFlag
  };
})();
