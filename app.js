const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const inventory = [
  {name:"Крестьянин",qty:20,type:"Обычные",art:"#9c8058",symbol:"♟",desc:"Житель королевства."},
  {name:"Воин",qty:5,type:"Обычные",art:"#665b4b",symbol:"⚔",desc:"Боец королевства."},
  {name:"Королева",qty:1,type:"Особые",art:"#b8a8a0",symbol:"♕",desc:"Королевская карта."},
  {name:"Король",qty:1,type:"Особые",art:"#8b7652",symbol:"♔",desc:"Королевская карта."},
  {name:"Шут",qty:2,type:"Особые",art:"#90637f",symbol:"♟",desc:"Таинственная карта."},
  {name:"Смерть",qty:1,type:"Всадники",art:"#526a81",symbol:"☠",desc:"Один из четырёх Всадников."},
  {name:"Чума",qty:1,type:"Всадники",art:"#667453",symbol:"♧",desc:"Один из четырёх Всадников."},
  {name:"Война",qty:1,type:"Всадники",art:"#8f493b",symbol:"⚔",desc:"Один из четырёх Всадников."},
  {name:"Голод",qty:1,type:"Всадники",art:"#8c7d62",symbol:"⌁",desc:"Один из четырёх Всадников."},
  {name:"Авел",qty:1,type:"Обычные",art:"#b8a18a",symbol:"♙",desc:"Карта персонажа."},
  {name:"Каин",qty:1,type:"Обычные",art:"#647786",symbol:"♟",desc:"Карта персонажа."},
  {name:"Мечта",qty:1,type:"Особые",art:"#8c83a9",symbol:"✧",desc:"Компонент одного из рецептов."},
  {name:"Безумие",qty:2,type:"Особые",art:"#697a69",symbol:"◈",desc:"Карта с особым эффектом."},
  {name:"Рыцарь",qty:1,type:"Обычные",art:"#71828c",symbol:"♞",desc:"Карта персонажа."}
];
let currentFilter = "Все";
let selected = [];
let currentCard = null;

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === id));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.screen === id));
  if (id !== "craft") document.getElementById("picker").classList.add("hidden");
}
document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => showScreen(b.dataset.screen)));
document.querySelectorAll(".trial").forEach(b => b.addEventListener("click", () => {
  document.getElementById("trial-note").textContent = `${b.dataset.horseman}: экран испытания выбран. Этапы и правила подключим позже.`;
}));

function renderCards() {
  const query = (document.getElementById("card-search")?.value || "").toLowerCase();
  const cards = inventory.filter(c => (currentFilter === "Все" || c.type === currentFilter) && c.name.toLowerCase().includes(query));
  document.getElementById("cards-grid").innerHTML = cards.map(c => `
    <button class="card" data-name="${c.name}">
      <div class="card-art" style="--art:${c.art}">${c.symbol}</div>
      <div class="card-name">${c.name}</div><div class="card-count">×${c.qty}</div>
    </button>`).join("");
  document.querySelectorAll("#cards-grid .card").forEach(b => b.addEventListener("click", () => {
    const c = inventory.find(x => x.name === b.dataset.name);
    currentCard = c;
    const detail = document.getElementById("card-detail");
    detail.classList.remove("hidden");
    detail.innerHTML = `<strong>${c.name}</strong><p>${c.desc}</p><small>Экземпляров: ×${c.qty}</small>`;
  }));
}
document.querySelectorAll(".filter").forEach(b => b.addEventListener("click", () => {
  currentFilter = b.dataset.filter;
  document.querySelectorAll(".filter").forEach(x => x.classList.toggle("active", x === b));
  renderCards();
}));
document.getElementById("card-search").addEventListener("input", renderCards);

