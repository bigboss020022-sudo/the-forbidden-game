const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const API_BASE = 'https://the-forbidden-api.onrender.com';
const telegramInitData = tg?.initData || '';
const serverMode = Boolean(telegramInitData);
let serverInstances = [];
async function api(path, options={}) {
 const headers = {'Content-Type':'application/json'};
 if (telegramInitData) headers['X-Telegram-Init-Data'] = telegramInitData;
 const response = await fetch(API_BASE + path, {...options, headers:{...headers,...(options.headers||{})}});
 let data={}; try { data=await response.json(); } catch {}
 if (!response.ok) throw new Error(data.detail || 'Ошибка API: '+response.status);
 return data;
}
function syncInventoryFromServer() {
 const templates = new Map(initialInventory.map(c=>[c.name,c]));
 const totals = new Map();
 serverInstances.forEach(i=>{if(i.zone==='deck') totals.set(i.card_name,(totals.get(i.card_name)||0)+1)});
 inventory = [...totals.entries()].map(([name,qty])=>{
  const base=templates.get(name)||{name,type:'Особые',symbol:'✧',desc:'Сущность из забытых королевств.',accent:'#9b7d43'};
  return {...base,qty,rarity:serverInstances.find(i=>i.card_name===name)?.rarity||base.rarity};
 });
 renderDeck(); renderCraft(); renderPicker(); renderTabooOwned();
}
async function refreshServerCollection() {
 const data=await api('/api/me/cards');
 serverInstances=data.cards||[];
 syncInventoryFromServer();
 const playerName=data.user?.first_name;
 if(playerName) document.querySelector('.player strong').textContent=playerName;
}
const initialInventory = [
 {name:'Крестьянин',qty:20,type:'Обычные',symbol:'♟',desc:'Житель королевства.',accent:'#8d7047'},
 {name:'Воин',qty:5,type:'Обычные',symbol:'⚔',desc:'Защитник королевства.',accent:'#5b7188'},
 {name:'Фермер',qty:0,type:'Обычные',symbol:'♣',desc:'Тот, кто кормит королевство.',accent:'#6d8754'},
 {name:'Кузнец',qty:0,type:'Обычные',symbol:'⚒',desc:'Создатель инструментов и оружия.',accent:'#7c7c86'},
 {name:'Пекарь',qty:0,type:'Обычные',symbol:'✿',desc:'Хранитель хлеба и тепла.',accent:'#b58b56'},
 {name:'Торговец',qty:0,type:'Обычные',symbol:'⚖',desc:'Связывает далёкие земли обменом.',accent:'#a58b4e'},
 {name:'Король',qty:1,type:'Особые',symbol:'♔',desc:'Владыка королевства.',accent:'#9d773a'},
 {name:'Королева',qty:1,type:'Особые',symbol:'♕',desc:'Хранительница трона.',accent:'#a65f86'},
 {name:'Рыцарь',qty:1,type:'Обычные',symbol:'♞',desc:'Верный защитник.',accent:'#577d9c'},
 {name:'Авел',qty:1,type:'Обычные',symbol:'♙',desc:'Одна из двух связанных сущностей.',accent:'#9a7954'},
 {name:'Каин',qty:1,type:'Обычные',symbol:'♟',desc:'Одна из двух связанных сущностей.',accent:'#7b586b'},
 {name:'Мечта',qty:1,type:'Особые',symbol:'✧',desc:'Возможность, которой ещё не было.',accent:'#687bb9'},
 {name:'Безумие',qty:2,type:'Особые',symbol:'◈',desc:'Эффект, меняющий восприятие. Недостижимый свет, который способен исказить саму реальность.',accent:'#758453',art:'assets/madness-card.png',rarity:'MYTHIC'},
 {name:'Шут',qty:2,type:'Особые',symbol:'♟',desc:'Тот, кто смеётся на краю бездны.',accent:'#9c5b90'},
 {name:'Смерть',qty:1,type:'Всадники',symbol:'☠',desc:'Один из четырёх Всадников.',accent:'#586b8a'},
 {name:'Чума',qty:1,type:'Всадники',symbol:'♧',desc:'Один из четырёх Всадников.',accent:'#657b58'},
 {name:'Война',qty:1,type:'Всадники',symbol:'⚔',desc:'Один из четырёх Всадников.',accent:'#9a4549'},
 {name:'Голод',qty:1,type:'Всадники',symbol:'⌁',desc:'Один из четырёх Всадников.',accent:'#947f5a'}
];
let inventory = serverMode ? [] : structuredClone(initialInventory);
let selected = new Map();
let pickerMode = 'one', deckFilter = 'Все', bookFilter = 'Все', toastTimer;
let tabooCards = new Set(JSON.parse(localStorage.getItem('forbidden-taboo-cards')||'[]'));
const recipes = {
 'Королевство': {'Крестьянин':20,'Король':1,'Королева':1,'Рыцарь':1},
 'Дружба': {'Авел':1,'Каин':1},
 'Одержимость': {'Мечта':1,'Безумие':1}
};
const lore = [
 {name:'Тень',type:'Сущности',symbol:'◈',accent:'#27334e',desc:'То, что остаётся, когда исчезает свет.',open:true},
 {name:'Королевство',type:'Места',symbol:'♜',accent:'#436a98',desc:'Земля, объединившая людей под одной короной.',open:true},
 {name:'Пустота',type:'Сущности',symbol:'✺',accent:'#6745b8',desc:'Место, где даже память теряет форму.',open:true},
 {name:'Проклятие',type:'События',symbol:'♧',accent:'#8b283c',desc:'Событие, чья цена скрыта от всех.',open:true},
 {name:'Бессмертие',type:'Сущности',symbol:'∞',accent:'#9b7d43',desc:'Запись пока не открыта.',open:false},
 {name:'Забытый бог',type:'Сущности',symbol:'✧',accent:'#465f89',desc:'Запись пока не открыта.',open:false},
 {name:'Хронастаз',type:'События',symbol:'⌛',accent:'#7663a5',desc:'Запись пока не открыта.',open:false},
 {name:'Антихрист',type:'Сущности',symbol:'☠',accent:'#6b2836',desc:'Запись пока не открыта.',open:false}
];
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),2600);}
function cardMarkup(card, large=false){
 const art = card.art ? `<img class="card-illustration" src="${card.art}" alt="Иллюстрация карты ${card.name}">` : `<div class="generic-card-art" style="--accent:${card.accent||'#9b7d43'}"><span>${card.symbol||'✧'}</span><small>THE FORBIDDEN</small></div>`;
 const rarity=card.rarity||card.type||'СУЩНОСТЬ';
 return `<div class="collectible-card card-flippable ${large?'large-card':''} ${card.rarity==='MYTHIC'?'mythic-card':''}" role="button" tabindex="0" aria-label="Перевернуть карту ${card.name}"><div class="card-flip-inner"><div class="card-face card-front"><div class="foil-glare"></div><div class="card-frame">${art}<div class="card-caption"><small>${rarity}</small><b>${card.name}</b><span>${card.desc||'Сущность из забытых королевств.'}</span></div></div></div><div class="card-face card-back"><div class="back-ornament">✧</div><small class="back-brand">THE FORBIDDEN · ${rarity}</small><h3>${card.name}</h3><div class="back-divider"></div><section><b>ЭФФЕКТ</b><p>Текст эффекта пока запечатан…</p></section><section><b>ДЕБАФ</b><p>Неизвестное влияние…</p></section><section><b>ОПИСАНИЕ</b><p>История этой карты ещё не раскрыта.</p></section><section><b>СОЗДАНИЕ</b><p>Источник происхождения пока неизвестен.</p></section><div class="back-footer">ПЕРЕВЕРНИ, ЧТОБЫ ВЕРНУТЬСЯ</div></div></div></div>`;
}
function flipCard(el){el.classList.toggle('is-flipped');}
function bindCardFlip(root){
 root.querySelectorAll('.card-flippable').forEach(el=>{
  el.addEventListener('click',()=>flipCard(el));
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flipCard(el)}});
 });
}
function openCardViewer(card){
 const viewer=document.getElementById('card-viewer');
 document.getElementById('viewer-card').innerHTML=cardMarkup(card,true);
 bindCardFlip(document.getElementById('viewer-card'));
 document.getElementById('viewer-info').innerHTML=`<h2>${card.name}</h2><p>${card.desc||''}</p><small>В общей колоде: ×${card.qty}</small><p class="flip-hint">Нажми на карту или проведи по ней влево/вправо, чтобы посмотреть обратную сторону.</p>${card.rarity==='MYTHIC'?'<p class="mythic-note">✦ MYTHIC · Радужная фольга</p>':''}`;
 viewer.classList.remove('hidden'); document.body.classList.add('modal-open');
}
let viewerTouchX=null;
document.getElementById('viewer-card').addEventListener('touchstart',e=>{viewerTouchX=e.changedTouches[0].clientX},{passive:true});
document.getElementById('viewer-card').addEventListener('touchend',e=>{if(viewerTouchX===null)return;const dx=e.changedTouches[0].clientX-viewerTouchX;viewerTouchX=null;if(Math.abs(dx)>35){const card=document.querySelector('#viewer-card .card-flippable');if(card)card.classList.toggle('is-flipped')}},{passive:true});
document.getElementById('viewer-card').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')viewerTouchX=e.clientX});
document.getElementById('viewer-card').addEventListener('pointerup',e=>{if(e.pointerType!=='mouse'||viewerTouchX===null)return;const dx=e.clientX-viewerTouchX;viewerTouchX=null;if(Math.abs(dx)>45){const card=document.querySelector('#viewer-card .card-flippable');if(card)card.classList.toggle('is-flipped')}});
function closeViewer(){document.getElementById('card-viewer').classList.add('hidden');document.body.classList.remove('modal-open');}
document.getElementById('viewer-close').addEventListener('click',closeViewer);
document.getElementById('card-viewer').addEventListener('click',e=>{if(e.target.id==='card-viewer')closeViewer()});
function showCraftReveal(card){const viewer=document.getElementById('craft-reveal');document.getElementById('reveal-card').innerHTML=cardMarkup(card,true);bindCardFlip(document.getElementById('reveal-card'));document.getElementById('reveal-info').innerHTML=`<h2>${card.name}</h2><p>${card.desc||'Новая сущность добавлена в Общую колоду.'}</p><small>Карта добавлена в коллекцию</small><p class="flip-hint">Нажми на карту, чтобы посмотреть рубашку.</p>`;viewer.classList.remove('hidden');document.body.classList.add('modal-open');}
document.getElementById('reveal-close').addEventListener('click',()=>{document.getElementById('craft-reveal').classList.add('hidden');document.body.classList.remove('modal-open')});
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));if(id!=='craft')document.getElementById('picker').classList.add('hidden');}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.screen)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.go)));
document.getElementById('event-chip').addEventListener('click',()=>showScreen('trials'));
document.getElementById('settings-button').addEventListener('click',()=>toast('Настройки профиля подключим на следующем этапе.'));
document.getElementById('get-card').addEventListener('click',async()=>{
 if(serverMode){
  try { const data=await api('/api/draw',{method:'POST',body:'{}'}); await refreshServerCollection(); const card=inventory.find(c=>c.name===data.card.name); document.getElementById('home-note').textContent='Найдена карта «'+data.card.name+'» · #'+data.card.serial+'.'; if(card)showCraftReveal(card); toast('Карта добавлена в серверную коллекцию.'); }
  catch(e){toast(e.message||'Не удалось получить карту.');}
 } else {
 const weights={'Крестьянин':4200,'Воин':2200,'Фермер':1400,'Кузнец':1000,'Пекарь':700,'Торговец':400,'Король':350,'Королева':300,'Рыцарь':650,'Авел':450,'Каин':450,'Мечта':100,'Безумие':25,'Шут':250,'Смерть':90,'Чума':90,'Война':90,'Голод':90};
 const pool=Object.entries(weights).filter(([name])=>inventory.some(c=>c.name===name));
 const total=pool.reduce((sum,[,weight])=>sum+weight,0);let point=Math.random()*total;let chosen=pool[0]?.[0]||'Крестьянин';
 for(const [name,weight] of pool){point-=weight;if(point<0){chosen=name;break}}
 let card=inventory.find(c=>c.name===chosen);
 if(!card){card={name:chosen,qty:0,type:'Обычные',symbol:'✧',desc:'Сущность из забытых королевств.',accent:'#9b7d43'};inventory.push(card)}
 card.qty+=1;document.getElementById('home-note').textContent='Демо: найдена карта «'+card.name+'». Для общей коллекции открой мини-приложение через Telegram.';renderDeck();showCraftReveal(card);
}
});
function totalSelected(){return [...selected.values()].reduce((sum,v)=>sum+v,0)}
function renderCraft(){const row=document.getElementById('ingredient-row');row.innerHTML='';for(const [name,qty] of selected){const c=inventory.find(x=>x.name===name);if(!c)continue;const el=document.createElement('div');el.className='ingredient-card';el.innerHTML=`<button class="remove-stack" title="Убрать стопку" aria-label="Убрать ${name}">×</button><div class="card-emblem" style="--accent:${c.accent}">${c.symbol}</div><div class="ingredient-name">${c.name}</div><div class="stack-count">×${qty}</div><div class="stack-controls"><button class="mini-control minus" aria-label="Уменьшить ${name}">−</button><button class="mini-control plus" aria-label="Увеличить ${name}">+</button></div>`;el.querySelector('.remove-stack').addEventListener('click',()=>{selected.delete(name);renderCraft();renderPicker()});el.querySelector('.minus').addEventListener('click',()=>changeStack(name,-1));el.querySelector('.plus').addEventListener('click',()=>changeStack(name,1));row.appendChild(el)}const add=document.createElement('button');add.className='add-card-tile';add.innerHTML='<span>＋</span><small>Добавить карту</small>';add.addEventListener('click',openPicker);row.appendChild(add);document.getElementById('ingredient-total').textContent=`Ингредиентов: ${totalSelected()}`;document.getElementById('craft-button').disabled=selected.size===0;}
function changeStack(name,delta){const current=selected.get(name)||0;const card=inventory.find(c=>c.name===name);const next=Math.max(0,Math.min(card.qty,current+delta));if(next===0)selected.delete(name);else selected.set(name,next);renderCraft();renderPicker()}
function openPicker(){document.getElementById('picker').classList.remove('hidden');renderPicker();document.getElementById('picker').scrollIntoView({behavior:'smooth',block:'nearest'})}
document.getElementById('open-picker').addEventListener('click',openPicker);document.getElementById('close-picker').addEventListener('click',()=>document.getElementById('picker').classList.add('hidden'));
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{pickerMode=b.dataset.mode;document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('active',x===b));renderPicker()}));
document.getElementById('picker-search').addEventListener('input',renderPicker);
function renderPicker(){const query=document.getElementById('picker-search').value.trim().toLowerCase();const grid=document.getElementById('picker-grid');const cards=inventory.filter(c=>c.name.toLowerCase().includes(query));grid.innerHTML='';cards.forEach(c=>{const inUse=selected.get(c.name)||0,available=c.qty-inUse;const b=document.createElement('button');b.className='picker-card';b.innerHTML=`<span class="picker-symbol" style="--accent:${c.accent}">${c.symbol}</span><span class="picker-info"><b>${c.name}</b><small>В наличии: ×${available}</small></span><span class="picker-add">${pickerMode==='one'?'＋':'×'}</span>`;b.disabled=available<=0;b.style.opacity=available<=0?'.45':'1';b.addEventListener('click',()=>{if(pickerMode==='one'){selected.set(c.name,(selected.get(c.name)||0)+1);renderCraft();renderPicker()}else openQuantityDialog(c,available)});grid.appendChild(b)});if(!cards.length)grid.innerHTML='<div class="empty-state">Ничего не найдено.</div>'}
function openQuantityDialog(card,available){if(available<=0){toast('Нет доступных копий этой карты.');return}const dialog=document.getElementById('quantity-dialog'),input=document.getElementById('quantity-input');document.getElementById('quantity-title').textContent=card.name;document.getElementById('quantity-available').textContent=`Доступно для стола: ${available}. Уже выбрано: ${selected.get(card.name)||0}.`;input.max=available;input.value=String(Math.min(available,1));dialog.showModal();document.getElementById('quantity-confirm').onclick=(event)=>{event.preventDefault();const amount=Math.max(1,Math.min(available,Number(input.value)||1));selected.set(card.name,(selected.get(card.name)||0)+amount);dialog.close();renderCraft();renderPicker();toast(`${card.name} ×${amount} добавлено на стол.`)};}
document.getElementById('clear-table').addEventListener('click',()=>{selected.clear();renderCraft();renderPicker();document.getElementById('craft-note').textContent='Стол очищен. Карты вернулись в список выбора.'});
document.querySelectorAll('.recipe-row').forEach(b=>b.addEventListener('click',()=>{const recipe=recipes[b.dataset.recipe];if(!recipe)return;selected.clear();Object.entries(recipe).forEach(([name,qty])=>{const card=inventory.find(c=>c.name===name);if(card)selected.set(name,Math.min(qty,card.qty))});renderCraft();document.getElementById('craft-note').textContent=`На стол добавлены ингредиенты рецепта «${b.dataset.recipe}». Проверь количество перед созданием.`;toast(`Рецепт «${b.dataset.recipe}» загружен на стол.`);document.getElementById('craft').scrollTo?.({top:0,behavior:'smooth'})}));
document.getElementById('recipe-info').addEventListener('click',()=>toast('Рецепты — подсказки. Для неизвестных комбинаций можно экспериментировать.'));
document.getElementById('craft-button').addEventListener('click',async()=>{
 const found=Object.entries(recipes).find(([name,recipe])=>Object.entries(recipe).every(([card,qty])=>(selected.get(card)||0)>=qty)&&totalSelected()===Object.values(recipe).reduce((a,b)=>a+b,0));
 if(!found){document.getElementById('craft-note').textContent='Известный рецепт не найден. Ингредиенты сохранены — можешь изменить комбинацию.';toast('Комбинация пока не распознана. Карты не потрачены.');return}
 const [name,recipe]=found;
 if(Object.entries(recipe).some(([card,qty])=>(selected.get(card)||0)<qty)){toast('Не хватает ингредиентов для рецепта.');return}
 if(serverMode){try{const data=await api('/api/craft',{method:'POST',body:JSON.stringify({ingredients:recipe})});selected.clear();await refreshServerCollection();renderCraft();renderPicker();document.getElementById('craft-note').textContent='Создана карта «'+data.card.name+'». Ингредиенты списаны сервером.';const output=inventory.find(c=>c.name===data.card.name)||{name:data.card.name,qty:1,type:'Особые',symbol:'✧',desc:'Создана по рецепту.',accent:'#b58a43'};showCraftReveal(output);toast('✦ Создана карта «'+data.card.name+'»!')}catch(e){toast(e.message||'Крафт не удался.')}return}
 for(const [card,qty] of Object.entries(recipe)){const left=(selected.get(card)||0)-qty;if(left>0)selected.set(card,left);else selected.delete(card)}
 const output=inventory.find(c=>c.name===name);if(output)output.qty+=1;else inventory.push({name,qty:1,type:'Особые',symbol:'✧',desc:'Новая созданная карта.',accent:'#b58a43'});
 renderCraft();renderPicker();renderDeck();document.getElementById('craft-note').textContent='Создана карта «'+name+'»! В демо ингредиенты списаны локально.';showCraftReveal(output||{name,qty:1,type:'Особые',symbol:'✧',desc:'Новая созданная карта.',accent:'#b58a43'});toast('✦ Создана карта «'+name+'»!');
});
function renderDeck(){const query=(document.getElementById('deck-search').value||'').toLowerCase();const cards=inventory.filter(c=>c.qty>0&&(deckFilter==='Все'||c.type===deckFilter)&&c.name.toLowerCase().includes(query));const grid=document.getElementById('cards-grid');grid.innerHTML=cards.map(c=>`<button class="card ${c.rarity==='MYTHIC'?'mythic-card':''}" data-card="${c.name}"><div class="card-art" style="--accent:${c.accent}">${c.art?`<img src="${c.art}" alt="${c.name}">`:c.symbol}</div><span class="card-name">${c.name}</span><span class="card-count">×${c.qty}</span>${c.rarity==='MYTHIC'?'<span class="rarity-badge">MYTHIC</span>':''}</button>`).join('')||'<div class="empty-state">В этой категории пока нет карт.</div>';grid.querySelectorAll('[data-card]').forEach(b=>{
  b.draggable=true;
  b.addEventListener('dragstart',e=>{e.dataTransfer?.setData('text/card-name',b.dataset.card);if(e.dataTransfer)e.dataTransfer.effectAllowed='move'});
  let touchStart=null;
  b.addEventListener('touchstart',e=>{const t=e.changedTouches[0];touchStart={x:t.clientX,y:t.clientY,name:b.dataset.card}},{passive:true});
  b.addEventListener('touchend',e=>{
   if(!touchStart)return;const t=e.changedTouches[0],start=touchStart;touchStart=null;
   const moved=Math.hypot(t.clientX-start.x,t.clientY-start.y)>48;
   const target=document.elementFromPoint(t.clientX,t.clientY);
   if(moved&&target?.closest('#book')){e.preventDefault();moveCardToTaboo(start.name)}
  },{passive:false});
  b.addEventListener('click',()=>{const c=inventory.find(x=>x.name===b.dataset.card);openCardViewer(c)});
 });}
