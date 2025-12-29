const $ = (id) => document.getElementById(id);

/** ✅ DÁN WEBAPP URL CỦA APPS SCRIPT VÀO ĐÂY (deploy webapp /exec) */
const HARD_CODED_API_URL = "https://script.google.com/macros/s/AKfycbxNTXwlpT94aqWFy_Kr6Vkt0mz994LuS2AGbLduWrmxq7RDfWGkOXRZHuyEWoBzKsU/exec";

const state = {
  mode: "KHO",
  token: localStorage.getItem("token") || "",
  products: [],
  filtered: [],
  pickedIds: new Set(),
};

function locFromMode() {
  return state.mode === "KHO" ? "WAREHOUSE" : "STORE";
}

function setMode(mode) {
  state.mode = mode;
  $("viewMode").textContent = mode;
  $("btnKho").classList.toggle("active", mode === "KHO");
  $("btnStore").classList.toggle("active", mode === "CỬA HÀNG");
}
$("btnKho").onclick = () => setMode("KHO");
$("btnStore").onclick = () => setMode("CỬA HÀNG");

function setAuthState(ok, msg) {
  const el = $("authState");
  el.textContent = ok ? (msg || "đã kết nối") : (msg || "chưa kết nối");
  el.style.color = ok ? "#1a8f6c" : "";
}

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString("vi-VN");
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/************ IMAGE URL HELPER ************/
/**
 * Ưu tiên:
 * 1) image_url (nếu là link ảnh trực tiếp)
 * 2) image_file_id (Google Drive) -> thumbnail
 *
 * Lưu ý: Drive thumbnail cần file ở chế độ ai có link đều xem.
 */
