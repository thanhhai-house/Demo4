const $ = (id) => document.getElementById(id);

/** ✅ DÁN WEBAPP URL /exec Ở ĐÂY */
const API_URL = "https://script.google.com/macros/s/AKfycbwQcOtU6TUbmWrK69o-EUWi7BGBxNas2Q8Hba9xdIRder5dMj5hMvUHKILJJuO-CjE/exec";

const state = {
  mode: "KHO",
  products: [],
  filtered: [],
  pickedIds: new Set(),
};

function setAuthState(ok, msg) {
  const el = $("authState");
  if (!el) return;
  el.textContent = ok ? (msg || "OK") : (msg || "Lỗi kết nối");
  el.style.color = ok ? "#1a8f6c" : "#b93a3a";
}

function locFromMode() {
  return state.mode === "KHO" ? "WAREHOUSE" : "STORE";
}

function setMode(mode) {
  state.mode = mode;
  $("viewMode").textContent = mode;
  $("btnKho").classList.toggle("active", mode === "KHO");
  $("btnStore").classList.toggle("active", mode === "CỬA HÀNG");
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

function getProductImageSrc(p) {
  const url = String(p.image_url ?? "").trim();
  if (url) return url;
  const fid = String(p.image_file_id ?? "").trim();
  if (fid) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fid)}&sz=w400`;
  return "";
}

/** IMPORTANT: text/plain => tránh preflight => hết Failed to fetch */
async function api(action, payload = {}) {
  const url = String(API_URL || "").trim();
  if (!url || url === "PASTE_YOUR_WEBAPP_URL_HERE") throw new Error("Chưa dán API_URL trong app.js");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, payload }),
  });

  let data;
  try { data = await res.json(); }
  catch { throw new Error("API không trả JSON. Kiểm tra WebApp URL / deploy Anyone."); }

  if (!data.ok) throw new Error(data.error || "API error");
  return data;
}

/************ MODAL ************/
function openModal(id){ $(id).classList.remove("hidden"); }
function closeModal(id){ $(id).classList.add("hidden"); }
function bindOverlayClose(id){
  const el = $(id);
  el.addEventListener("click",(e)=>{ if(e.target.id===id) closeModal(id); });
}

/************ IMAGE MODAL ************/
$("btnCloseImg").onclick = () => closeModal("imgModal");
bindOverlayClose("imgModal");
function openImagePreview(p){
  const src = getProductImageSrc(p);
  if(!src) return alert("Sản phẩm chưa có image_url / image_file_id");
  $("imgTitle").textContent = `Ảnh: ${p.id ?? ""}`;
  $("imgSub").textContent = `${p.name ?? ""}`;
  $("imgPreview").src = src;
  openModal("imgModal");
}

/************ PICKED ************/
function updatePickedUI(){ $("picked").textContent = String(state.pickedIds.size); }
function getPickedProducts(){ return state.products.filter(p => state.pickedIds.has(String(p.id ?? ""))); }
function syncCheckAll(){
  const rows = Array.from(document.querySelectorAll(".rowCheck"));
  $("checkAll").checked = rows.length>0 && rows.every(x=>x.checked);
}

/************ TABLE ************/
function renderTable(rows){
  const tbody = $("productsTbody");
  tbody.innerHTML = "";

  if(!rows || rows.length===0){
    tbody.innerHTML = `<tr><td colspan="10" class="emptyRow">Không có kết quả</td></tr>`;
    return;
  }

  rows.forEach(p=>{
    const id = String(p.id ?? "");
    const checked = state.pickedIds.has(id);
    const imgSrc = getProductImageSrc(p);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="colCheck"><input type="checkbox" class="rowCheck" data-id="${escapeHtml(id)}" ${checked?"checked":""}></td>
      <td class="colImg">
        ${imgSrc ? `<img class="thumb" src="${imgSrc}" alt="img" data-img="1">`
                : `<div class="thumb" style="display:flex;align-items:center;justify-content:center;font-weight:900;color:rgba(0,0,0,.35);">—</div>`}
      </td>
      <td>${escapeHtml(id)}</td>
      <td>${escapeHtml(p.oem ?? "")}</td>
      <td>${escapeHtml(p.oem_alt ?? "")}</td>
      <td>${escapeHtml(p.name ?? "")}</td>
      <td>${escapeHtml(p.brand ?? "")}</td>
      <td>${escapeHtml(p.category ?? "")}</td>
      <td class="colNum">${p.price!=="" && p.price!=null ? money(p.price) : ""}</td>
      <td>${escapeHtml(p.desc ?? "")}</td>
    `;

    const thumb = tr.querySelector(".thumb");
    if(thumb && thumb.dataset.img==="1"){
      thumb.addEventListener("click",(e)=>{ e.stopPropagation(); openImagePreview(p); });
    }

    tr.addEventListener("click",(e)=>{
      if(e.target?.classList?.contains("rowCheck")) return;
      if(e.target?.classList?.contains("thumb")) return;
      const cb = tr.querySelector(".rowCheck");
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event("change",{bubbles:true}));
    });

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".rowCheck").forEach(cb=>{
    cb.addEventListener("change",()=>{
      const id = cb.dataset.id;
      cb.checked ? state.pickedIds.add(id) : state.pickedIds.delete(id);
      updatePickedUI();
      syncCheckAll();
    });
  });

  syncCheckAll();
}

