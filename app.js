/****************************************************
 * THỐNG KÊ PHỤ TÙNG - app.js (FULL)
 * - Hard-code Apps Script WebApp URL + Token
 * - Auto ping to verify token
 * - Load products, search filter
 * - Table with checkbox + image thumbnail + preview modal
 * - Import modal: stock.import -> STOCK + TXNS (IMPORT)
 * - Export modal: bill.create -> BILLS + BILL_ITEMS + TXNS (SALE) + trừ STOCK
 ****************************************************/

const $ = (id) => document.getElementById(id);

/** ✅ DÁN WEBAPP URL /exec CỦA APPS SCRIPT Ở ĐÂY */
const HARD_CODED_API_URL = "https://script.google.com/macros/s/AKfycbxNTXwlpT94aqWFy_Kr6Vkt0mz994LuS2AGbLduWrmxq7RDfWGkOXRZHuyEWoBzKsU/exec";

/** ✅ DÁN TOKEN Ở ĐÂY */
const HARD_CODED_TOKEN = "Thanhhai_Thaovy";

/** Nếu muốn cho phép đổi token trong popup TOKEN: true/false */
const ALLOW_TOKEN_EDIT = false;

const state = {
  mode: "KHO", // KHO | CỬA HÀNG
  token: HARD_CODED_TOKEN,
  products: [],
  filtered: [],
  pickedIds: new Set(),
  lastRole: "",
};

function locFromMode() {
  return state.mode === "KHO" ? "WAREHOUSE" : "STORE";
}

function setMode(mode) {
  state.mode = mode;
  const vm = $("viewMode");
  if (vm) vm.textContent = mode;
  const bKho = $("btnKho");
  const bStore = $("btnStore");
  if (bKho) bKho.classList.toggle("active", mode === "KHO");
  if (bStore) bStore.classList.toggle("active", mode === "CỬA HÀNG");
}

function setAuthState(ok, msg) {
  const el = $("authState");
  if (!el) return;
  el.textContent = ok ? (msg || "đã kết nối") : (msg || "chưa kết nối");
  el.style.color = ok ? "#1a8f6c" : "";
}

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString("vi-VN");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/************ IMAGE URL HELPER ************
 * Ưu tiên:
 * 1) cột image_url (link ảnh trực tiếp)
 * 2) cột image_file_id (Drive file id) -> thumbnail
 ******************************************/