function getProductImageSrc(p) {
  const url = String(p.image_url ?? "").trim();
  if (url) return url;

  const fid = String(p.image_file_id ?? "").trim();
  if (fid) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fid)}&sz=w400`;

  // fallback: ảnh trống
  return "";
}

/************ API ************/
async function api(action, payload = {}) {
  const apiUrl = HARD_CODED_API_URL.trim();
  if (!apiUrl || apiUrl === "PASTE_YOUR_WEBAPP_URL_HERE") {
    throw new Error("Bạn chưa dán WebApp URL vào app.js (HARD_CODED_API_URL).");
  }
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token: state.token, payload }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API error");
  return data;
}

/************ MODAL UTILS ************/
function openModal(id){ $(id).classList.remove("hidden"); }
function closeModal(id){ $(id).classList.add("hidden"); }

/************ TOKEN MODAL (chỉ token) ************/
$("btnToken").onclick = () => {
  openModal("tokenModal");
  $("token").value = state.token;
};

$("btnCloseToken").onclick = () => closeModal("tokenModal");
$("tokenModal").addEventListener("click", (e) => { if (e.target.id === "tokenModal") closeModal("tokenModal"); });

$("btnToggleToken").onclick = () => {
  const inp = $("token");
  const isPw = inp.type === "password";
  inp.type = isPw ? "text" : "password";
  $("btnToggleToken").textContent = isPw ? "Ẩn" : "Hiện";
};

$("btnClearToken").onclick = () => {
  localStorage.removeItem("token");
  state.token = "";
  $("token").value = "";
  setAuthState(false, "đã xóa token");
};

$("btnConnect").onclick = async () => {
  state.token = $("token").value.trim();
  localStorage.setItem("token", state.token);

  try {
    const r = await api("ping", {});
    setAuthState(true, "OK • role: " + (r.role || ""));
    alert("Token OK!");
    closeModal("tokenModal");
  } catch (e) {
    setAuthState(false, e.message);
    alert("Lỗi: " + e.message);
  }
};

/************ IMAGE PREVIEW MODAL ************/
$("btnCloseImg").onclick = () => closeModal("imgModal");
$("imgModal").addEventListener("click", (e) => { if (e.target.id === "imgModal") closeModal("imgModal"); });

function openImagePreview(p) {
  const src = getProductImageSrc(p);
  if (!src) return alert("Sản phẩm này chưa có image_url / image_file_id");

  $("imgTitle").textContent = `Ảnh: ${p.id ?? ""}`;
  $("imgSub").textContent = `${p.name ?? ""}`;
  const img = $("imgPreview");
  img.src = src;
  openModal("imgModal");
}

/************ PICKED UI ************/
function updatePickedUI() {
  $("picked").textContent = String(state.pickedIds.size);
}
function getPickedProducts() {
  return state.products.filter(p => state.pickedIds.has(String(p.id ?? "")));
}

/************ TABLE ************/
function syncCheckAll() {
  const rows = Array.from(document.querySelectorAll(".rowCheck"));
  const all = rows.length > 0 && rows.every(x => x.checked);
  $("checkAll").checked = all;
}

function renderTable(rows) {
  const tbody = $("productsTbody");
  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="emptyRow">Không có kết quả</td></tr>`;
    return;
  }

  rows.forEach(p => {
    const id = String(p.id ?? "");
    const checked = state.pickedIds.has(id);
    const imgSrc = getProductImageSrc(p);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="colCheck"><input type="checkbox" class="rowCheck" data-id="${escapeHtml(id)}" ${checked ? "checked" : ""}></td>
      <td class="colImg">
        ${imgSrc ? `<img class="thumb" src="${imgSrc}" alt="img" data-img="1">` : `<div class="thumb" style="display:flex;align-items:center;justify-content:center;font-weight:900;color:rgba(0,0,0,.35);">—</div>`}
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

    // click thumb -> preview ảnh
    const thumb = tr.querySelector(".thumb");
    if (thumb && thumb.dataset && thumb.dataset.img === "1") {
      thumb.addEventListener("click", (e) => {
        e.stopPropagation();
        openImagePreview(p);
      });
    }

    // click dòng -> toggle checkbox (trừ khi click thumb/checkbox)
    tr.addEventListener("click", (e) => {
      if (e.target?.classList?.contains("rowCheck")) return;
      if (e.target?.classList?.contains("thumb")) return;
      const cb = tr.querySelector(".rowCheck");
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    });

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".rowCheck").forEach(cb => {
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

$("checkAll").addEventListener("change", () => {
  const on = $("checkAll").checked;
  document.querySelectorAll(".rowCheck").forEach(cb => {
    cb.checked = on;
    const id = cb.dataset.id;
    if (on) state.pickedIds.add(id);
    else state.pickedIds.delete(id);
  });
  updatePickedUI();
});

/************ SEARCH / LOAD ************/
function applyFilter() {
  const q = $("q").value.trim().toLowerCase();
  if (!q) {
    state.filtered = state.products.slice();
    $("resultLabel").textContent = "ALL";
  } else {
    state.filtered = state.products.filter(p => {
      const hay = [p.id,p.oem,p.oem_alt,p.name,p.category,p.brand,p.desc]
        .map(x => String(x ?? "").toLowerCase()).join(" | ");
      return hay.includes(q);
    });
    $("resultLabel").textContent = `lọc: "${q}"`;
  }
  renderTable(state.filtered);
}

$("btnSearch").addEventListener("click", async () => {
  try {
    if (!state.token) {
      openModal("tokenModal");
      return alert("Bạn cần nhập token trước.");
    }
    const r = await api("products.list", {});
    state.products = Array.isArray(r.data) ? r.data : [];
    applyFilter();
  } catch (e) {
    alert(e.message);
  }
});

$("btnRefresh").addEventListener("click", () => {
  $("q").value = "";
  applyFilter();
});

$("q").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("btnSearch").click();
});

$("btnClearPicked").onclick = () => {
  state.pickedIds.clear();
  updatePickedUI();
  renderTable(state.filtered);
};

/************ PICKED MODAL ************/
function renderPickedTable() {
  const tbody = $("pickedTbody");
  tbody.innerHTML = "";
  const picked = getPickedProducts();

  if (picked.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="emptyRow">Chưa chọn sản phẩm nào</td></tr>`;
    return;
  }

  picked.forEach(p => {
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

$("btnViewPicked").onclick = () => { openModal("pickedModal"); renderPickedTable(); };
$("btnBaoGia").onclick = () => { openModal("pickedModal"); renderPickedTable(); };

$("btnClosePicked").onclick = () => closeModal("pickedModal");
$("btnClosePicked2").onclick = () => closeModal("pickedModal");
$("pickedModal").addEventListener("click", (e) => { if (e.target.id === "pickedModal") closeModal("pickedModal"); });

$("btnCopyPicked").onclick = async () => {
  const picked = getPickedProducts();
  const lines = [
    ["id","oem","oem_alt","name","brand","category","price"].join("\t"),
    ...picked.map(p => [p.id??"",p.oem??"",p.oem_alt??"",p.name??"",p.brand??"",p.category??"",p.price??""].join("\t"))
  ];
  const text = lines.join("\n");
  try { await navigator.clipboard.writeText(text); alert("Đã copy (TSV)."); }
  catch { alert("Không copy được (trình duyệt chặn)."); }
};

/************ IMPORT / EXPORT (giữ như bản trước) ************/
function fillPriceFromProducts(tbodyId) {
  const map = new Map(state.products.map(p => [String(p.id ?? ""), p]));
  document.querySelectorAll(`#${tbodyId} .price`).forEach(inp => {
    const pid = inp.dataset.id;
    const p = map.get(pid);
    if (p && p.price !== "" && p.price != null) inp.value = Number(p.price);
  });
}

