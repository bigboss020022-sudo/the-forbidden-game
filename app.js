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
    el.className = "slot";
    el.innerHTML = `<button class="remove" aria-label="Убрать">×</button><span>▧</span><span class="slot-name">${c.name}</span><span class="slot-qty">×${c.qty}</span>`;
    el.querySelector(".remove").addEventListener("click", () => { selected.splice(index,1); renderSlots(); });
    slots.appendChild(el);
  });
  const plus = document.createElement("button");
  plus.className = "slot";
  plus.innerHTML = "<span style='font-size:30px'>＋</span><span class='slot-name'>Добавить карту</span>";
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
    const used = selected.filter(x => x.name === c.name).reduce((s,x) => s+x.qty,0);
    const available = c.qty - used;
    return `<button class="picker-card" data-name="${c.name}" ${available <= 0 ? "disabled" : ""}>${c.symbol}<br>${c.name}<small>Доступно: ×${available}</small></button>`;
  }).join("");
  grid.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    const c = inventory.find(x => x.name === b.dataset.name);
    const existing = selected.find(x => x.name === c.name);
    if (existing) existing.qty += 1; else selected.push({name:c.name,qty:1});
    renderSlots(); renderPicker();
  }));
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
