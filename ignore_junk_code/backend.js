/**
 * backend.js — DrPeptide shared verification engine
 */

// ── Firebase Configuration ────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDhPTtitT_rX8z0o2uDjRsVwTjAG71mmvk",
  authDomain: "rehobothbank-landing.firebaseapp.com",
  projectId: "rehobothbank-landing",
  storageBucket: "rehobothbank-landing.firebasestorage.app",
  messagingSenderId: "1086996659612",
  appId: "1:1086996659612:web:6905bcad01ada368bc1c59"
};

// Initialize Firebase only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();


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
  _loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js", "__qrcode_cdn__", cb);
}
function _ensureH2C(cb) {
  if (typeof html2canvas !== "undefined") { cb(); return; }
  _loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "__h2c_cdn__", cb);
}

// ── Storage (must match drpeptide-reports.html key format "rpt:") ─────────────
function DRP_loadReport(key) {
  try {
    var v = localStorage.getItem("rpt:" + key.toUpperCase());
    return v ? JSON.parse(v) : null;
  } catch(e) { return null; }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
var _MONTHS =["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
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
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function _logo(sz) {
  var h = Math.round(sz * 0.72);
  return `<svg width="${sz}" height="${h}" viewBox="0 0 50 36" xmlns="http://www.w3.org/2000/svg">
    <rect x="2"  y="22" width="7" height="13" fill="#4caf50" rx="1"/>
    <rect x="12" y="14" width="7" height="21" fill="#4caf50" rx="1"/>
    <rect x="22" y="8"  width="7" height="27" fill="#4caf50" rx="1"/>
    <rect x="32" y="16" width="7" height="19" fill="#4caf50" rx="1"/>
    <rect x="42" y="4"  width="7" height="31" fill="#4caf50" rx="1"/>
  </svg>`;
}

// ── URL Generator for Test Reports ────────────────────────────────────────────
function DRP_generateReportURL(report) {
  var baseUrl = "http://127.0.0.1:5500/index.html/tests"; 

  // Clean strings: remove special characters, replace spaces with underscores, and convert to lowercase
  var safeSample = (report.sample || "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  var safeClient = (report.client || "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  
  // Combine them and remove any accidental double-underscores
  var middlePart = (safeSample + "_" + safeClient).replace(/_+/g, "_").replace(/_$/, "");
  var slug = report.taskNumber + "-" + middlePart + "_" + report.uniqueKey.toUpperCase();
  
  return baseUrl + "/" + slug;
}

// ── Build report card HTML (Used for Admin Preview) ───────────────────────────
function DRP_buildReportHTML(report, qrId) {
  var sigHTML = report.signature 
    ? `<img src="${report.signature}" alt="Signature" style="height:72px;width:auto;object-fit:contain;display:block;" />` 
    : `<span style="font-size:13px;color:#bbb;font-style:italic;">—</span>`;

  var clientRows = [["Client", report.client], ["Sample", report.sample],
    ["Manufacturer", report.manufacturer],["Batch", report.batch || "Unknown"]
  ].map((pair, i) => `
    <tr style="background:${i % 2 === 0 ? "#f9f9f9" : "#fff"};">
      <td style="color:#4caf50;font-weight:500;padding:8px 16px;width:140px;">${pair[0]}</td>
      <td style="padding:8px 16px;color:#222;font-weight:400;">${_esc(pair[1])}</td>
    </tr>
  `).join("");

  var resultRows = (report.results ||[]).map(r => `
    <tr style="border-bottom:1px solid #d4efd4;">
      <td style="padding:9px 16px;color:#222;width:58%;font-weight:400;">${_esc(r.label)}</td>
      <td style="padding:9px 16px;color:#222;font-weight:400;">${_esc(r.value)}</td>
    </tr>
  `).join("");

  return `
    <div style="font-family:'Jost','Trebuchet MS',sans-serif;width:794px;background:#fff;padding:52px 64px 44px;box-sizing:border-box;color:#222;line-height:1.5;">
      
      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;margin-bottom:24px;border-bottom:2.5px solid #4caf50;">
        <div style="display:flex;align-items:center;gap:24px;">
          <span style="font-size:36px;font-weight:900;color:#4caf50;letter-spacing:.5px;line-height:1;">TEST REPORT</span>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
            ${_logo(44)}
            <span style="font-size:10.5px;font-weight:900;color:#1a1a1a;letter-spacing:5px;">${_esc(report.labName||"DRPEPTIDE")}</span>
          </div>
        </div>
        <div style="text-align:right;font-size:11.5px;color:#444;line-height:2;font-weight:400;">
          <div>E-mail:&nbsp; ${_esc(report.labEmail||"info@drpeptide.com")}</div>
          <div>Web:&nbsp;&nbsp;&nbsp; ${_esc(report.labWeb||"www.drpeptide.com")}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
        <div style="display:flex;align-items:center;gap:16px;">
          <span style="color:#4caf50;font-size:15px;font-weight:500;">Task Number</span>
          <span style="background:#f0f0f0;padding:4px 18px;border-radius:3px;font-size:15px;font-weight:700;letter-spacing:.3px;">#${report.taskNumber}</span>
        </div>
        <div style="text-align:right;font-size:14px;line-height:2.1;font-weight:400;">
          <div><span style="color:#4caf50;">Testing ordered</span><span style="color:#bbb;margin:0 8px;">&gt;</span><strong>${_fmtShort(report.testingOrdered)}</strong></div>
          <div><span style="color:#4caf50;">Sample received</span><span style="color:#bbb;margin:0 8px;">&gt;</span><strong>${_fmtShort(report.sampleReceived)}</strong></div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:30px;font-size:14px;">
        <tbody>${clientRows}</tbody>
      </table>

      <div style="margin-bottom:22px;">
        <div style="color:#4caf50;font-weight:500;font-size:14px;margin-bottom:6px;">Sample description &gt;</div>
        <div style="background:#f7f7f7;padding:12px 16px;font-size:13.5px;color:#444;min-height:72px;line-height:1.6;">${_esc(report.sampleDescription||"See picture or pictures attached.")}</div>
      </div>

      <div style="margin-bottom:22px;">
        <div style="color:#4caf50;font-weight:500;font-size:14px;margin-bottom:6px;">Tests requested &gt;</div>
        <div style="background:#f7f7f7;padding:12px 16px;font-size:13.5px;color:#444;min-height:72px;line-height:1.6;">${_esc(report.testsRequested||"Assessment of a peptide vial or vials.")}</div>
      </div>

      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="color:#4caf50;font-weight:500;font-size:14px;">Results &gt;</span>
          <div id="${qrId}"></div>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1.5px solid #b8e6b8;font-size:14px;">
          <tbody>${resultRows}<tr><td style="padding:9px 16px;"></td><td></td></tr></tbody>
        </table>
      </div>

      <div style="margin-bottom:22px;">
        <div style="color:#4caf50;font-weight:500;font-size:14px;margin-bottom:6px;">Comments &gt;</div>
        <div style="background:#f7f7f7;padding:12px 16px;font-size:13.5px;color:#444;min-height:68px;line-height:1.6;">${_esc(report.comments||"")}</div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:28px;margin-top:8px;">
        <div style="font-size:14px;">
          <span style="color:#4caf50;">Analysis conducted</span><span style="color:#bbb;margin:0 8px;">&gt;</span>
          <span style="background:#f0f0f0;padding:4px 16px;border-radius:3px;font-weight:700;font-size:15px;">${_fmtLong(report.analysisDate)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;font-size:14px;">
          <span style="color:#4caf50;">Signature &gt;</span>${sigHTML}
        </div>
      </div>

      <div style="border-top:1px solid #e0e0e0;padding-top:18px;">
        <div style="font-size:13px;color:#4caf50;margin-bottom:10px;font-weight:400;">
          Verify this test at <strong>${_esc(report.labWeb||"www.drpeptide.com")}/verify/</strong> with the following unique key
        </div>
        <div style="text-align:center;font-size:16px;font-weight:700;letter-spacing:3.5px;color:#222;background:#f5f5f5;padding:13px 0;border-radius:3px;">
          ${_esc(report.uniqueKey)}
        </div>
      </div>
    </div>
  `;
}

// ── Render report into a container element + attach QR (Used for Admin Preview)
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

// ── Download report as JPG (Used for Admin Preview) ───────────────────────────
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
// VERIFY PAGE HANDLER (NEW FLOW)
// ─────────────────────────────────────────────────────────────────────────────
(function initVerifyPage() {
  var form = document.getElementById("verification-form");
  if (!form) return;

  // Inject result area right after the form
  var resultArea = document.createElement("div");
  resultArea.id = "drp-result-area";
  form.parentNode.insertBefore(resultArea, form.nextSibling);

  // Inject a simple error message area inside the form
  var errBox = document.createElement("div");
  errBox.id = "drp-verify-error";
  errBox.style.cssText = "display:none;margin-top:16px;padding:12px 16px;background:#fdecea;color:#c62828;border-radius:6px;font-size:14px;";
  form.appendChild(errBox);

  // Override the native form submit so it doesn't reload the page
  form.addEventListener("submit", function(e) { e.preventDefault(); handleVerify(); });

  // Global handleVerify()
  window.handleVerify = async function() {
    var keyInput  = document.getElementById("unique_key");
    var taskInput = document.getElementById("task_number");

    var key  = keyInput  ? keyInput.value.trim().toUpperCase()  : "";
    var task = taskInput ? taskInput.value.trim()               : "";

    // Find the original Verify button and its container
    var submitBtn = form.querySelector('button[type="submit"]');
    var btnContainer = submitBtn ? submitBtn.parentNode : null;

    // Reset UI state
    errBox.style.display = "none";
    errBox.textContent   = "";
    resultArea.innerHTML = "";

    if (!key) {
      _showErr("Please enter your unique key.");
      return;
    }

    var report = await DRP_loadReport(key);

    if (!report) {
      _showErr("No report found for this key. Please check and try again.");
      return;
    }

    if (task && String(report.taskNumber) !== task) {
      _showErr("The task number and unique key do not match.");
      return;
    }

    // ── Success Flow: Hide Verify, Show "Open Report" and "Reset", Show Text ──
    if (submitBtn && btnContainer) {
      // Hide the Verify button
      submitBtn.style.display = "none";

      // Clear any previously generated buttons just in case
      var existingOpen = document.getElementById("drp-open-btn");
      var existingReset = document.getElementById("drp-reset-btn");
      if(existingOpen) existingOpen.remove();
      if(existingReset) existingReset.remove();

      // Create "Open Report" Button
      var openBtn = document.createElement("button");
      openBtn.id = "drp-open-btn";
      openBtn.className = "button"; // Gives it standard size styling
      openBtn.style.cssText = "background-color: #09AD9D; color: #fff; border: none; font-weight: bold;";
      openBtn.textContent = "Open Report";
      openBtn.onclick = function(e) {
        e.preventDefault();
        var url = DRP_generateReportURL(report);
        window.open(url, '_blank'); // Opens in new tab
      };

      // Create "Reset" Button
      var resetBtn = document.createElement("button");
      resetBtn.id = "drp-reset-btn";
      resetBtn.className = "button button-dark"; // Same style as original verify
      resetBtn.textContent = "Reset";
      resetBtn.onclick = function(e) {
        e.preventDefault();
        
        // Clear input values
        if(keyInput) keyInput.value = "";
        if(taskInput) taskInput.value = "";
        
        // Revert UI Buttons
        openBtn.remove();
        resetBtn.remove();
        submitBtn.style.display = ""; // Show original Verify button
        
        // Clear success message
        resultArea.innerHTML = "";
        errBox.style.display = "none";
      };

      // Add the two new buttons into the flex container
      btnContainer.appendChild(openBtn);
      btnContainer.appendChild(resetBtn);
    }

    // Render the 28px Green text below the form
    resultArea.innerHTML = `
      <div style="color: #09AD9D; font-size: 28px; font-weight: 700; margin-top: 30px; line-height: 1.3;">
        This test is in our database. You can open the report and check if the data match your report.
      </div>
    `;
  };

  function _showErr(msg) {
    errBox.textContent   = "⚠️ " + msg;
    errBox.style.display = "block";
  }

})();














// ── Firebase Storage: LOAD REPORT ─────────────────────────────────────────────
async function DRP_loadReport(key) {
  try {
    // Wait for Firebase to fetch the data from the 'reports' folder
    const snapshot = await database.ref('reports/' + key.toUpperCase()).once('value');
    
    if (snapshot.exists()) {
      return snapshot.val(); // Return the JavaScript Object
    } else {
      return null; // Key doesn't exist
    }
  } catch(e) { 
    console.error("Firebase load error:", e);
    return null; 
  }
}

// ── Firebase Storage: SAVE REPORT (Use this in your Admin panel) ──────────────
async function DRP_saveReport(report) {
  try {
    // Save the report object into the 'reports' folder under its unique key
    await database.ref('reports/' + report.uniqueKey.toUpperCase()).set(report);
    return true;
  } catch(e) {
    console.error("Firebase save error:", e);
    return false;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PAGE LOGIC (Restored & Wired to Firebase)
// ─────────────────────────────────────────────────────────────────────────────

// Switch between Verify and Admin tabs
function navigate(viewId) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + viewId).classList.add('active');
  document.querySelectorAll('.nav-tabs .btn-sec').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + viewId).classList.add('active');
}

// Simple Admin Login
function handleAdminLogin() {
  var pass = document.getElementById("admin-pass-input").value;
  if (pass === "admin123") { // <-- Change "admin123" to your preferred password
    document.getElementById("admin-auth").style.display = "none";
    document.getElementById("admin-dashboard").style.display = "block";
    showDashboard();
  } else {
    alert("Incorrect password");
  }
}

// Load reports from Firebase and show them in the dashboard
async function showDashboard() {
  document.getElementById("admin-create").style.display = "none";
  document.getElementById("admin-preview").style.display = "none";
  document.getElementById("admin-dashboard").style.display = "block";
  
  var list = document.getElementById("reports-list");
  list.innerHTML = "Loading reports from Firebase...";
  
  try {
    const snapshot = await database.ref('reports').once('value');
    const data = snapshot.val();
    list.innerHTML = "";
    
    if (!data) {
      list.innerHTML = "<div class='empty-state'>No reports found in database.</div>";
      document.getElementById("dashboard-title").innerText = "All Reports (0)";
      return;
    }

    const reports = Object.values(data);
    document.getElementById("dashboard-title").innerText = "All Reports (" + reports.length + ")";
    
    // Sort so newest are at the top (assuming higher task number = newer)
    reports.sort((a, b) => b.taskNumber - a.taskNumber).forEach(r => {
      var div = document.createElement("div");
      div.className = "report-item";
      div.innerHTML = `
        <div>
          <div class="report-item-title">Task #${r.taskNumber} - ${r.client || 'Unknown Client'}</div>
          <div class="report-item-meta">Key: <strong>${r.uniqueKey}</strong> | Date: ${r.analysisDate}</div>
        </div>
        <div class="report-item-actions">
          <button class="btn-sec btn-sm" onclick="previewReport('${r.uniqueKey}')">View Report</button>
        </div>
      `;
      list.appendChild(div);
    });
  } catch(e) {
    list.innerHTML = "<div class='alert-error'>Error loading reports. Check console.</div>";
  }
}

// Open the "New Report" Form
function startCreate() {
  document.getElementById("admin-dashboard").style.display = "none";
  document.getElementById("admin-create").style.display = "block";
  document.getElementById("form-title").innerText = "New Report";
  
  // Clear the form
  document.querySelectorAll("#admin-create input, #admin-create textarea").forEach(i => i.value = "");
  document.getElementById("results-rows").innerHTML = "";
  clearSig();
  addResultRow(); // Add one empty row by default
}

// Add a test result row to the form
function addResultRow(label = "", value = "") {
  var div = document.createElement("div");
  div.className = "result-row";
  div.innerHTML = `
    <input class="input res-label" placeholder="Test Name (e.g. Purity)" value="${label}">
    <input class="input res-val" placeholder="Result (e.g. 99.8%)" value="${value}">
    <button class="btn-danger" onclick="this.parentElement.remove()">X</button>
  `;
  document.getElementById("results-rows").appendChild(div);
}

// Handle Signature Image Upload
var currentSigBase64 = "";
function handleSigUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    currentSigBase64 = e.target.result;
    var preview = document.getElementById("f-sig-preview");
    preview.src = currentSigBase64;
    preview.style.display = "block";
    document.getElementById("f-sig-clear").style.display = "inline-block";
  };
  reader.readAsDataURL(file);
}