/* IMPORT */
$("btnIn").onclick = () => {
  if (state.products.length === 0) return alert("Bấm Tra cứu để tải danh sách trước.");
  const picked = getPickedProducts();
  if (picked.length === 0) return alert("Bạn chưa tick sản phẩm nào.");

  $("importLoc").value = locFromMode();
  $("importActor").value = "";
  $("importNote").value = "";
  openModal("importModal");

  const tbody = $("importTbody");
  tbody.innerHTML = "";
  picked.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.id ?? "")}</td>
      <td>${escapeHtml(p.name ?? "")}</td>
      <td class="colNum"><input class="miniInput qty" type="number" min="0" step="1" value="1" data-id="${escapeHtml(p.id ?? "")}"></td>
      <td class="colNum"><input class="miniInput price" type="number" min="0" step="1" value="" data-id="${escapeHtml(p.id ?? "")}"></td>
    `;
    tbody.appendChild(tr);
  });
};

$("btnCloseImport").onclick = () => closeModal("importModal");
$("importModal").addEventListener("click", (e) => { if (e.target.id === "importModal") closeModal("importModal"); });
$("btnImportFillPrice").onclick = () => fillPriceFromProducts("importTbody");

$("btnDoImport").onclick = async () => {
  try {
    const loc = $("importLoc").value;
    const actor = $("importActor").value.trim();
    const note = $("importNote").value.trim();
    if (!actor) return alert("Thiếu actor");

    const items = [];
    document.querySelectorAll("#importTbody tr").forEach(tr => {
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

/* EXPORT */
function calcExportTotal() {
  let total = 0;
  document.querySelectorAll("#exportTbody tr").forEach(tr => {
    const qty = Number(tr.querySelector(".qty").value || 0);
    const price = Number(tr.querySelector(".price").value || 0);
    const line = qty * price;
    tr.querySelector(".lineTotal").textContent = line ? money(line) : "0";
    total += line;
  });
  $("exportTotal").textContent = money(total);
}

$("btnOut").onclick = () => {
  if (state.products.length === 0) return alert("Bấm Tra cứu để tải danh sách trước.");
  const picked = getPickedProducts();
  if (picked.length === 0) return alert("Bạn chưa tick sản phẩm nào.");

  $("exportLoc").value = locFromMode();
  $("exportActor").value = "";
  $("exportNote").value = "";
  openModal("exportModal");

  const tbody = $("exportTbody");
  tbody.innerHTML = "";
  picked.forEach(p => {
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

  tbody.querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => calcExportTotal()));
  calcExportTotal();
};

$("btnCloseExport").onclick = () => closeModal("exportModal");
$("exportModal").addEventListener("click", (e) => { if (e.target.id === "exportModal") closeModal("exportModal"); });
$("btnExportFillPrice").onclick = () => { fillPriceFromProducts("exportTbody"); calcExportTotal(); };

$("btnDoExport").onclick = async () => {
  try {
    const loc = $("exportLoc").value;
    const actor = $("exportActor").value.trim();
    const note = $("exportNote").value.trim();
    if (!actor) return alert("Thiếu actor");

    const items = [];
    document.querySelectorAll("#exportTbody tr").forEach(tr => {
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

/************ BOOT ************/
(function boot(){
  updatePickedUI();
  if (state.token) {
    api("ping", {}).then(r => setAuthState(true, "OK • role: " + (r.role || "")))
      .catch(() => setAuthState(false, "token sai hoặc chưa deploy URL"));
  } else {
    setAuthState(false, "chưa có token");
  }
})();