document.getElementById('deck-search').addEventListener('input',renderDeck);document.querySelectorAll('[data-deck-filter]').forEach(b=>b.addEventListener('click',()=>{deckFilter=b.dataset.deckFilter;document.querySelectorAll('[data-deck-filter]').forEach(x=>x.classList.toggle('active',x===b));renderDeck()}));
async function moveCardToTaboo(cardName){
 if(serverMode){
  const instance=serverInstances.find(i=>i.card_name===cardName&&i.zone==='deck');
  if(!instance){toast('Нет доступной копии этой карты в колоде.');return}
  try{await api('/api/me/card-zone',{method:'POST',body:JSON.stringify({serial:Number(instance.serial),zone:'taboo'})});await refreshServerCollection();toast('Карта перемещена в Книгу табу.')}
  catch(e){toast(e.message||'Не удалось переместить карту.')}
 }else{
  if(!inventory.some(c=>c.name===cardName&&c.qty>0)){toast('Нет доступной копии карты.');return}
  tabooCards.add(cardName);saveTaboo();renderTabooOwned();renderTabooPicker();toast('Карта добавлена в демо-Книгу табу.');
 }
}
const tabooDropZone=document.getElementById('taboo-owned');
tabooDropZone.addEventListener('dragover',e=>{e.preventDefault();tabooDropZone.classList.add('drop-target')});
tabooDropZone.addEventListener('dragleave',()=>tabooDropZone.classList.remove('drop-target'));
tabooDropZone.addEventListener('drop',e=>{e.preventDefault();tabooDropZone.classList.remove('drop-target');const name=e.dataTransfer?.getData('text/card-name');if(name)moveCardToTaboo(name)});
function saveTaboo(){localStorage.setItem('forbidden-taboo-cards',JSON.stringify([...tabooCards]));}
function tabooInstances(){return serverMode?serverInstances.filter(i=>i.zone==='taboo'):inventory.filter(c=>tabooCards.has(c.name)).map(c=>({serial:c.name,card_name:c.name,zone:'taboo'}));}
function renderTabooOwned(){
 const box=document.getElementById('taboo-owned'); const cards=tabooInstances();
 box.innerHTML=cards.length?cards.map(i=>{const c=inventory.find(x=>x.name===i.card_name)||initialInventory.find(x=>x.name===i.card_name)||{name:i.card_name,symbol:'✧'};return '<button class="taboo-owned-card" data-taboo-serial="'+i.serial+'"><span>'+(c.art?'<img src="'+c.art+'" alt="">':c.symbol)+'</span><b>'+c.name+'</b><small>Копия #'+i.serial+' · нажми, чтобы вернуть</small></button>'}).join(''):'<p class="empty-state taboo-empty">Пока нет карт в Книге табу. Добавь конкретную копию из Общей колоды.</p>';
 box.querySelectorAll('[data-taboo-serial]').forEach(b=>b.addEventListener('click',async()=>{const serial=b.dataset.tabooSerial;if(serverMode){try{await api('/api/me/card-zone',{method:'POST',body:JSON.stringify({serial:Number(serial),zone:'deck'})});await refreshServerCollection();toast('Копия возвращена в Общую колоду.')}catch(e){toast(e.message)}}else{tabooCards.delete(serial);saveTaboo();renderTabooOwned();renderTabooPicker();toast('Карта возвращена в демо-колоду.')}}));
}
function renderTabooPicker(){
 const grid=document.getElementById('taboo-picker-grid');
 if(serverMode){const cards=serverInstances.filter(i=>i.zone==='deck');grid.innerHTML=cards.map(i=>{const c=inventory.find(x=>x.name===i.card_name)||initialInventory.find(x=>x.name===i.card_name)||{name:i.card_name,symbol:'✧'};return '<button type="button" class="taboo-pick-card" data-taboo-pick="'+i.serial+'"><span>'+(c.art?'<img src="'+c.art+'" alt="">':c.symbol)+'</span><b>'+c.name+'</b><small>Копия #'+i.serial+'</small><em>＋ В Книгу табу</em></button>'}).join('')||'<p class="empty-state">В Общей колоде нет доступных копий.</p>';grid.querySelectorAll('[data-taboo-pick]').forEach(b=>b.addEventListener('click',async()=>{try{await api('/api/me/card-zone',{method:'POST',body:JSON.stringify({serial:Number(b.dataset.tabooPick),zone:'taboo'})});await refreshServerCollection();renderTabooPicker();toast('Конкретная копия перемещена в Книгу табу.')}catch(e){toast(e.message)}}));return}
 grid.innerHTML=inventory.filter(c=>c.qty>0).map(c=>'<button type="button" class="taboo-pick-card '+(tabooCards.has(c.name)?'selected':'')+'" data-taboo-pick="'+c.name+'"><span>'+(c.art?'<img src="'+c.art+'" alt="">':c.symbol)+'</span><b>'+c.name+'</b><small>В демо-колоде ×'+c.qty+'</small><em>'+(tabooCards.has(c.name)?'✓ В Книге':'＋ Добавить')+'</em></button>').join('');
 grid.querySelectorAll('[data-taboo-pick]').forEach(b=>b.addEventListener('click',()=>{const name=b.dataset.tabooPick;if(tabooCards.has(name))tabooCards.delete(name);else tabooCards.add(name);saveTaboo();renderTabooPicker();renderTabooOwned()}));
}
document.getElementById('open-taboo-picker').addEventListener('click',()=>{renderTabooPicker();document.getElementById('taboo-dialog').showModal()});
function renderLore(){const query=document.getElementById('book-search').value.trim().toLowerCase();const list=lore.filter(x=>(bookFilter==='Все'||x.type===bookFilter)&&x.name.toLowerCase().includes(query));const grid=document.getElementById('lore-grid');grid.innerHTML=list.map(x=>`<button class="lore-card ${x.open?'':'locked'}" data-lore="${x.name}"><div class="lore-art" style="--accent:${x.accent}">${x.open?x.symbol:'🔒'}</div><b>${x.name}</b><small>${x.open?'Открыто':'???'}</small></button>`).join('')||'<div class="empty-state">В этой категории записей нет.</div>';grid.querySelectorAll('[data-lore]').forEach(b=>b.addEventListener('click',()=>{const entry=lore.find(x=>x.name===b.dataset.lore);toast(entry.open?`${entry.name}: ${entry.desc}`:'Эта страница пока запечатана.')}));renderTabooOwned();}
document.getElementById('book-search').addEventListener('input',renderLore);document.querySelectorAll('[data-book-filter]').forEach(b=>b.addEventListener('click',()=>{bookFilter=b.dataset.bookFilter;document.querySelectorAll('[data-book-filter]').forEach(x=>x.classList.toggle('active',x===b));renderLore()}));
document.querySelectorAll('[data-trial]').forEach(b=>b.addEventListener('click',()=>{const title=b.dataset.trial;document.getElementById('trial-title').textContent=title;document.getElementById('trial-description').textContent=title==='Обычные испытания'?'Проверь базовые знания мира The Forbidden.':title==='Особые испытания'?'Уникальные испытания откроются по мере исследования колоды.':'Испытания табу предназначены для тех, кто открыл запретные страницы.';document.getElementById('trial-detail').classList.remove('hidden');document.getElementById('trial-detail').scrollIntoView({behavior:'smooth',block:'nearest'})}));document.getElementById('trial-start').addEventListener('click',()=>toast('Система этапов испытаний будет подключена отдельно.'));
renderCraft();renderPicker();renderDeck();renderLore();
if(serverMode){
 document.getElementById('home-note').textContent='Подключаем твою серверную коллекцию…';
 refreshServerCollection().then(()=>{document.getElementById('home-note').textContent='Коллекция синхронизирована с сервером.'}).catch(e=>{document.getElementById('home-note').textContent='Не удалось загрузить коллекцию: '+e.message;toast(e.message)});
} else {
 document.getElementById('home-note').textContent='Режим предпросмотра в браузере. Для реальной коллекции открой Mini App в Telegram.';
}