function getProductImageSrc(p) {
  const url = String(p.image_url ?? "").trim();
  if (url) return url;

  const fid = String(p.image_file_id ?? "").trim();
  if (fid) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fid)}&sz=w400`;

  return "";
}

/************ API ************/
async function api(action, payload = {}) {
  const apiUrl = String(HARD_CODED_API_URL || "").trim();
  if (!apiUrl || apiUrl === "PASTE_YOUR_WEBAPP_URL_HERE") {
    throw new Error("Bạn chưa dán WebApp URL vào app.js (HARD_CODED_API_URL).");
  }
  if (!state.token || state.token === "PASTE_YOUR_TOKEN_HERE") {
    throw new Error("Bạn chưa dán token vào app.js (HARD_CODED_TOKEN).");
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token: state.token, payload }),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("API trả về không phải JSON. Kiểm tra WebApp URL / quyền deploy.");
  }

  if (!data.ok) throw new Error(data.error || "API error");
  return data;
}

/************ MODAL UTILS ************/
function openModal(id) {
  const el = $(id);
  if (el) el.classList.remove("hidden");
}
function closeModal(id) {
  const el = $(id);
  if (el) el.classList.add("hidden");
}

/************ BIND CLOSE OVERLAY ************/
function bindOverlayClose(modalId) {
  const el = $(modalId);
  if (!el) return;
  el.addEventListener("click", (e) => {
    if (e.target && e.target.id === modalId) closeModal(modalId);
  });
}

/************ TOKEN MODAL (chỉ test / đổi nhanh nếu cho phép) ************/
function initTokenModal() {
  const btnToken = $("btnToken");
  if (btnToken) {
    btnToken.onclick = () => {
      openModal("tokenModal");
      const t = $("token");
      if (t) {
        t.value = state.token || "";
        t.disabled = !ALLOW_TOKEN_EDIT;
      }
      const clearBtn = $("btnClearToken");
      const connectBtn = $("btnConnect");
      if (clearBtn) clearBtn.disabled = !ALLOW_TOKEN_EDIT;
      if (connectBtn) connectBtn.textContent = ALLOW_TOKEN_EDIT ? "Xác nhận" : "Test";
    };
  }

  const btnClose = $("btnCloseToken");
  if (btnClose) btnClose.onclick = () => closeModal("tokenModal");
  bindOverlayClose("tokenModal");

  const btnToggle = $("btnToggleToken");
  if (btnToggle) {
    btnToggle.onclick = () => {
      const inp = $("token");
      if (!inp) return;
      const isPw = inp.type === "password";
      inp.type = isPw ? "text" : "password";
      btnToggle.textContent = isPw ? "Ẩn" : "Hiện";
    };
  }

  const btnClear = $("btnClearToken");
  if (btnClear) {
    btnClear.onclick = () => {
      if (!ALLOW_TOKEN_EDIT) return;
      state.token = "";
      const inp = $("token");
      if (inp) inp.value = "";
      setAuthState(false, "đã xóa token (tạm)");
    };
  }

  const btnConnect = $("btnConnect");
  if (btnConnect) {
    btnConnect.onclick = async () => {
      try {
        if (ALLOW_TOKEN_EDIT) {
          const inp = $("token");
          state.token = inp ? inp.value.trim() : state.token;
        }
        const r = await api("ping", {});
        state.lastRole = r.role || "";
        setAuthState(true, "OK • role: " + state.lastRole);
        alert("Token OK!");
        closeModal("tokenModal");
      } catch (e) {
        setAuthState(false, e.message);
        alert("Lỗi: " + e.message);
      }
    };
  }
}

/************ IMAGE PREVIEW MODAL ************/
function initImageModal() {
  const btnClose = $("btnCloseImg");
  if (btnClose) btnClose.onclick = () => closeModal("imgModal");
  bindOverlayClose("imgModal");
}

function openImagePreview(p) {
  const src = getProductImageSrc(p);
  if (!src) return alert("Sản phẩm này chưa có image_url / image_file_id");

  const t = $("imgTitle");
  const s = $("imgSub");
  const img = $("imgPreview");
  if (t) t.textContent = `Ảnh: ${p.id ?? ""}`;
  if (s) s.textContent = `${p.name ?? ""}`;
  if (img) img.src = src;

  openModal("imgModal");
}

/************ PICKED ************/
function updatePickedUI() {
  const el = $("picked");
  if (el) el.textContent = String(state.pickedIds.size);
}

function getPickedProducts() {
  return state.products.filter((p) => state.pickedIds.has(String(p.id ?? "")));
}

/************ TABLE ************/
function syncCheckAll() {
  const rows = Array.from(document.querySelectorAll(".rowCheck"));
  const checkAll = $("checkAll");
  if (!checkAll) return;
  checkAll.checked = rows.length > 0 && rows.every((x) => x.checked);
}

function renderTable(rows) {
  const tbody = $("productsTbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="emptyRow">Không có kết quả</td></tr>`;
    return;
  }

  rows.forEach((p) => {
    const id = String(p.id ?? "");
    const checked = state.pickedIds.has(id);
    const imgSrc = getProductImageSrc(p);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="colCheck">
        <input type="checkbox" class="rowCheck" data-id="${escapeHtml(id)}" ${checked ? "checked" : ""}>
      </td>
      <td class="colImg">
        ${
          imgSrc
            ? `<img class="thumb" src="${imgSrc}" alt="img" data-img="1">`
            : `<div class="thumb" style="display:flex;align-items:center;justify-content:center;font-weight:900;color:rgba(0,0,0,.35);">—</div>`
        }
      </td>
      <td>${escapeHtml(id)}</td>
      <td>${escapeHtml(p.oem ?? "")}</td>
      <td>${escapeHtml(p.oem_alt ?? "")}</td>
      <td>${escapeHtml(p.name ?? "")}</td>
      <td>${escapeHtml(p.brand ?? "")}</td>
      <td>${escapeHtml(p.category ?? "")}</td>
      <td class="colNum">${p.price !== "" && p.price != null ? money(p.price) : ""}</td>
      <td>${escapeHtml(p.desc ?? "")}</td>
    `;

    // click thumb -> preview
    const thumb = tr.querySelector(".thumb");
    if (thumb && thumb.dataset.img === "1") {
      thumb.addEventListener("click", (e) => {
        e.stopPropagation();
        openImagePreview(p);
      });
    }

    // click row -> toggle checkbox
    tr.addEventListener("click", (e) => {
      if (e.target?.classList?.contains("rowCheck")) return;
      if (e.target?.classList?.contains("thumb")) return;
      const cb = tr.querySelector(".rowCheck");
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    });

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".rowCheck").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.id;
      if (cb.checked) state.pickedIds.add(id);
      else state.pickedIds.delete(id);
      updatePickedUI();
      syncCheckAll();
    });
  });

  syncCheckAll();
}

/************ SEARCH / LOAD ************/
function applyFilter() {
  const qEl = $("q");
  const label = $("resultLabel");
  const q = (qEl ? qEl.value : "").trim().toLowerCase();

  if (!q) {
    state.filtered = state.products.slice();
    if (label) label.textContent = "ALL";
  } else {
    state.filtered = state.products.filter((p) => {
      const hay = [p.id, p.oem, p.oem_alt, p.name, p.category, p.brand, p.desc]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" | ");
      return hay.includes(q);
    });
    if (label) label.textContent = `lọc: "${q}"`;
  }

  renderTable(state.filtered);
}

async function loadProducts() {
  const r = await api("products.list", {});
  state.products = Array.isArray(r.data) ? r.data : [];
  applyFilter();
}

/************ PICKED MODAL ************/
function renderPickedTable() {
  const tbody = $("pickedTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const picked = getPickedProducts();
  if (picked.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="emptyRow">Chưa chọn sản phẩm nào</td></tr>`;
    return;
  }

  picked.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.id ?? "")}</td>
      <td>${escapeHtml(p.oem ?? "")}</td>
      <td>${escapeHtml(p.oem_alt ?? "")}</td>
      <td>${escapeHtml(p.name ?? "")}</td>
      <td>${escapeHtml(p.brand ?? "")}</td>
      <td>${escapeHtml(p.category ?? "")}</td>
      <td class="colNum">${p.price !== "" && p.price != null ? money(p.price) : ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

function initPickedModal() {
  const openPicked = () => {
    openModal("pickedModal");
    renderPickedTable();
  };

  const btnView = $("btnViewPicked");
  const btnBaoGia = $("btnBaoGia");
  if (btnView) btnView.onclick = openPicked;
  if (btnBaoGia) btnBaoGia.onclick = openPicked;

  const btnClose1 = $("btnClosePicked");
  const btnClose2 = $("btnClosePicked2");
  if (btnClose1) btnClose1.onclick = () => closeModal("pickedModal");
  if (btnClose2) btnClose2.onclick = () => closeModal("pickedModal");
  bindOverlayClose("pickedModal");

  const btnCopy = $("btnCopyPicked");
  if (btnCopy) {
    btnCopy.onclick = async () => {
      const picked = getPickedProducts();
      const lines = [
        ["id", "oem", "oem_alt", "name", "brand", "category", "price"].join("\t"),
        ...picked.map((p) =>
          [p.id ?? "", p.oem ?? "", p.oem_alt ?? "", p.name ?? "", p.brand ?? "", p.category ?? "", p.price ?? ""].join("\t")
        ),
      ];
      const text = lines.join("\n");
      try {
        await navigator.clipboard.writeText(text);
        alert("Đã copy (TSV).");
      } catch {
        alert("Không copy được (trình duyệt chặn).");
      }
    };
  }
}

/************ IMPORT / EXPORT HELPERS ************/
function fillPriceFromProducts(tbodyId) {
  const map = new Map(state.products.map((p) => [String(p.id ?? ""), p]));
  document.querySelectorAll(`#${tbodyId} .price`).forEach((inp) => {
    const pid = inp.dataset.id;
    const p = map.get(pid);
    if (p && p.price !== "" && p.price != null) inp.value = Number(p.price);
  });
}

/************ IMPORT MODAL ************/
function openImportModal() {
  if (!state.products.length) return alert("Bấm Tra cứu để tải danh sách trước.");
  const picked = getPickedProducts();
  if (picked.length === 0) return alert("Bạn chưa tick sản phẩm nào.");

  $("importLoc").value = locFromMode();
  $("importActor").value = "";
  $("importNote").value = "";
  openModal("importModal");

  const tbody = $("importTbody");
  tbody.innerHTML = "";
  picked.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.id ?? "")}</td>
      <td>${escapeHtml(p.name ?? "")}</td>
      <td class="colNum"><input class="miniInput qty" type="number" min="0" step="1" value="1" data-id="${escapeHtml(p.id ?? "")}"></td>
      <td class="colNum"><input class="miniInput price" type="number" min="0" step="1" value="" data-id="${escapeHtml(p.id ?? "")}"></td>
    `;
    tbody.appendChild(tr);
  });
}

function initImportModal() {
  const btnIn = $("btnIn");
  if (btnIn) btnIn.onclick = openImportModal;

  const btnClose = $("btnCloseImport");
  if (btnClose) btnClose.onclick = () => closeModal("importModal");
  bindOverlayClose("importModal");

  const btnFill = $("btnImportFillPrice");
  if (btnFill) btnFill.onclick = () => fillPriceFromProducts("importTbody");

  const btnDo = $("btnDoImport");
  if (btnDo) {
    btnDo.onclick = async () => {
      try {
        const loc = $("importLoc").value;
        const actor = $("importActor").value.trim();
        const note = $("importNote").value.trim();
        if (!actor) return alert("Thiếu actor");

        const items = [];
        document.querySelectorAll("#importTbody tr").forEach((tr) => {
          const qtyInp = tr.querySelector(".qty");
          const priceInp = tr.querySelector(".price");
          const product_id = qtyInp.dataset.id;
          const qty = Number(qtyInp.value || 0);
          const priceVal = priceInp.value === "" ? "" : Number(priceInp.value);
          if (qty > 0) items.push({ product_id, qty, price: priceVal });
        });

        if (items.length === 0) return alert("Không có qty > 0");

        await api("stock.import", { loc, actor, note, items });
        alert("Nhập hàng OK (đã ghi STOCK + TXNS).");
        closeModal("importModal");
      } catch (e) {
        alert(e.message);
      }
    };
  }
}

/************ EXPORT MODAL ************/
function calcExportTotal() {
  let total = 0;
  document.querySelectorAll("#exportTbody tr").forEach((tr) => {
    const qty = Number(tr.querySelector(".qty").value || 0);
    const price = Number(tr.querySelector(".price").value || 0);
    const line = qty * price;
    const lineEl = tr.querySelector(".lineTotal");
    if (lineEl) lineEl.textContent = line ? money(line) : "0";
    total += line;
  });
  const totalEl = $("exportTotal");
  if (totalEl) totalEl.textContent = money(total);
}

function openExportModal() {
  if (!state.products.length) return alert("Bấm Tra cứu để tải danh sách trước.");
  const picked = getPickedProducts();
  if (picked.length === 0) return alert("Bạn chưa tick sản phẩm nào.");

  $("exportLoc").value = locFromMode();
  $("exportActor").value = "";
  $("exportNote").value = "";
  openModal("exportModal");

  const tbody = $("exportTbody");
  tbody.innerHTML = "";
  picked.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.id ?? "")}</td>
      <td>${escapeHtml(p.name ?? "")}</td>
      <td class="colNum"><input class="miniInput qty" type="number" min="0" step="1" value="1" data-id="${escapeHtml(p.id ?? "")}"></td>
      <td class="colNum"><input class="miniInput price" type="number" min="0" step="1" value="" data-id="${escapeHtml(p.id ?? "")}"></td>
      <td class="colNum"><span class="lineTotal">0</span></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", calcExportTotal));
  calcExportTotal();
}

function initExportModal() {
  const btnOut = $("btnOut");
  if (btnOut) btnOut.onclick = openExportModal;

  const btnClose = $("btnCloseExport");
  if (btnClose) btnClose.onclick = () => closeModal("exportModal");
  bindOverlayClose("exportModal");

  const btnFill = $("btnExportFillPrice");
  if (btnFill) btnFill.onclick = () => { fillPriceFromProducts("exportTbody"); calcExportTotal(); };

  const btnDo = $("btnDoExport");
  if (btnDo) {
    btnDo.onclick = async () => {
      try {
        const loc = $("exportLoc").value;
        const actor = $("exportActor").value.trim();
        const note = $("exportNote").value.trim();
        if (!actor) return alert("Thiếu actor");

        const items = [];
        document.querySelectorAll("#exportTbody tr").forEach((tr) => {
          const qtyInp = tr.querySelector(".qty");
          const priceInp = tr.querySelector(".price");
          const product_id = qtyInp.dataset.id;
          const qty = Number(qtyInp.value || 0);
          const price = Number(priceInp.value || 0);
          if (qty > 0) items.push({ product_id, qty, price });
        });

        if (items.length === 0) return alert("Không có qty > 0");

        const r = await api("bill.create", { loc, actor, note, items });
        alert(`Xuất hàng OK. Bill: ${r.data.bill_id} | Total: ${money(r.data.total)}`);
        closeModal("exportModal");
      } catch (e) {
        alert(e.message);
      }
    };
  }
}

/************ MAIN BUTTONS ************/
function initMainButtons() {
  const btnKho = $("btnKho");
  const btnStore = $("btnStore");
  if (btnKho) btnKho.onclick = () => setMode("KHO");
  if (btnStore) btnStore.onclick = () => setMode("CỬA HÀNG");

  const btnSearch = $("btnSearch");
  if (btnSearch) btnSearch.onclick = async () => {
    try { await loadProducts(); } catch (e) { alert(e.message); }
  };

  const btnRefresh = $("btnRefresh");
  if (btnRefresh) btnRefresh.onclick = () => {
    const q = $("q"); if (q) q.value = "";
    applyFilter();
  };

  const q = $("q");
  if (q) q.addEventListener("keydown", (e) => { if (e.key === "Enter") $("btnSearch")?.click(); });

  const btnClearPicked = $("btnClearPicked");
  if (btnClearPicked) btnClearPicked.onclick = () => {
    state.pickedIds.clear();
    updatePickedUI();
    renderTable(state.filtered);
  };

  const checkAll = $("checkAll");
  if (checkAll) {
    checkAll.addEventListener("change", () => {
      const on = checkAll.checked;
      document.querySelectorAll(".rowCheck").forEach((cb) => {
        cb.checked = on;
        const id = cb.dataset.id;
        if (on) state.pickedIds.add(id);
        else state.pickedIds.delete(id);
      });
      updatePickedUI();
    });
  }
}

/************ BOOT ************/
(async function boot() {
  initTokenModal();
  initImageModal();
  initPickedModal();
  initImportModal();
  initExportModal();
  initMainButtons();
  updatePickedUI();

  // auto ping verify
  try {
    const r = await api("ping", {});
    state.lastRole = r.role || "";
    setAuthState(true, "OK • role: " + state.lastRole);
  } catch (e) {
    setAuthState(false, e.message);
    // nếu muốn tự mở token modal khi lỗi:
    // openModal("tokenModal");
  }
})();
