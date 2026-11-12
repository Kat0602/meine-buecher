
'use strict';
const KEY='meine-buecher-v1';let books=[];let editing=null;let currentCover='';
let scanReader=null,scanStream=null,scanLoop=false;
const $=id=>document.getElementById(id);
function load(){try{let v=JSON.parse(localStorage.getItem(KEY)||'[]');books=Array.isArray(v)?v:[]}catch(e){alert('Gespeicherte Daten konnten nicht gelesen werden. Bitte keine neuen Einträge speichern, bevor du deine Sicherung geprüft hast.');books=[]}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(books))}catch(e){alert('Speichern fehlgeschlagen. Bitte Speicherplatz prüfen und eine Sicherung exportieren.');return false}return true}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
function render(){ $('total').textContent=books.length;$('read').textContent=books.filter(b=>b.status==='read').length;$('unread').textContent=books.filter(b=>b.status!=='read').length;let q=$('search').value.toLocaleLowerCase('de').trim(),f=$('filter').value;let list=books.filter(b=>(f==='all'||(f==='read'?b.status==='read':b.status!=='read'))&&[b.title,b.author,b.isbn,b.series,b.notes].some(x=>String(x||'').toLocaleLowerCase('de').includes(q)));const sort=$('sort').value;if(sort==='title')list.sort((a,b)=>a.title.localeCompare(b.title,'de'));if(sort==='author')list.sort((a,b)=>(a.author||'').localeCompare(b.author||'','de'));if(sort==='new')list.sort((a,b)=>(b.created||0)-(a.created||0));const root=$('books');root.replaceChildren();if(!list.length){const empty=node('div','',books.length?'Keine passenden Bücher gefunden.':'Noch keine Bücher eingetragen. Tippe auf „＋ Buch“.');empty.id='empty';root.append(empty);return}for(const b of list){let card=node('article','book');if(b.cover){const img=node('img','book-cover');img.src=b.cover;img.alt='Cover: '+b.title;img.loading='lazy';card.append(img);card.style.display='flow-root';img.style.float='left';img.style.marginRight='13px'}card.append(node('h3','',b.title),node('p','',b.author||'Autor nicht eingetragen'));let bottom=node('div','bottom');bottom.append(node('span','pill '+(b.status==='read'?'read':''),b.status==='read'?'✓ Gelesen':'○ Ungelesen'),node('span','stars',b.rating?'★'.repeat(+b.rating)+'☆'.repeat(5-(+b.rating)):''));card.append(bottom);if(b.series||b.volume||b.loan||b.notes){let details=node('p','muted',[b.series&&('Reihe: '+b.series+(b.volume?' · Band '+b.volume:'')),b.loan&&'Verliehen an: '+b.loan,b.notes].filter(Boolean).join(' · '));details.style.whiteSpace='pre-wrap';card.append(details)}let edit=node('button','secondary','Bearbeiten');edit.style.marginTop='12px';edit.addEventListener('click',()=>openEditor(b.id));card.append(edit);root.append(card)}}
function openEditor(id=null){editing=id;const b=books.find(x=>x.id===id);$('form').reset();$('formtitle').textContent=b?'Buch bearbeiten':'Buch hinzufügen';for(const k of ['title','author','isbn','price','status','rating','date','series','volume','loan','notes']){const input=$('form').elements.namedItem(k);input.value=b?(b[k]??(k==='status'?'unread':k==='rating'?'0':'')):(k==='status'?'unread':k==='rating'?'0':'')}currentCover=b?.cover||'';updateCoverPreview();$('cover-file').value='';$('cover-status').textContent='';$('lookup-isbn').value=b?.isbn||'';$('lookup-status').textContent='';stopScanner();$('editor').showModal()}
$('add').onclick=()=>openEditor();$('cancel').onclick=()=>{stopScanner();$('editor').close()};$('editor').addEventListener('close',stopScanner);$('form').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.target),data={};for(const [k,v] of fd.entries())data[k]=String(v).trim();if(!data.isbn&&$('lookup-isbn').value.trim()&&validISBN(isbnClean($('lookup-isbn').value)))data.isbn=isbnClean($('lookup-isbn').value);if(!data.title){data.title=data.isbn?'Buch '+data.isbn:'Buch ohne Titel';}data.rating=Number(data.rating)||0;const old=books.find(b=>b.id===editing);const next={...data,cover:currentCover,id:old?.id||((globalThis.crypto?.randomUUID?.())||String(Date.now())+'-'+Math.random()),created:old?.created||Date.now()};const before=books;books=old?books.map(b=>b.id===editing?next:b):[...books,next];if(save()){$('editor').close();render()}else books=before});
$('search').oninput=render;$('filter').onchange=render;$('sort').onchange=render;
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({format:'meine-buecher',version:1,exportedAt:new Date().toISOString(),books},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='meine-buecher-sicherung-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)};
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const v=JSON.parse(await file.text());if(v.format!=='meine-buecher'||!Array.isArray(v.books)||!v.books.every(b=>b&&typeof b.title==='string'&&typeof b.id==='string'))throw Error('Ungültige Sicherungsdatei');if(!confirm('Die aktuelle Bücherliste wird durch '+v.books.length+' Bücher aus der Sicherung ersetzt. Fortfahren?'))return;const previous=books;books=v.books;if(save())render();else books=previous}catch(err){alert('Import nicht möglich: '+err.message)}finally{e.target.value=''}};
load();render();if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});


