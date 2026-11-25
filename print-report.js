/* =========================================================
   ACD BITTU LAB CLOUD — CUSTOMIZABLE A4 PRINT, DIRECT PDF,
   NABL VERIFICATION STAMP, QR VERIFICATION & WHATSAPP MODULE
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
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "11px",
    headerFontSize: "20px",
    subHeaderFontSize: "10.5px",
    patientFontSize: "11px",
    testHeadingFontSize: "11.5px",
    rowSpacing: "4.5px",
    marginTopMm: 10,
    marginBottomMm: 9,
    marginSideMm: 12,
    headerHeightMm: 0,
    patientGapMm: 2,
    reportGapMm: 2,
    patientBoxStyle: "boxed",
    showHeader: true,
    showLabName: true,
    showReportBanner: true,
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
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
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
    } catch (e) {}

    const merged = Object.assign({}, DEFAULT_DESIGN, saved);
    if (!merged.labName && labObj?.name) merged.labName = labObj.name;
    if (!merged.address && labObj?.address) merged.address = labObj.address;
    if (!merged.phone && labObj?.phone) merged.phone = labObj.phone;
    return merged;
  }

  async function saveReportDesign(currentLabId, designData, supabaseClient) {
    localStorage.setItem(getDesignStorageKey(currentLabId), JSON.stringify(designData));
    const client = supabaseClient || window.db;
    if (client && currentLabId) {
      try {
        await client.rpc("acd_save_lab_report_settings", { p_lab_id: currentLabId, p_settings: designData });
      } catch (err) {}
    }
    return designData;
  }

  async function syncReportDesignFromCloud(currentLabId, labObj, supabaseClient) {
    const client = supabaseClient || window.db;
    const localDesign = loadReportDesign(currentLabId, labObj);
    if (!client || !currentLabId) return localDesign;
    try {
      const { data, error } = await client.rpc("acd_get_lab_report_settings", { p_lab_id: currentLabId });
      if (!error && data && typeof data === "object") {
        const cloudSettings = data.settings && typeof data.settings === "object" ? data.settings : data;
        if (Object.keys(cloudSettings).length) {
          const merged = Object.assign({}, localDesign, cloudSettings);
          if (!merged.labName && labObj?.name) merged.labName = labObj.name;
          localStorage.setItem(getDesignStorageKey(currentLabId), JSON.stringify(merged));
          return merged;
        }
      }
    } catch (e) {}
    return localDesign;
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

  async function resolveQrVerificationUrl(report, currentLabId) {
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, "verify.html");
    const orderId = String(report.id || "").trim();
    const client = window.db;

    if (client && currentLabId && orderId && !orderId.startsWith("DRAFT") && !orderId.startsWith("SAMPLE")) {
      try {
        const { data, error } = await client.rpc("acd_issue_report_qr_token", { p_lab_id: currentLabId, p_order_id: orderId });
        if (!error && data) {
          const token = data.token || data.qr_token || (typeof data === "string" ? data : "");
          if (token) return `${base}?token=${encodeURIComponent(token)}`;
        }
      } catch (e) {}
    }

    const params = new URLSearchParams();
    if (orderId) params.set("order", orderId);
    if (currentLabId) params.set("lab", currentLabId);
    params.set("pid", patientId(report));
    return `${base}?${params.toString()}`;
  }

  function renderBarcodeInto(container, value) {
    if (!container) return;
    container.innerHTML = "";
    const text = String(value || "").trim();
    if (!text || text === "NOT ASSIGNED") return;
    if (typeof window.JsBarcode === "function") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      container.appendChild(svg);
      try {
        window.JsBarcode(svg, text, { format: "CODE128", displayValue: true, fontSize: 9, height: 26, margin: 0 });
      } catch (e) {
        container.textContent = text;
      }
    } else {
      container.textContent = text;
    }
  }

  function renderQrInto(container, text) {
    if (!container) return;
    container.innerHTML = "";
    try {
      if (typeof window.QRCode === "function") {
        new window.QRCode(container, { text, width: 60, height: 60, colorDark: "#000000", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M });
        return;
      }
    } catch (e) {}
    container.innerHTML = '<div style="font-size:8px;text-align:center;color:#334155">SCAN<br>REPORT</div>';
  }

  function buildFullHeaderHTML(design) {
    if (design.showHeader === false) {
      const reservedH = Number(design.headerHeightMm || 0);
      return reservedH > 0 ? `<div class="acd-lab-header-spacer"></div>` : "";
    }

    const banner = design.headerBanner ? `<img src="${design.headerBanner}" class="acd-lab-header-banner" alt="Lab Banner">` : "";
    const logo = !design.headerBanner && design.headerLogo ? `<img src="${design.headerLogo}" class="acd-lab-logo" alt="Lab Logo">` : "";
    const regHtml = design.regNo ? ` • Reg. No: ${esc(design.regNo)}` : "";
    const contactParts = [
      design.address ? esc(design.address) : "",
      design.phone ? "Mob: " + esc(design.phone) : "",
      design.email ? "Email: " + esc(design.email) : ""
    ].filter(Boolean).join(" | ");

    const labNameHtml = design.showLabName !== false ? `<h1 class="acd-lab-name">${esc(design.labName || "PATHOLOGY LABORATORY")}</h1>` : "";

    return `
      ${banner}
      <div class="acd-lab-header">
        ${logo}
        <div class="acd-lab-info">
          ${labNameHtml}
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

    const boxStyleClass = design.patientBoxStyle === "lines" ? "style-lines" : design.patientBoxStyle === "clean" ? "style-clean" : "";
    const isUnverified = report.is_verified === false;
    const bannerLabel = isUnverified ? "PRELIMINARY LABORATORY REPORT (PENDING PATHOLOGIST VERIFICATION)" : "LABORATORY INVESTIGATION REPORT";
    const bannerStyle = isUnverified ? 'style="background:#b45309"' : "";

    const bannerTitle = design.showReportBanner !== false
      ? `<div class="acd-report-banner-title" ${bannerStyle}>${bannerLabel}</div>`
      : "";

    return `
      <div class="acd-patient-box ${boxStyleClass}">
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
      ${bannerTitle}
    `;
  }

  function buildFooterHTML(design, pageNum, totalPages, isVerified = true) {
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
            <div style="margin-top:2px">Page ${pageNum} of ${totalPages}${isVerified ? " • Digitally Verified" : " • Preliminary"}</div>
          </div>
          <div class="acd-sig-block">
            ${isVerified && design.rightSigImg ? `<img src="${design.rightSigImg}" class="acd-sig-img" alt="Pathologist Signature">` : `<div style="height:32px"></div>`}
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
      CBC: "COMPLETE BLOOD COUNT (CBC)",
      KFT: "KIDNEY FUNCTION TEST (KFT)",
      LFT: "LIVER FUNCTION TEST (LFT)",
      RFT: "RENAL FUNCTION TEST (RFT)",
      TFT: "THYROID FUNCTION TEST (TFT)",
      ESR: "ERYTHROCYTE SEDIMENTATION RATE (ESR)",
      CRP: "C-REACTIVE PROTEIN (CRP)",
      HBA1C: "GLYCATED HAEMOGLOBIN (HbA1c)",
      FBS: "FASTING BLOOD SUGAR (FBS)",
      PPBS: "POST PRANDIAL BLOOD SUGAR (PPBS)",
      RBS: "RANDOM BLOOD SUGAR (RBS)",
      WIDAL: "WIDAL TEST",
      "BT & CT": "BLEEDING TIME & CLOTTING TIME (BT & CT)",
      "URINE R/M": "URINE ROUTINE AND MICROSCOPY",
      "URINE RE": "URINE ROUTINE EXAMINATION"
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
              <thead><tr><th>ANTIGEN</th>${dilutions.map(d => `<th>${d}</th>`).join("")}</tr></thead>
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
    } else {
      rows.forEach(r => {
        const val = String(r.result_value ?? "").trim();
        if (!val) return;
        const flag = r.status_flag || evaluateFlag(val, r.reference_range);
        const isAbnormal = flag === "Low" || flag === "High" || flag === "CRITICAL";
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
    }

    if (testGroup.clinical_note && String(testGroup.clinical_note).trim()) {
      html += `<tr class="acd-clinical-note-row"><td colspan="${colSpan}"><strong>Note / Interpretation:</strong> ${esc(testGroup.clinical_note)}</td></tr>`;
    }

    return html;
  }

  function createPageShell(report, design, pageIndex) {
    const page = document.createElement("div");
    page.className = "acd-a4-page";
    const headerH = Number(design.headerHeightMm || 0);
    page.style.setProperty("--report-accent", design.accentColor || "#0b4fa8");
    page.style.setProperty("--report-font-family", design.fontFamily || "Arial, Helvetica, sans-serif");
    page.style.setProperty("--report-font-size", design.fontSize || "11px");
    page.style.setProperty("--report-header-size", design.headerFontSize || "20px");
    page.style.setProperty("--report-sub-header-size", design.subHeaderFontSize || "10.5px");
    page.style.setProperty("--report-patient-size", design.patientFontSize || "11px");
    page.style.setProperty("--report-heading-size", design.testHeadingFontSize || "11.5px");
    page.style.setProperty("--report-row-pad", design.rowSpacing || "4.5px");
    page.style.setProperty("--report-margin-top", (Number(design.marginTopMm ?? 10)) + "mm");
    page.style.setProperty("--report-margin-bottom", (Number(design.marginBottomMm ?? 9)) + "mm");
    page.style.setProperty("--report-margin-side", (Number(design.marginSideMm ?? 12)) + "mm");
    page.style.setProperty("--report-header-min-h", headerH > 0 ? headerH + "mm" : "auto");
    page.style.setProperty("--patient-gap-top", (Number(design.patientGapMm ?? 2)) + "mm");
    page.style.setProperty("--report-gap-top", (Number(design.reportGapMm ?? 2)) + "mm");

    const topHtml = buildFullHeaderHTML(design) + buildPatientBoxHTML(report, design, pageIndex);
    page.innerHTML = `
      <div class="acd-a4-top">${topHtml}</div>
      <div class="acd-a4-body">
        <table class="acd-report-table">${buildTableHeadHTML(design)}<tbody></tbody></table>
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
      pages.forEach(p => { p.style.transform = ""; p.style.marginBottom = ""; });
    }
  }

  function buildWhatsAppMessage(report, design, verifyUrl = "") {
    const p = report.patient || {};
    const fullName = [p.title, p.patient_name].filter(Boolean).join(" ").trim() || "Patient";
    const lines = [
      `*${design.labName || "PATHOLOGY LABORATORY"}*`,
      `📋 *Pathology Investigation Report*`,
      `👤 *Patient:* ${fullName} (${p.age || "-"} ${p.age_unit || "Y"} / ${p.gender || "-"})`,
      `🆔 *Patient ID:* ${patientId(report)}`,
      `📅 *Date:* ${report.order_date || "-"}`
    ];
    if (verifyUrl) lines.push(`🔗 *View & Download Verified Report PDF:* ${verifyUrl}`);
    lines.push(`Please find your attached A4 PDF Pathology Report.`);
    return lines.join("\n");
  }

  async function ensureHtml2Pdf() {
    if (typeof window.html2pdf === "function") return window.html2pdf;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("PDF generator library could not load."));
      document.head.appendChild(s);
    });
    return window.html2pdf;
  }

  async function renderPagesIntoContainer(container, report, design, currentLabId) {
    container.innerHTML = "";
    const validGroups = (report.tests || [])
      .map(t => ({
        test_name: t.test_name,
        clinical_note: t.clinical_note || "",
        rows: (t.rows || []).filter(r => String(r.result_value ?? "").trim() !== "")
      }))
      .filter(t => t.rows.length > 0);

    if (!validGroups.length) return [];

    const isVerified = report.is_verified !== false;
    const pages = [];
    let currentPage = createPageShell(report, design, 1);
    currentPage.querySelector(".acd-a4-footer-slot").innerHTML = buildFooterHTML(design, 1, 1, isVerified);
    container.appendChild(currentPage);
    pages.push(currentPage);

    const getMaxBodyHeight = pageEl => pageEl.querySelector(".acd-a4-body").clientHeight || 620;

    validGroups.forEach(group => {
      const tbody = currentPage.querySelector("tbody");
      const groupHtml = buildTestGroupRowsHTML(group, design);
      const beforeHtml = tbody.innerHTML;
      tbody.insertAdjacentHTML("beforeend", groupHtml);

      if (currentPage.querySelector(".acd-report-table").offsetHeight > getMaxBodyHeight(currentPage) && beforeHtml.trim() !== "") {
        tbody.innerHTML = beforeHtml;
        currentPage = createPageShell(report, design, pages.length + 1);
        currentPage.querySelector(".acd-a4-footer-slot").innerHTML = buildFooterHTML(design, pages.length + 1, pages.length + 1, isVerified);
        container.appendChild(currentPage);
        pages.push(currentPage);
        currentPage.querySelector("tbody").insertAdjacentHTML("beforeend", groupHtml);
      }

      while (currentPage.querySelector(".acd-report-table").offsetHeight > getMaxBodyHeight(currentPage)) {
        const activeTbody = currentPage.querySelector("tbody");
        if (activeTbody.querySelectorAll("tr").length <= 2) break;
        const overflowRows = [];
        while (currentPage.querySelector(".acd-report-table").offsetHeight > getMaxBodyHeight(currentPage) && activeTbody.querySelectorAll("tr").length > 2) {
          const lastTr = activeTbody.lastElementChild;
          overflowRows.unshift(lastTr.outerHTML);
          lastTr.remove();
        }
        if (!overflowRows.length) break;
        currentPage = createPageShell(report, design, pages.length + 1);
        currentPage.querySelector(".acd-a4-footer-slot").innerHTML = buildFooterHTML(design, pages.length + 1, pages.length + 1, isVerified);
        container.appendChild(currentPage);
        pages.push(currentPage);
        const colSpan = 2 + (design.showUnit ? 1 : 0) + (design.showRef ? 1 : 0) + (design.showStatus ? 1 : 0);
        currentPage.querySelector("tbody").innerHTML =
          `<tr class="acd-test-group-header"><td colspan="${colSpan}">${esc(fullTestName(group.test_name))} (Contd.)</td></tr>` + overflowRows.join("");
      }
    });

    const totalPages = pages.length;
    pages.forEach((pg, idx) => {
      pg.querySelector(".acd-a4-footer-slot").innerHTML = buildFooterHTML(design, idx + 1, totalPages, isVerified);
    });

    const qrUrl = await resolveQrVerificationUrl(report, currentLabId);
    pages.forEach(pg => {
      if (design.showQr) renderQrInto(pg.querySelector("[data-acd-qr]"), qrUrl);
      renderBarcodeInto(pg.querySelector("[data-acd-barcode]"), patientId(report));
    });

    return { pages, qrUrl };
  }

  async function generateReportPdfBlob(report, currentLabId, labObj) {
    const design = loadReportDesign(currentLabId, labObj);
    const html2pdf = await ensureHtml2Pdf();
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:210mm;background:#fff;z-index:-1;";
    document.body.appendChild(host);

    try {
      const rendered = await renderPagesIntoContainer(host, report, design, currentLabId);
      const pages = rendered.pages || [];
      if (!pages.length) throw new Error("No test results available for PDF generation.");

      const wrapper = document.createElement("div");
      wrapper.style.width = "210mm";
      pages.forEach((pg, idx) => {
        pg.style.boxShadow = "none";
        pg.style.margin = "0";
        pg.style.transform = "none";
        if (idx < pages.length - 1) pg.style.pageBreakAfter = "always";
        wrapper.appendChild(pg);
      });
      host.innerHTML = "";
      host.appendChild(wrapper);

      const safeName = String(report.patient?.patient_name || "Patient").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "Patient";
      const fileName = `${safeName}_Lab_Report.pdf`;

      const blob = await html2pdf()
        .set({ margin: 0, filename: fileName, image: { type: "jpeg", quality: 0.96 }, html2canvas: { scale: 2, useCORS: true, logging: false }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } })
        .from(wrapper)
        .outputPdf("blob");
      return { blob, fileName, qrUrl: rendered.qrUrl };
    } finally {
      host.remove();
    }
  }

  async function downloadReportAsPdf(report, currentLabId, labObj) {
    const { blob, fileName } = await generateReportPdfBlob(report, currentLabId, labObj);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return fileName;
  }

  async function shareReportOnWhatsApp(report, currentLabId, labObj, triggerBtn = null) {
    const design = loadReportDesign(currentLabId, labObj);
    const originalLabel = triggerBtn ? triggerBtn.textContent : "";
    if (triggerBtn) { triggerBtn.disabled = true; triggerBtn.textContent = "⏳ Generating PDF..."; }

    try {
      const { blob, fileName, qrUrl } = await generateReportPdfBlob(report, currentLabId, labObj);
      const pdfFile = new File([blob], fileName, { type: "application/pdf" });
      const msgText = buildWhatsAppMessage(report, design, qrUrl);

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({ files: [pdfFile], title: fileName, text: msgText });
        return;
      }

      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(dlUrl), 15000);

      const rawMobile = String(report.patient?.mobile || "").replace(/\D/g, "");
      const phone = rawMobile.length === 10 ? "91" + rawMobile : rawMobile;
      window.open(phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msgText)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(msgText)}`, "_blank", "noopener");
    } catch (err) {
      const text = buildWhatsAppMessage(report, design, "");
      const rawMobile = String(report.patient?.mobile || "").replace(/\D/g, "");
      const phone = rawMobile.length === 10 ? "91" + rawMobile : rawMobile;
      window.open(phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } finally {
      if (triggerBtn) { triggerBtn.disabled = false; triggerBtn.textContent = originalLabel; }
    }
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
          <button type="button" class="acd-btn-print primary" id="acdDoPrintBtn">🖨️ Print A4</button>
          <button type="button" class="acd-btn-print pdf" id="acdDoPdfBtn">📄 Download PDF</button>
          <button type="button" class="acd-btn-print whatsapp" id="acdDoWhatsappBtn">📲 Send PDF on WhatsApp</button>
          <button type="button" class="acd-btn-print close" id="acdClosePrintBtn">✕ Close</button>
        </div>
      </div>
      <div class="acd-print-viewport" id="acdPrintViewport"></div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("acdClosePrintBtn").onclick = () => overlay.classList.add("hidden");
    document.getElementById("acdDoPrintBtn").onclick = () => window.print();
    window.addEventListener("resize", () => {
      if (!overlay.classList.contains("hidden")) applyMobileViewportScale(document.getElementById("acdPrintViewport"));
    });

    return overlay;
  }

  async function openCombinedA4Print(report, options = {}) {
    const currentLabId = options.labId || window.labId || null;
    const labObj = options.lab || null;
    const design = loadReportDesign(currentLabId, labObj);

    const validGroups = (report.tests || [])
      .map(t => ({ test_name: t.test_name, clinical_note: t.clinical_note || "", rows: (t.rows || []).filter(r => String(r.result_value ?? "").trim() !== "") }))
      .filter(t => t.rows.length > 0);

    if (!validGroups.length) {
      if (typeof window.acdNotify === "function") window.acdNotify("Print करने के लिए कम से कम एक Test Result भरें।");
      return;
    }

    const overlay = ensureOverlay();
    const viewport = document.getElementById("acdPrintViewport");
    viewport.innerHTML = "";
    overlay.classList.remove("hidden");

    const waBtn = document.getElementById("acdDoWhatsappBtn");
    waBtn.onclick = () => shareReportOnWhatsApp(report, currentLabId, labObj, waBtn);

    const pdfBtn = document.getElementById("acdDoPdfBtn");
    pdfBtn.onclick = async () => {
      const orig = pdfBtn.textContent;
      pdfBtn.disabled = true;
      pdfBtn.textContent = "⏳ Saving PDF...";
      try { await downloadReportAsPdf(report, currentLabId, labObj); }
      finally { pdfBtn.disabled = false; pdfBtn.textContent = orig; }
    };

    const { pages } = await renderPagesIntoContainer(viewport, report, design, currentLabId);
    document.getElementById("acdPrintPageCount").textContent = `(${pages.length} A4 Page${pages.length > 1 ? "s" : ""})`;
    applyMobileViewportScale(viewport);

    if (options.autoPrint) setTimeout(() => window.print(), 250);
  }

  window.ACDPrintModule = {
    DEFAULT_DESIGN,
    loadReportDesign,
    saveReportDesign,
    syncReportDesignFromCloud,
    openCombinedA4Print,
    downloadReportAsPdf,
    shareReportOnWhatsApp,
    evaluateFlag
  };
})();