function renderSlots() {
  const slots = document.getElementById("slots");
  slots.innerHTML = "";
  selected.forEach((c, index) => {
    const el = document.createElement("div");
    el.className = "slot deck-slot";
    const layers = Math.min(4, Math.max(1, Math.ceil(c.qty / 3)));
    const stack = Array.from({length: layers}, (_, i) => `<span class="stack-card stack-${i+1}">${c.symbol}</span>`).join("");
    el.innerHTML = `<button class="remove" aria-label="Убрать стопку" title="Убрать стопку">×</button><div class="stack-visual" style="--art:${c.art}">${stack}<span class="stack-count">×${c.qty}</span></div><span class="slot-name">${c.name}</span><div class="stack-controls"><button class="qty-btn minus" aria-label="Убрать одну">−</button><span>×${c.qty}</span><button class="qty-btn plus" aria-label="Добавить одну">+</button></div>`;
    el.querySelector(".remove").addEventListener("click", () => { selected.splice(index, 1); renderSlots(); });
    el.querySelector(".minus").addEventListener("click", () => { c.qty--; if (c.qty <= 0) selected.splice(index, 1); renderSlots(); renderPicker(); });
    el.querySelector(".plus").addEventListener("click", () => {
      const original = inventory.find(x => x.name === c.name);
      const used = selected.filter(x => x.name === c.name).reduce((sum, x) => sum + x.qty, 0);
      if (used < original.qty) c.qty++;
      renderSlots(); renderPicker();
    });
    slots.appendChild(el);
  });
  const plus = document.createElement("button");
  plus.className = "slot add-slot";
  plus.innerHTML = "<span class='add-symbol'>＋</span><span class='slot-name'>Добавить карту</span>";
  plus.addEventListener("click", openPicker);
  slots.appendChild(plus);
  document.getElementById("craft-button").disabled = selected.length < 2;
}
function openPicker() {
  const picker = document.getElementById("picker");
  picker.classList.remove("hidden");
  renderPicker();
  picker.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function renderPicker() {
  const query = document.getElementById("picker-search").value.toLowerCase();
  const grid = document.getElementById("picker-grid");
  grid.innerHTML = inventory.filter(c => c.name.toLowerCase().includes(query)).map(c => {
    const used = selected.filter(x => x.name === c.name).reduce((sum, x) => sum + x.qty, 0);
    const available = c.qty - used;
    return `<div class="picker-card ${available <= 0 ? 'unavailable' : ''}"><div class="picker-card-symbol" style="--art:${c.art}">${c.symbol}</div><b>${c.name}</b><small>Доступно: ×${available}</small><div class="picker-actions"><button class="add-one" data-name="${c.name}" ${available <= 0 ? "disabled" : ""}>+1</button><input class="quantity-input" data-qty-for="${c.name}" type="number" min="1" max="${Math.max(1, available)}" value="${Math.min(available || 1, 1)}" aria-label="Количество ${c.name}" ${available <= 0 ? "disabled" : ""}><button class="add-quantity" data-name="${c.name}" ${available <= 0 ? "disabled" : ""}>Добавить</button></div></div>`;
  }).join("");
  grid.querySelectorAll(".add-one").forEach(b => b.addEventListener("click", () => addToCraft(b.dataset.name, 1)));
  grid.querySelectorAll(".add-quantity").forEach(b => b.addEventListener("click", () => {
    const input = grid.querySelector(`[data-qty-for="${b.dataset.name}"]`);
    addToCraft(b.dataset.name, Number(input.value));
  }));
}
function addToCraft(name, amount) {
  const c = inventory.find(x => x.name === name);
  if (!c || !Number.isFinite(amount) || amount < 1) return;
  const used = selected.filter(x => x.name === name).reduce((sum, x) => sum + x.qty, 0);
  const add = Math.min(Math.floor(amount), c.qty - used);
  if (add <= 0) return;
  const existing = selected.find(x => x.name === name);
  if (existing) existing.qty += add; else selected.push({name:c.name, qty:add});
  renderSlots(); renderPicker();
}
document.getElementById("open-picker").addEventListener("click", openPicker);
document.getElementById("close-picker").addEventListener("click", () => document.getElementById("picker").classList.add("hidden"));
document.getElementById("picker-search").addEventListener("input", renderPicker);
document.getElementById("craft-button").addEventListener("click", () => {
  document.getElementById("craft-note").textContent = "Демонстрация: комбинация выбрана. Проверка рецепта и сюжетная сцена ещё не подключены; карты не списаны.";
});
document.getElementById("get-card").addEventListener("click", () => {
  document.getElementById("home-note").textContent = "Это демо-кнопка. Систему попыток и настоящую выдачу карт подключим позже.";
});
renderCards();
renderSlots();