// ISBN lookup via the user's Cloudflare Worker; scanning remains unchanged.
const isbnClean=x=>String(x||'').replace(/[^0-9Xx]/g,'').toUpperCase();
function validISBN(x){if(x.length===13)return /^\d{13}$/.test(x)&&[...x].reduce((a,c,i)=>a+Number(c)*(i%2?3:1),0)%10===0;if(x.length===10){if(!/^\d{9}[\dX]$/.test(x))return false;return [...x].reduce((a,c,i)=>a+(10-i)*(c==='X'?10:Number(c)),0)%11===0}return false}
function lookupMessage(t){$('lookup-status').textContent=t}

// Normalize catalog metadata without changing the ISBN or stored books.
function decodeCatalogText(value){
 const el=document.createElement('textarea');
 let text=String(value||'');
 for(let i=0;i<3;i++){
  const next=text.replace(/&#(?:x([0-9a-f]+)|([0-9]+));?/gi,(_,hex,dec)=>{
   const n=parseInt(hex||dec,hex?16:10);
   return n>=32&&n<=0x10ffff?String.fromCodePoint(n):'';
  }).replace(/&(?:amp|quot|apos|lt|gt|nbsp);/gi,entity=>{
   el.innerHTML=entity;return el.value;
  });
  if(next===text)break;
  text=next;
 }
 return text.replace(/[\u0091-\u0094\u0096-\u0097\u0098\u009c]/g,'')
  .replace(/\[(?:durchgestrichen|gestrichen)\]/gi,'')
  .replace(/\s+/g,' ').trim();
}
function cleanBookTitle(value){
 let title=decodeCatalogText(value).replace(/^[\s"'„“”‘’]+|[\s"'„“”‘’]+$/g,'').trim();
 // DNB records can contain the English main title and a German subtitle.
 title=title.replace(/\s*[:;]\s*/g,' – ').replace(/\s+[–-]\s+/g,' – ');
 return title;
}
function cleanAuthor(value){
 const name=decodeCatalogText(value);
 if(!name.includes(','))return name;
 return name.split(/\s*;\s*/).map(person=>{
  const m=person.match(/^([^,]+),\s*([^,]+)$/);
  return m?m[2].trim()+' '+m[1].trim():person;
 }).join('; ');
}
async function findCoverByISBN(isbn){
 if(!validISBN(isbn))return '';
 // Open Library responds with 404 for absent covers when default=false.
 try{
  const url='https://covers.openlibrary.org/b/isbn/'+encodeURIComponent(isbn)+'-M.jpg?default=false';
  const response=await fetch(url,{method:'GET',cache:'no-store'});
  if(response.ok && response.headers.get('content-type')?.startsWith('image/') && Number(response.headers.get('content-length')||1000)>100)return url;
 }catch(e){}
 try{
  const j=await fetchJson('https://www.googleapis.com/books/v1/volumes?q=isbn:'+encodeURIComponent(isbn)+'&maxResults=5');
  const match=(j.items||[]).find(item=>(item.volumeInfo?.industryIdentifiers||[]).some(id=>isbnClean(id.identifier)===isbn));
  const url=match?.volumeInfo?.imageLinks?.thumbnail||match?.volumeInfo?.imageLinks?.smallThumbnail||'';
  return url.replace(/^http:/,'https:');
 }catch(e){}
 return '';
}
async function applyCatalogResult(data,isbn,source){
 const f=$('form').elements;
 if(f.namedItem('title').value.trim()&&!confirm('Vorhandenen Titel ersetzen?'))return false;
 f.namedItem('title').value=cleanBookTitle(data.title);
 if(data.author)f.namedItem('author').value=cleanAuthor(data.author);
 if(data.series)f.namedItem('series').value=decodeCatalogText(data.series);
 if(data.volume)f.namedItem('volume').value=data.volume;
 if(data.price)f.namedItem('price').value=String(data.price).replace('.',',');
 if(isbn){f.namedItem('isbn').value=isbn;$('lookup-isbn').value=isbn}
 if(data.cover&&!currentCover){currentCover=data.cover;updateCoverPreview()}
 lookupMessage('✓ Buchdaten übernommen über '+source+'. Cover wird geprüft …');
 if(!currentCover&&isbn){
  const cover=await findCoverByISBN(isbn);
  if(cover){currentCover=cover;updateCoverPreview()}
 }
 lookupMessage('✓ Buchdaten übernommen über '+source+(currentCover?' (mit Cover).':'. Kein Online-Cover gefunden; eigenes Foto möglich.')+' Bitte prüfen und speichern.');
 return true;
}

async function fetchJson(url){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),14000);
 try{const r=await fetch(url,{signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}
 finally{clearTimeout(timeout)}
}
function parseOL(b){
 if(!b?.title)return null;
 return {title:b.title,author:(b.authors||[]).map(a=>typeof a==='string'?a:a.name).filter(Boolean).join(', '),cover:b.cover?.large||b.cover?.medium||b.cover?.small||''};
}
// Every provider is optional. An unavailable catalog must never prevent saving.
async function findBook(){
 const f=$('form').elements;
 const raw=$('lookup-isbn').value.trim()||f.namedItem('isbn').value.trim();
 const isbn=isbnClean(raw),isIsbn=validISBN(isbn);
 if(!isIsbn&&raw.length<3){lookupMessage('Bitte eine gültige ISBN oder einen Buchtitel eingeben.');return}
 if(isIsbn){$('lookup-isbn').value=isbn;f.namedItem('isbn').value=isbn}
 $('lookup').disabled=true;
 lookupMessage('Buchdaten werden über Thalia/Hugendubel gesucht …');
 const q=encodeURIComponent(isIsbn?isbn:raw);
 const workerUrl='https://meine-buecher-suche.brittafothke.workers.dev';
 if(workerUrl && isIsbn){
  try{
   const data=await fetchJson(workerUrl.replace(/\/$/,'')+'/?isbn='+encodeURIComponent(isbn));
   if(data?.found===true && data?.title){
    await applyCatalogResult(data,isbn,data.source||'Buchkatalog');
    $('lookup').disabled=false;return;
   }
  }catch(e){lookupMessage('Buchhandelsdienst: '+e.message+'. Weitere Kataloge werden versucht …')}
 }
 const tasks=[
  ['Open Library ISBN',`https://openlibrary.org/isbn/${q}.json`,'olisbn'],
  ['Open Library Books',`https://openlibrary.org/api/books?bibkeys=ISBN:${q}&format=json&jscmd=data`,'olbooks'],
  ['Google Books',`https://www.googleapis.com/books/v1/volumes?q=${isIsbn?'isbn:':''}${q}&maxResults=10&printType=books`,'google'],
  ['Deutsche Bibliotheken',`https://lobid.org/resources/search?q=${encodeURIComponent(isIsbn?'isbn:'+isbn:raw)}&format=json&size=10`,'lobid'],
  ['Open Library Volltext',`https://openlibrary.org/search.json?q=${q}&limit=25`,'open'],
  ['Open Library',isIsbn?`https://openlibrary.org/search.json?isbn=${q}&limit=10`:`https://openlibrary.org/search.json?title=${q}&limit=10`,'open'],
 ];
 if(isIsbn)tasks.push(['Inventaire',`https://inventaire.io/api/entities?action=by-uris&uris=${encodeURIComponent('isbn:'+isbn)}`,'inventaire']);
 let found=null,errors=[],completed=0;
 const jobs=tasks.filter(x=>isIsbn||!['olisbn','olbooks'].includes(x[2])).map(async ([name,url,type])=>{
  try{
   const j=await fetchJson(url);let info=null;
   if(type==='olisbn' && isIsbn && j?.title){
    info={title:j.title,author:'',cover:`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`,isbn,source:name};
    if(j.authors?.length){try{const names=await Promise.all(j.authors.slice(0,4).map(a=>fetchJson('https://openlibrary.org'+a.key+'.json').then(x=>x.name).catch(()=>'')));info.author=names.filter(Boolean).join(', ')}catch(e){}}
   }
   if(type==='olbooks' && isIsbn){const b=j['ISBN:'+isbn];if(b?.title)info={...parseOL(b),isbn,source:name};}
   if(type==='google'){
    const items=j.items||[];
    const v=(items.find(x=>(x.volumeInfo?.industryIdentifiers||[]).some(i=>isbnClean(i.identifier)===isbn))||items[0])?.volumeInfo;
    if(v?.title)info={title:v.title,author:(v.authors||[]).join(', '),cover:v.imageLinks?.thumbnail?.replace(/^http:/,'https:')||'',isbn:isIsbn?isbn:'',source:name};
   }
   if(type==='lobid'){
    const items=j.member||[];
    const hit=items.find(x=>{
     const ids=JSON.stringify(x.isbn||x.identifiedBy||[]);
     return x.title&&(!isIsbn||ids.includes(isbn));
    });
    if(hit){
     const title=typeof hit.title==='string'?hit.title:Array.isArray(hit.title)?hit.title[0]:hit.title?.label||'';
     const authors=(hit.contribution||[]).flatMap(c=>{
      const a=c.agent||[];return (Array.isArray(a)?a:[a]).map(x=>typeof x==='string'?x:x.label||x.name||'');
     }).filter(Boolean);
     if(title)info={title,author:authors.join(', '),cover:'',isbn:isIsbn?isbn:'',source:name};
    }
   }
   if(type==='open'){
    const b=(j.docs||[]).find(x=>x.title&&(!isIsbn||(x.isbn||[]).some(id=>isbnClean(id)===isbn)));
    if(b)info={title:b.title,author:(b.author_name||[]).join(', '),cover:b.cover_i?`https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`:'',isbn:isIsbn?isbn:'',source:name};
   }
   if(type==='inventaire'){
    const entity=Object.values(j.entities||{})[0];
    const claims=entity?.claims||{};
    const title=claims['wdt:P1476']?.[0]||entity?.label||'';
    if(typeof title==='string'&&title)info={title,author:'',cover:'',isbn,source:name};
   }
   return info;
  }catch(e){errors.push(name+': '+(e.message||e));return null}
  finally{completed++}
 });
 try{
  const results=await Promise.all(jobs);
  found=results.find(x=>x?.title)||null;
  if(!found){lookupMessage('Kein Treffer bei den angeschlossenen Buchquellen.  Die ISBN ist übernommen. Titel und Autor können manuell ergänzt werden. '+(errors.length?'Nicht erreichbar: '+errors.join(' | '):''));return}
  await applyCatalogResult(found,isIsbn?isbn:'',found.source);
 }catch(e){lookupMessage('Buchsuche fehlgeschlagen: '+(e.message||e)+'. Die ISBN bleibt gespeichert.');}
 finally{$('lookup').disabled=false}
}
$('lookup').onclick=findBook;
$('lookup-isbn').addEventListener('input',e=>{const v=e.target.value.trim();if(validISBN(isbnClean(v)))$('form').elements.namedItem('isbn').value=isbnClean(v)});
$('lookup-isbn').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findBook()}});
let htmlScanner=null;
async function stopScanner(){
 scanLoop=false;
 if(htmlScanner){const scanner=htmlScanner;htmlScanner=null;try{await scanner.stop()}catch{}try{await scanner.clear()}catch{}}
 $('scan-controls').classList.remove('active');
}
$('stop-scan').onclick=()=>{stopScanner()};
function loadHtmlScanner(){
 if(window.Html5Qrcode)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
  script.onload=()=>window.Html5Qrcode?resolve():reject(Error('Scanner-Bibliothek fehlt'));
  script.onerror=()=>reject(Error('Scanner-Bibliothek nicht erreichbar'));
  document.head.appendChild(script);
 });
}
async function startScanner(){
 await stopScanner();scanLoop=true;$('scan-controls').classList.add('active');
 lookupMessage('Scanner wird gestartet …');
 try{
  await loadHtmlScanner();if(!scanLoop)return;
  const formats=[window.Html5QrcodeSupportedFormats.EAN_13];
  const scanner=new Html5Qrcode('scan-reader',{formatsToSupport:formats,verbose:false});
  htmlScanner=scanner;
  await scanner.start({facingMode:'environment'}, {fps:12,qrbox:(w,h)=>({width:Math.max(160,Math.min(w-24,320)),height:Math.max(90,Math.min(h-24,160))})},decoded=>{
   const isbn=isbnClean(decoded);if(validISBN(isbn))onScanned(isbn);
  },()=>{});
  if(scanLoop)lookupMessage('Kamera aktiv – den gesamten Strichcode im Rahmen halten.');
 }catch(e){await stopScanner();lookupMessage('Scannerfehler: '+(e.message||e)+'. ISBN kann weiterhin eingetippt werden.')}
}
function onScanned(isbn){$('lookup-isbn').value=isbn;$('form').elements.namedItem('isbn').value=isbn;stopScanner();lookupMessage('ISBN erkannt: '+isbn+'. Suche läuft …');findBook()}
$('start-scan').onclick=()=>{startScanner()};
$('google-search').onclick=()=>{
 const query=$('lookup-isbn').value.trim()||$('form').elements.namedItem('isbn').value.trim();
 if(!query){lookupMessage('Bitte zuerst eine ISBN oder einen Titel eingeben.');return}
 window.open('https://www.google.com/search?q='+encodeURIComponent(query+' Buch'),'_blank','noopener,noreferrer');
};
// Cover image: downscale locally to limit browser storage use. No image upload.
function updateCoverPreview(){const im=$('cover-preview');im.style.display=currentCover?'block':'none';if(currentCover)im.src=currentCover;else im.removeAttribute('src');}
$('cover-remove').onclick=()=>{currentCover='';$('cover-file').value='';updateCoverPreview();$('cover-status').textContent='Cover entfernt (erst mit „Speichern“ übernehmen).'};
$('cover-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){$('cover-status').textContent='Bitte ein Bild auswählen.';return;}try{const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src});const max=500,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);currentCover=c.toDataURL('image/jpeg',0.67);updateCoverPreview();$('cover-status').textContent='✓ Coverfoto übernommen. Bitte Buch unten speichern.';}catch(err){$('cover-status').textContent='Foto konnte nicht verarbeitet werden. Bitte ein anderes Bild versuchen.';}});
