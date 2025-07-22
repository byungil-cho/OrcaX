// admin-market.js

const API_SEED = "/api/seed";
const API_MARKET = "/api/marketdata";
const API_ALL_PRODUCTS = "/api/admin/all-products-quantities";
const API_SERVER_STATUS = "/api/power-status";

// 네임스페이스 객체 패턴(코드 충돌X)
const AdminMarket = {
  // 서버상태
  async fetchServerStatus() {
    try {
      const res = await fetch(API_SERVER_STATUS);
      if (!res.ok) throw new Error();
      document.getElementById("serverStatusDot").className = "status-dot status-ok";
      document.getElementById("serverStatusText").innerText = "서버 연결: 정상";
    } catch {
      document.getElementById("serverStatusDot").className = "status-dot status-bad";
      document.getElementById("serverStatusText").innerText = "서버 연결: 오류";
    }
  },

  // 씨앗 재고/가격
  async fetchSeedStatus() {
    try {
      const res = await fetch(`${API_SEED}/status`);
      const data = await res.json();
      document.getElementById('qty-potato').textContent = data.seedPotato?.quantity ?? '-';
      document.getElementById('price-potato').textContent = data.seedPotato?.price ?? '-';
      document.getElementById('qty-barley').textContent = data.seedBarley?.quantity ?? '-';
      document.getElementById('price-barley').textContent = data.seedBarley?.price ?? '-';
    } catch {}
  },
  async updatePrice(type) {
    const inputId = type === 'seedPotato' ? 'input-potato' : 'input-barley';
    const price = parseInt(document.getElementById(inputId).value);
    if (isNaN(price)) { alert("유효한 가격을 입력하세요."); return; }
    const res = await fetch(`${API_SEED}/admin/set-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, price })
    });
    if (res.ok) {
      alert('가격 변경 완료!');
      this.fetchSeedStatus();
    } else {
      alert('가격 변경 실패');
    }
  },

  // (중복 없는) 전체 가공식품명+합산수량 (최대 5개까지 체크/수량/가격 등록)
  async fetchUniqueProducts() {
    try {
      const res = await fetch(API_ALL_PRODUCTS);
      const products = await res.json();
      const tbody = document.getElementById('uniqueProductsBody');
      tbody.innerHTML = '';
      products.forEach((prod, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>
            <input type="checkbox" name="selectProd" value="${prod.name}" onchange="AdminMarket.checkLimit()" />
          </td>
          <td>${prod.name}</td>
          <td>${prod.total ?? 0}</td>
          <td><input type="number" name="amount_${prod.name}" min="1" max="${prod.total ?? 0}" /></td>
          <td><input type="number" name="price_${prod.name}" min="1" /></td>
        `;
        tbody.appendChild(row);
      });
    } catch {}
  },

  checkLimit() {
    // 최대 5개까지만 체크 가능
    const checked = document.querySelectorAll('input[name="selectProd"]:checked');
    const boxes = document.querySelectorAll('input[name="selectProd"]');
    boxes.forEach(box => box.disabled = false);
    if (checked.length >= 5) {
      boxes.forEach(box => { if (!box.checked) box.disabled = true; });
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    // 체크된 제품만 추출, 각 등록수량/가격 가져오기
    const checked = Array.from(document.querySelectorAll('input[name="selectProd"]:checked'));
    if (checked.length < 1) return alert("1개 이상 선택하세요");
    if (checked.length > 5) return alert("최대 5개까지 동시 등록 가능합니다");
    const payload = [];
    for (let box of checked) {
      const name = box.value;
      const amount = parseInt(document.querySelector(`input[name="amount_${name}"]`).value);
      const price = parseInt(document.querySelector(`input[name="price_${name}"]`).value);
      if (!amount || !price) return alert(`[${name}] 수량/가격 입력!`);
      payload.push({ name, price, amount });
    }
    // 등록 (배열 단위 POST)
    await fetch(`${API_MARKET}/products/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload })
    });
    alert("전광판 등록 완료!");
    this.refreshAll();
  },

  // 전광판(마켓) 등록제품 관리
  async fetchMarketProducts() {
    try {
      const res = await fetch(`${API_MARKET}/products`);
      const products = await res.json();
      const tbody = document.getElementById('marketProductBody');
      tbody.innerHTML = '';
      products.forEach(prod => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><input type="text" value="${prod.name}" onchange="AdminMarket.editMarketProduct('${prod._id}', 'name', this.value)" /></td>
          <td><input type="number" value="${prod.price}" onchange="AdminMarket.editMarketProduct('${prod._id}', 'price', this.value)" /></td>
          <td><input type="number" value="${prod.amount}" onchange="AdminMarket.editMarketProduct('${prod._id}', 'amount', this.value)" /></td>
          <td>
            <button onclick="AdminMarket.toggleMarketProduct('${prod._id}', ${!prod.active})" class="${prod.active ? 'on' : 'off'}">
              ${prod.active ? 'ON' : 'OFF'}
            </button>
          </td>
          <td>
            <button onclick="AdminMarket.deleteMarketProduct('${prod._id}')">삭제</button>
          </td>
        `;
        tbody.appendChild(row);
      });
    } catch {}
  },
  async editMarketProduct(id, field, value) {
    await fetch(`${API_MARKET}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    });
    this.fetchMarketProducts();
  },
  async toggleMarketProduct(id, newActive) {
    await fetch(`${API_MARKET}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: newActive })
    });
    this.fetchMarketProducts();
  },
  async deleteMarketProduct(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await fetch(`${API_MARKET}/products/${id}`, { method: 'DELETE' });
    this.fetchMarketProducts();
  },

  // 전체 갱신
  refreshAll() {
    this.fetchServerStatus();
    this.fetchSeedStatus();
    this.fetchUniqueProducts();
    this.fetchMarketProducts();
  }
};

// 최초 및 주기적 새로고침
AdminMarket.refreshAll();
setInterval(() => AdminMarket.refreshAll(), 10000); // 10초마다 자동새로고침