function clearSig() {
  currentSigBase64 = "";
  document.getElementById("f-sig-preview").style.display = "none";
  document.getElementById("f-sig-clear").style.display = "none";
  document.getElementById("f-sig-upload").value = "";
}

// Save the Report to Firebase
async function handleSave() {
  var btn = document.getElementById("save-btn");
  var msg = document.getElementById("save-msg");
  
  // Generate a random 10-character alphanumeric Key
  var uniqueKey = Math.random().toString(36).substr(2, 10).toUpperCase();

  var report = {
    labName: document.getElementById("f-labName").value || "DRPEPTIDE",
    labEmail: document.getElementById("f-labEmail").value || "info@drpeptide.com",
    labWeb: document.getElementById("f-labWeb").value || "www.drpeptide.com",
    testingOrdered: document.getElementById("f-testingOrdered").value,
    sampleReceived: document.getElementById("f-sampleReceived").value,
    analysisDate: document.getElementById("f-analysisDate").value,
    client: document.getElementById("f-client").value,
    sample: document.getElementById("f-sample").value,
    manufacturer: document.getElementById("f-manufacturer").value,
    batch: document.getElementById("f-batch").value,
    sampleDescription: document.getElementById("f-sampleDescription").value,
    testsRequested: document.getElementById("f-testsRequested").value,
    comments: document.getElementById("f-comments").value,
    signature: currentSigBase64,
    taskNumber: Math.floor(Math.random() * 90000) + 10000, // Random 5-digit Task Number
    uniqueKey: uniqueKey,
    results: