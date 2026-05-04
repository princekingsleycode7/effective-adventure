/**
 * backend.js — DrPeptide shared verification engine
 * Import this in both the admin page and the /verify page.
 * Reads from the same localStorage namespace used by the admin app.
 */

// ── CDN loaders (injected once, lazily) ───────────────────────────────────────
function _loadScript(src, id, cb) {
  if (document.getElementById(id)) { if (cb) cb(); return; }
  var s = document.createElement("script");
  s.id  = id;
  s.src = src;
  if (cb) s.onload = cb;
  document.head.appendChild(s);
}
function _ensureQR(cb) {
  if (typeof QRCode !== "undefined") { cb(); return; }
  _loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
    "__qrcode_cdn__", cb
  );
}
function _ensureH2C(cb) {
  if (typeof html2canvas !== "undefined") { cb(); return; }
  _loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    "__h2c_cdn__", cb
  );
}

// ── Storage (must match drpeptide-reports.html key format "rpt:") ─────────────
function DRP_loadReport(key) {
  try {
    var v = localStorage.getItem("rpt:" + key.toUpperCase());
    return v ? JSON.parse(v) : null;
  } catch(e) { return null; }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
var _MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function _fmtShort(iso) {
  if (!iso) return "";
  var d = new Date(iso + "T12:00:00");
  return String(d.getDate()).padStart(2,"0") + " " + _MONTHS[d.getMonth()] + " '" + String(d.getFullYear()).slice(2);
}
function _fmtLong(iso) {
  if (!iso) return "";
  var d = new Date(iso + "T12:00:00");
  return String(d.getDate()).padStart(2,"0") + " " + _MONTHS[d.getMonth()] + " " + d.getFullYear();
}
function _esc(s) {
  return String(s||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Logo SVG ──────────────────────────────────────────────────────────────────
function _logo(sz) {
  var h = Math.round(sz * 0.72);
  return '<svg width="'+sz+'" height="'+h+'" viewBox="0 0 50 36" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="2"  y="22" width="7" height="13" fill="#4caf50" rx="1"/>' +
    '<rect x="12" y="14" width="7" height="21" fill="#4caf50" rx="1"/>' +
    '<rect x="22" y="8"  width="7" height="27" fill="#4caf50" rx="1"/>' +
    '<rect x="32" y="16" width="7" height="19" fill="#4caf50" rx="1"/>' +
    '<rect x="42" y="4"  width="7" height="31" fill="#4caf50" rx="1"/>' +
    '</svg>';
}

// ── URL Generator for Test Reports ────────────────────────────────────────────
function DRP_generateReportURL(report) {
  // Change this to your actual verification subdomain/domain
  var baseUrl = "https://verify.drpeptide.com/tests"; 

  // Clean strings: remove special characters and replace spaces with underscores
  var safeSample = (report.sample || "").replace(/[^a-zA-Z0-9]/g, "_");
  var safeClient = (report.client || "").replace(/[^a-zA-Z0-9]/g, "_");
  
  // Combine them and remove any accidental double-underscores
  var middlePart = (safeSample + "_" + safeClient).replace(/_+/g, "_");

  // Remove trailing underscore if it exists
  middlePart = middlePart.replace(/_$/, "");

  // Format: {taskNumber}-{Sample}_{Client}_{UniqueKey}
  var slug = report.taskNumber + "-" + middlePart + "_" + report.uniqueKey;
  
  return baseUrl + "/" + slug;
}

// ── Build report card HTML ────────────────────────────────────────────────────
var DRP_VERIFY_BASE = "https://drpeptide.com/verify";

function DRP_buildReportHTML(report, qrId) {
  var sig = report.signature;
  var sigHTML = sig
    ? '<img src="'+sig+'" alt="Signature" style="height:72px;width:auto;object-fit:contain;display:block;" />'
    : '<span style="font-size:13px;color:#bbb;font-style:italic;">—</span>';

  var clientRows = [
    ["Client",       report.client],
    ["Sample",       report.sample],
    ["Manufacturer", report.manufacturer],
    ["Batch",        report.batch || "Unknown"],
  ].map(function(pair, i) {
    return '<tr style="background:'+(i%2===0?"#f9f9f9":"#fff")+';">' +
      '<td style="color:#4caf50;font-weight:500;padding:8px 16px;width:140px;">'+pair[0]+'</td>' +
      '<td style="padding:8px 16px;color:#222;font-weight:400;">'+_esc(pair[1])+'</td>' +
      '</tr>';
  }).join("");

  var resultRows = (report.results||[]).map(function(r) {
    return '<tr style="border-bottom:1px solid #d4efd4;">' +
      '<td style="padding:9px 16px;color:#222;width:58%;font-weight:400;">'+_esc(r.label)+'</td>' +
      '<td style="padding:9px 16px;color:#222;font-weight:400;">'+_esc(r.value)+'</td>' +
      '</tr>';
  }).join("");

  return [
    '<div style="font-family:\'Jost\',\'Trebuchet MS\',sans-serif;width:794px;background:#fff;',
    'padding:52px 64px 44px;box-sizing:border-box;color:#222;line-height:1.5;">',

    // HEADER
    '<div style="display:flex;align-items:center;justify-content:space-between;',
    'padding-bottom:16px;margin-bottom:24px;border-bottom:2.5px solid #4caf50;">',
      '<div style="display:flex;align-items:center;gap:24px;">',
        '<span style="font-size:36px;font-weight:900;color:#4caf50;letter-spacing:.5px;line-height:1;">TEST REPORT</span>',
        '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">',
          _logo(44),
          '<span style="font-size:10.5px;font-weight:900;color:#1a1a1a;letter-spacing:5px;">',
          _esc(report.labName||"DRPEPTIDE"),'</span>',
        '</div>',
      '</div>',
      '<div style="text-align:right;font-size:11.5px;color:#444;line-height:2;font-weight:400;">',
        '<div>E-mail:&nbsp; '+_esc(report.labEmail||"info@drpeptide.com")+'</div>',
        '<div>Web:&nbsp;&nbsp;&nbsp; '+_esc(report.labWeb||"www.drpeptide.com")+'</div>',
      '</div>',
    '</div>',

    // TASK + DATES
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">',
      '<div style="display:flex;align-items:center;gap:16px;">',
        '<span style="color:#4caf50;font-size:15px;font-weight:500;">Task Number</span>',
        '<span style="background:#f0f0f0;padding:4px 18px;border-radius:3px;font-size:15px;font-weight:700;letter-spacing:.3px;">#'+report.taskNumber+'</span>',
      '</div>',
      '<div style="text-align:right;font-size:14px;line-height:2.1;font-weight:400;">',
        '<div><span style="color:#4caf50;">Testing ordered</span><span style="color:#bbb;margin:0 8px;">&gt;</span>',
        '<strong>'+_fmtShort(report.testingOrdered)+'</strong></div>',
        '<div><span style="color:#4caf50;">Sample received</span><span style="color:#bbb;margin:0 8px;">&gt;</span>',
        '<strong>'+_fmtShort(report.sampleReceived)+'</strong></div>',
      '</div>',
    '</div>',

    // CLIENT TABLE
    '<table style="width:100%;border-collapse:collapse;margin-bottom:30px;font-size:14px;">',
      '<tbody>'+clientRows+'</tbody>',
    '</table>',

    // SAMPLE DESCRIPTION
    '<div style="margin-bottom:22px;">',
      '<div style="color:#4caf50;font-weight:500;font-size:14px;margin-bottom:6px;">Sample description &gt;</div>',
      '<div style="background:#f7f7f7;padding:12px 16px;font-size:13.5px;color:#444;min-height:72px;line-height:1.6;">',
      _esc(report.sampleDescription||"See picture or pictures attached."),'</div>',
    '</div>',

    // TESTS REQUESTED
    '<div style="margin-bottom:22px;">',
      '<div style="color:#4caf50;font-weight:500;font-size:14px;margin-bottom:6px;">Tests requested &gt;</div>',
      '<div style="background:#f7f7f7;padding:12px 16px;font-size:13.5px;color:#444;min-height:72px;line-height:1.6;">',
      _esc(report.testsRequested||"Assessment of a peptide vial or vials."),'</div>',
    '</div>',

    // RESULTS
    '<div style="margin-bottom:24px;">',
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">',
        '<span style="color:#4caf50;font-weight:500;font-size:14px;">Results &gt;</span>',
        '<div id="'+qrId+'"></div>',
      '</div>',
      '<table style="width:100%;border-collapse:collapse;border:1.5px solid #b8e6b8;font-size:14px;">',
        '<tbody>',
          resultRows,
          '<tr><td style="padding:9px 16px;"></td><td></td></tr>',
        '</tbody>',
      '</table>',
    '</div>',

    // COMMENTS
    '<div style="margin-bottom:22px;">',
      '<div style="color:#4caf50;font-weight:500;font-size:14px;margin-bottom:6px;">Comments &gt;</div>',
      '<div style="background:#f7f7f7;padding:12px 16px;font-size:13.5px;color:#444;min-height:68px;line-height:1.6;">',
      _esc(report.comments||""),'</div>',
    '</div>',

    // FOOTER
    '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:28px;margin-top:8px;">',
      '<div style="font-size:14px;">',
        '<span style="color:#4caf50;">Analysis conducted</span>',
        '<span style="color:#bbb;margin:0 8px;">&gt;</span>',
        '<span style="background:#f0f0f0;padding:4px 16px;border-radius:3px;font-weight:700;font-size:15px;">',
        _fmtLong(report.analysisDate),'</span>',
      '</div>',
      '<div style="display:flex;align-items:center;gap:12px;font-size:14px;">',
        '<span style="color:#4caf50;">Signature &gt;</span>',
        sigHTML,
      '</div>',
    '</div>',

    // VERIFY STRIP
    '<div style="border-top:1px solid #e0e0e0;padding-top:18px;">',
      '<div style="font-size:13px;color:#4caf50;margin-bottom:10px;font-weight:400;">',
        'Verify this test at <strong>'+_esc(report.labWeb||"www.drpeptide.com")+'/verify/</strong> with the following unique key',
      '</div>',
      '<div style="text-align:center;font-size:16px;font-weight:700;letter-spacing:3.5px;color:#222;background:#f5f5f5;padding:13px 0;border-radius:3px;">',
        _esc(report.uniqueKey),
      '</div>',
    '</div>',

    '</div>'
  ].join("");
}

// ── Render report into a container element + attach QR ────────────────────────
function DRP_renderReport(containerEl, report) {
  var qrId = "drp-qr-" + report.uniqueKey;
  containerEl.innerHTML = DRP_buildReportHTML(report, qrId);

  _ensureQR(function() {
    var qrEl = document.getElementById(qrId);
    if (!qrEl) return;
    try {
      new QRCode(qrEl, {
        text: DRP_generateReportURL(report),
        width: 54, height: 54,
        colorDark: "#1a1a1a", colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch(e) {}
  });
}

// ── Download report as JPG ────────────────────────────────────────────────────
function DRP_downloadReport(containerEl, taskNumber, onStart, onEnd) {
  _ensureH2C(function() {
    if (onStart) onStart();
    var target = containerEl.firstElementChild;
    if (!target) { if (onEnd) onEnd(); return; }
    html2canvas(target, {
      scale: 2, useCORS: true, allowTaint: true,
      backgroundColor: "#ffffff", logging: false,
    }).then(function(canvas) {
      var link = document.createElement("a");
      link.download = "report-" + taskNumber + ".jpg";
      link.href = canvas.toDataURL("image/jpeg", 0.97);
      link.click();
      if (onEnd) onEnd();
    }).catch(function(e) {
      alert("Download failed: " + e.message);
      if (onEnd) onEnd();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY PAGE HANDLER
// Reads from: #task_number  (optional, used for extra validation)
//             #unique_key   (required)
// ─────────────────────────────────────────────────────────────────────────────
(function initVerifyPage() {
  // Only activate on pages that have the verify form
  var form = document.getElementById("verification-form");
  if (!form) return;

  // Inject result area right after the form
  var resultArea = document.createElement("div");
  resultArea.id = "drp-result-area";
  resultArea.style.cssText = "margin-top:40px;";
  form.parentNode.insertBefore(resultArea, form.nextSibling);

  // Inject a simple error message area inside the form
  var errBox = document.createElement("div");
  errBox.id = "drp-verify-error";
  errBox.style.cssText = [
    "display:none;margin-top:16px;padding:12px 16px;",
    "background:#fdecea;color:#c62828;border-radius:6px;font-size:14px;"
  ].join("");
  form.appendChild(errBox);

  // Also inject Jost font if not already present
  if (!document.getElementById("drp-jost-font")) {
    var link = document.createElement("link");
    link.id   = "drp-jost-font";
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Jost:wght@400;500;700;800;900&display=swap";
    document.head.appendChild(link);
  }

  // Override the native form submit so it doesn't reload the page
  form.addEventListener("submit", function(e) { e.preventDefault(); handleVerify(); });

  // Global handleVerify() — called by the button's onclick in the existing HTML
  window.handleVerify = function() {
    var keyInput  = document.getElementById("unique_key");
    var taskInput = document.getElementById("task_number");

    var key  = keyInput  ? keyInput.value.trim().toUpperCase()  : "";
    var task = taskInput ? taskInput.value.trim()               : "";

    // Reset UI
    errBox.style.display = "none";
    errBox.textContent   = "";
    resultArea.innerHTML = "";

    if (!key) {
      _showErr("Please enter your unique key.");
      return;
    }

    var report = DRP_loadReport(key);

    if (!report) {
      _showErr("No report found for this key. Please check and try again.");
      return;
    }

    // Optional cross-check: if task number was entered, it must match
    if (task && String(report.taskNumber) !== task) {
      _showErr("The task number and unique key do not match.");
      return;
    }

    // ── Success — render the report ──
    var successBanner = document.createElement("div");
    successBanner.style.cssText = [
      "display:flex;justify-content:space-between;align-items:center;",
      "flex-wrap:wrap;gap:12px;margin-bottom:24px;"
    ].join("");
    successBanner.innerHTML = [
      '<div style="display:flex;align-items:center;gap:10px;">',
        '<span style="font-size:22px;">✅</span>',
        '<span style="color:#4caf50;font-weight:800;font-size:16px;',
        'font-family:\'Jost\',sans-serif;">Report verified successfully</span>',
      '</div>',
      '<button id="drp-dl-btn" style="',
        'background:#4caf50;color:#fff;border:none;padding:10px 24px;',
        'border-radius:6px;font-weight:700;font-size:14px;cursor:pointer;',
        'font-family:\'Jost\',sans-serif;">',
        '⬇ Download JPG',
      '</button>'
    ].join("");

    var cardWrap = document.createElement("div");
    cardWrap.style.cssText = "overflow-x:auto;";
    var cardInner = document.createElement("div");
    cardInner.style.cssText = "display:inline-block;";
    cardWrap.appendChild(cardInner);

    resultArea.appendChild(successBanner);
    resultArea.appendChild(cardWrap);

    DRP_renderReport(cardInner, report);

    // Scroll to result
    resultArea.scrollIntoView({ behavior: "smooth", block: "start" });

    // Download button
    document.getElementById("drp-dl-btn").addEventListener("click", function() {
      var btn = this;
      DRP_downloadReport(
        cardInner,
        report.taskNumber,
        function() { btn.textContent = "Generating…"; btn.disabled = true; },
        function() { btn.textContent = "⬇ Download JPG"; btn.disabled = false; }
      );
    });
  };

  function _showErr(msg) {
    errBox.textContent   = "⚠️ " + msg;
    errBox.style.display = "block";
  }

  // Pre-fill and auto-run from URL query params:  ?key=XXXX&task=90001
  var params = new URLSearchParams(window.location.search);
  var pKey   = params.get("key");
  var pTask  = params.get("task");
  if (pKey) {
    var ki = document.getElementById("unique_key");
    var ti = document.getElementById("task_number");
    if (ki) ki.value = pKey.toUpperCase();
    if (ti && pTask) ti.value = pTask;
    // Small delay to let the page finish rendering
    setTimeout(window.handleVerify, 120);
  }
})();