/************ FILTER ************/
function applyFilter(){
  const q = $("q").value.trim().toLowerCase();
  if(!q){
    state.filtered = state.products.slice();
    $("resultLabel").textContent = "ALL";
  }else{
    state.filtered = state.products.filter(p=>{
      const hay = [p.id,p.oem,p.oem_alt,p.name,p.category,p.brand,p.desc]
        .map(x=>String(x??"").toLowerCase()).join(" | ");
      return hay.includes(q);
    });
    $("resultLabel").textContent = `lọc: "${q}"`;
  }
  renderTable(state.filtered);
}

async function loadProducts(){
  const r = await api("products.list",{});
  state.products = Array.isArray(r.data) ? r.data : [];
  applyFilter();
}

/************ PICKED MODAL ************/
function renderPickedTable(){
  const tbody = $("pickedTbody");
  tbody.innerHTML = "";
  const picked = getPickedProducts();
  if(picked.length===0){
    tbody.innerHTML = `<tr><td colspan="7" class="emptyRow">Chưa chọn sản phẩm nào</td></tr>`;
    return;
  }
  picked.forEach(p=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.id ?? "")}</td>
      <td>${escapeHtml(p.oem ?? "")}</td>
      <td>${escapeHtml(p.oem_alt ?? "")}</td>
      <td>${escapeHtml(p.name ?? "")}</td>
      <td>${escapeHtml(p.brand ?? "")}</td>
      <td>${escapeHtml(p.category ?? "")}</td>
      <td class="colNum">${p.price!=="" && p.price!=null ? money(p.price) : ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

$("btnViewPicked").onclick = ()=>{ openModal("pickedModal"); renderPickedTable(); };
$("btnBaoGia").onclick = ()=>{ openModal("pickedModal"); renderPickedTable(); };
$("btnClosePicked").onclick = ()=> closeModal("pickedModal");
$("btnClosePicked2").onclick = ()=> closeModal("pickedModal");
bindOverlayClose("pickedModal");

$("btnCopyPicked").onclick = async ()=>{
  const picked = getPickedProducts();
  const lines = [
    ["id","oem","oem_alt","name","brand","category","price"].join("\t"),
    ...picked.map(p=>[p.id??"",p.oem??"",p.oem_alt??"",p.name??"",p.brand??"",p.category??"",p.price??""].join("\t"))
  ];
  try { await navigator.clipboard.writeText(lines.join("\n")); alert("Đã copy (TSV)."); }
  catch { alert("Không copy được."); }
};

$("btnClearPicked").onclick = ()=>{
  state.pickedIds.clear();
  updatePickedUI();
  renderTable(state.filtered);
};

/************ IMPORT MODAL ************/
$("btnCloseImport").onclick = ()=> closeModal("importModal");
bindOverlayClose("importModal");

$("btnImportFillPrice").onclick = ()=>{
  const map = new Map(state.products.map(p=>[String(p.id??""), p]));
  document.querySelectorAll("#importTbody .price").forEach(inp=>{
    const p = map.get(inp.dataset.id);
    if(p && p.price!=="" && p.price!=null) inp.value = Number(p.price);
  });
};

function openImportModal(){
  const picked = getPickedProducts();
  if(picked.length===0) return alert("Bạn chưa tick sản phẩm nào.");
  $("importLoc").value = locFromMode();
  $("importActor").value = "admin";
  $("importNote").value = "";

  const tbody = $("importTbody");
  tbody.innerHTML = "";
  picked.forEach(p=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.id ?? "")}</td>
      <td>${escapeHtml(p.name ?? "")}</td>
      <td class="colNum"><input class="miniInput qty" type="number" min="0" step="1" value="1" data-id="${escapeHtml(p.id ?? "")}"></td>
      <td class="colNum"><input class="miniInput price" type="number" min="0" step="1" value="" data-id="${escapeHtml(p.id ?? "")}"></td>
    `;
    tbody.appendChild(tr);
  });
  openModal("importModal");
}

$("btnIn").onclick = ()=>{
  if(state.products.length===0) return alert("Bấm Tra cứu để tải danh sách trước.");
  openImportModal();
};

$("btnDoImport").onclick = async ()=>{
  try{
    const loc = $("importLoc").value;
    const actor = $("importActor").value.trim();
    const note = $("importNote").value.trim();
    if(!actor) return alert("Thiếu actor");

    const items = [];
    document.querySelectorAll("#importTbody tr").forEach(tr=>{
      const qtyInp = tr.querySelector(".qty");
      const priceInp = tr.querySelector(".price");
      const product_id = qtyInp.dataset.id;
      const qty = Number(qtyInp.value||0);
      const priceVal = priceInp.value==="" ? "" : Number(priceInp.value);
      if(qty>0) items.push({product_id, qty, price: priceVal});
    });
    if(items.length===0) return alert("Không có qty > 0");

    await api("stock.import",{loc, actor, note, items});
    alert("Nhập hàng OK.");
    closeModal("importModal");
  }catch(e){
    alert(e.message);
  }
};

/************ EXPORT MODAL ************/
$("btnCloseExport").onclick = ()=> closeModal("exportModal");
bindOverlayClose("exportModal");

$("btnExportFillPrice").onclick = ()=>{
  const map = new Map(state.products.map(p=>[String(p.id??""), p]));
  document.querySelectorAll("#exportTbody .price").forEach(inp=>{
    const p = map.get(inp.dataset.id);
    if(p && p.price!=="" && p.price!=null) inp.value = Number(p.price);
  });
  calcExportTotal();
};

function calcExportTotal(){
  let total = 0;
  document.querySelectorAll("#exportTbody tr").forEach(tr=>{
    const qty = Number(tr.querySelector(".qty").value||0);
    const price = Number(tr.querySelector(".price").value||0);
    const line = qty*price;
    tr.querySelector(".lineTotal").textContent = line ? money(line) : "0";
    total += line;
  });
  $("exportTotal").textContent = money(total);
}

function openExportModal(){
  const picked = getPickedProducts();
  if(picked.length===0) return alert("Bạn chưa tick sản phẩm nào.");
  $("exportLoc").value = locFromMode();
  $("exportActor").value = "admin";
  $("exportNote").value = "";

  const tbody = $("exportTbody");
  tbody.innerHTML = "";
  picked.forEach(p=>{
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

  tbody.querySelectorAll("input").forEach(inp=> inp.addEventListener("input", calcExportTotal));
  calcExportTotal();
  openModal("exportModal");
}

$("btnOut").onclick = ()=>{
  if(state.products.length===0) return alert("Bấm Tra cứu để tải danh sách trước.");
  openExportModal();
};

$("btnDoExport").onclick = async ()=>{
  try{
    const loc = $("exportLoc").value;
    const actor = $("exportActor").value.trim();
    const note = $("exportNote").value.trim();
    if(!actor) return alert("Thiếu actor");

    const items = [];
    document.querySelectorAll("#exportTbody tr").forEach(tr=>{
      const qtyInp = tr.querySelector(".qty");
      const priceInp = tr.querySelector(".price");
      const product_id = qtyInp.dataset.id;
      const qty = Number(qtyInp.value||0);
      const price = Number(priceInp.value||0);
      if(qty>0) items.push({product_id, qty, price});
    });
    if(items.length===0) return alert("Không có qty > 0");

    const r = await api("bill.create",{loc, actor, note, items});
    alert(`Xuất hàng OK. Bill: ${r.data.bill_id} | Total: ${money(r.data.total)}`);
    closeModal("exportModal");
  }catch(e){
    alert(e.message);
  }
};

/************ ADD PRODUCT MODAL ************/
function clearProductForm(){
  ["p_id","p_oem","p_oem_alt","p_name","p_brand","p_category","p_price","p_desc","p_image_url","p_image_file_id"]
    .forEach(id=> $(id).value = "");
}

$("btnAddProduct").onclick = ()=>{
  clearProductForm();
  openModal("addProductModal");
};
$("btnCloseAddProduct").onclick = ()=> closeModal("addProductModal");
bindOverlayClose("addProductModal");
$("btnClearProduct").onclick = clearProductForm;

$("btnSaveProduct").onclick = async ()=>{
  try{
    const id = $("p_id").value.trim();
    if(!id) return alert("Thiếu id");

    const payload = {
      id,
      oem: $("p_oem").value.trim(),
      oem_alt: $("p_oem_alt").value.trim(),
      name: $("p_name").value.trim(),
      brand: $("p_brand").value.trim(),
      category: $("p_category").value.trim(),
      price: $("p_price").value === "" ? "" : Number($("p_price").value),
      desc: $("p_desc").value.trim(),
      image_url: $("p_image_url").value.trim(),
      image_file_id: $("p_image_file_id").value.trim(),
    };

    await api("products.upsert", payload);
    alert("Lưu sản phẩm OK.");
    closeModal("addProductModal");
    await loadProducts();
  }catch(e){
    alert(e.message);
  }
};

/************ MAIN ************/
$("btnKho").onclick = ()=> setMode("KHO");
$("btnStore").onclick = ()=> setMode("CỬA HÀNG");

$("btnSearch").onclick = async ()=>{
  try{ await loadProducts(); }
  catch(e){ alert(e.message); setAuthState(false, e.message); }
};

$("btnRefresh").onclick = ()=>{
  $("q").value = "";
  applyFilter();
};

$("q").addEventListener("keydown",(e)=>{ if(e.key==="Enter") $("btnSearch").click(); });

$("checkAll").addEventListener("change",()=>{
  const on = $("checkAll").checked;
  document.querySelectorAll(".rowCheck").forEach(cb=>{
    cb.checked = on;
    const id = cb.dataset.id;
    on ? state.pickedIds.add(id) : state.pickedIds.delete(id);
  });
  updatePickedUI();
});

/************ BOOT ************/
(async function boot(){
  updatePickedUI();
  try{
    await api("ping",{});
    setAuthState(true, "OK (open)");
  }catch(e){
    setAuthState(false, e.message);
  }
})();
