'use strict';
const KEY='meine-buecher-v1';let books=[];let editing=null;let currentCover='';
let scanReader=null,scanStream=null,scanLoop=false;
const $=id=>document.getElementById(id);
function load(){try{let v=JSON.parse(localStorage.getItem(KEY)||'[]');books=Array.isArray(v)?v:[]}catch(e){alert('Gespeicherte Daten konnten nicht gelesen werden. Bitte keine neuen Einträge speichern, bevor du deine Sicherung geprüft hast.');books=[]}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(books))}catch(e){alert('Speichern fehlgeschlagen. Bitte Speicherplatz prüfen und eine Sicherung exportieren.');return false}return true}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
function render(){ $('total').textContent=books.length;$('read').textContent=books.filter(b=>b.status==='read').length;$('unread').textContent=books.filter(b=>b.status!=='read').length;let q=$('search').value.toLocaleLowerCase('de').trim(),f=$('filter').value;let list=books.filter(b=>(f==='all'||(f==='read'?b.status==='read':b.status!=='read'))&&[b.title,b.author,b.isbn,b.series,b.notes].some(x=>String(x||'').toLocaleLowerCase('de').includes(q)));const sort=$('sort').value;if(sort==='title')list.sort((a,b)=>a.title.localeCompare(b.title,'de'));if(sort==='author')list.sort((a,b)=>(a.author||'').localeCompare(b.author||'','de'));if(sort==='new')list.sort((a,b)=>(b.created||0)-(a.created||0));const root=$('books');root.replaceChildren();if(!list.length){const empty=node('div','',books.length?'Keine passenden Bücher gefunden.':'Noch keine Bücher eingetragen. Tippe auf „＋ Buch“.');empty.id='empty';root.append(empty);return}for(const b of list){let card=node('article','book');if(b.cover){const img=node('img','book-cover');img.src=b.cover;img.alt='Cover: '+b.title;img.loading='lazy';card.append(img);card.style.display='flow-root';img.style.float='left';img.style.marginRight='13px'}card.append(node('h3','',b.title),node('p','',b.author||'Autor nicht eingetragen'));let bottom=node('div','bottom');bottom.append(node('span','pill '+(b.status==='read'?'read':''),b.status==='read'?'✓ Gelesen':'○ Ungelesen'),node('span','stars',b.rating?'★'.repeat(+b.rating)+'☆'.repeat(5-(+b.rating)):''));card.append(bottom);if(b.series||b.volume||b.loan||b.notes){let details=node('p','muted',[b.series&&('Reihe: '+b.series+(b.volume?' · Band '+b.volume:'')),b.loan&&'Verliehen an: '+b.loan,b.notes].filter(Boolean).join(' · '));details.style.whiteSpace='pre-wrap';card.append(details)}let edit=node('button','secondary','Bearbeiten');edit.style.marginTop='12px';edit.addEventListener('click',()=>openEditor(b.id));card.append(edit);root.append(card)}}
function openEditor(id=null){editing=id;const b=books.find(x=>x.id===id);$('form').reset();$('formtitle').textContent=b?'Buch bearbeiten':'Buch hinzufügen';for(const k of ['title','author','isbn','price','status','rating','date','series','volume','loan','notes']){const input=$('form').elements.namedItem(k);input.value=b?(b[k]??(k==='status'?'unread':k==='rating'?'0':'')):(k==='status'?'unread':k==='rating'?'0':'')}currentCover=b?.cover||'';updateCoverPreview();$('cover-file').value='';$('cover-status').textContent='';$('lookup-isbn').value=b?.isbn||'';$('lookup-status').textContent='';stopScanner();$('editor').showModal()}
$('add').onclick=()=>openEditor();$('cancel').onclick=()=>{stopScanner();$('editor').close()};$('editor').addEventListener('close',stopScanner);$('form').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.target),data={};for(const [k,v] of fd.entries())data[k]=String(v).trim();if(!data.title)return;data.rating=Number(data.rating)||0;const old=books.find(b=>b.id===editing);const next={...data,cover:currentCover,id:old?.id||((globalThis.crypto?.randomUUID?.())||String(Date.now())+'-'+Math.random()),created:old?.created||Date.now()};const before=books;books=old?books.map(b=>b.id===editing?next:b):[...books,next];if(save()){$('editor').close();render()}else books=before});
$('search').oninput=render;$('filter').onchange=render;$('sort').onchange=render;
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({format:'meine-buecher',version:1,exportedAt:new Date().toISOString(),books},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='meine-buecher-sicherung-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)};
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const v=JSON.parse(await file.text());if(v.format!=='meine-buecher'||!Array.isArray(v.books)||!v.books.every(b=>b&&typeof b.title==='string'&&typeof b.id==='string'))throw Error('Ungültige Sicherungsdatei');if(!confirm('Die aktuelle Bücherliste wird durch '+v.books.length+' Bücher aus der Sicherung ersetzt. Fortfahren?'))return;const previous=books;books=v.books;if(save())render();else books=previous}catch(err){alert('Import nicht möglich: '+err.message)}finally{e.target.value=''}};
load();render();if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});


// ISBN lookup and camera barcode scanning. No book data leaves the browser except ISBN queries to public catalogs.
const isbnClean=x=>String(x||'').replace(/[^0-9Xx]/g,'').toUpperCase();
function validISBN(x){if(x.length===13)return /^\d{13}$/.test(x)&&[...x].reduce((a,c,i)=>a+Number(c)*(i%2?3:1),0)%10===0;if(x.length===10){if(!/^\d{9}[\dX]$/.test(x))return false;return [...x].reduce((a,c,i)=>a+(10-i)*(c==='X'?10:Number(c)),0)%11===0}return false}
function lookupMessage(t){$('lookup-status').textContent=t}
async function fetchJson(url){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),9000);
 try{const r=await fetch(url,{signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}
 finally{clearTimeout(timeout)}
}
function parseOL(b){
 if(!b?.title)return null;
 return {title:b.title,author:(b.authors||[]).map(a=>typeof a==='string'?a:a.name).filter(Boolean).join(', '),cover:b.cover?.large||b.cover?.medium||b.cover?.small||''};
}
async function findBook(){
 const raw=$('lookup-isbn').value.trim()||$('form').elements.namedItem('isbn').value.trim();
 const isbn=isbnClean(raw),isIsbn=validISBN(isbn);
 if(!isIsbn&&raw.length<3){lookupMessage('Bitte eine gültige ISBN oder einen Buchtitel eingeben.');return}
 if(isIsbn){$('lookup-isbn').value=isbn;$('form').elements.namedItem('isbn').value=isbn}
 $('lookup').disabled=true;lookupMessage('Buchdaten werden gesucht …');
 let info=null,reachable=0,errors=[];
 const sources=isIsbn?[
  ['lobid Deutsche Bibliotheken',`https://lobid.org/resources/search?q=${encodeURIComponent('isbn:'+isbn)}&format=json&size=5`,'lobid'],
  ['Open Library Bücher',`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`,'book'],
  ['Open Library Suche',`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=5`,'search'],
  ['Open Library Ausgabe',`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`,'edition']
 ]:[['lobid Deutsche Bibliotheken',`https://lobid.org/resources/search?q=${encodeURIComponent(raw)}&format=json&size=5`,'lobid'],['Open Library Titelsuche',`https://openlibrary.org/search.json?title=${encodeURIComponent(raw)}&limit=10`,'search']];
 try{
  for(const [name,url,type] of sources){if(info?.title)break;
   try{const j=await fetchJson(url);reachable++;
    if(type==='lobid'){
      const hit=(j.member||[]).find(x=>x.title);
      if(hit){const title=typeof hit.title==='string'?hit.title:(hit.title?.[0]||'');
       const contributions=hit.contribution||[];
       const authors=contributions.flatMap(c=>(c.agent||[]).map(a=>a.label||a.name||'')).filter(Boolean);
       info={title,author:authors.join(', '),cover:'',isbn:isIsbn?isbn:''};
      }
    }
    if(type==='book'){const b=j['ISBN:'+isbn];if(b?.title)info={title:b.title,author:(b.authors||[]).map(a=>a.name).filter(Boolean).join(', '),cover:b.cover?.medium||'',isbn}}
    if(type==='search'){const b=j.docs?.find(x=>x.title);if(b)info={title:b.title,author:(b.author_name||[]).join(', '),cover:b.cover_i?`https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`:'',isbn:isIsbn?isbn:(b.isbn||[]).find(validISBN)||''}}
    if(type==='edition'&&j.title){let author='';if(j.authors?.length){try{const a=await fetchJson('https://openlibrary.org'+j.authors[0].key+'.json');author=a.name||''}catch{}}info={title:j.title,author,cover:j.covers?.[0]?`https://covers.openlibrary.org/b/id/${j.covers[0]}-M.jpg`:'',isbn}}
   }catch(e){errors.push(name+': '+(e.message||'Verbindungsfehler'))}
  }
  if(!info){lookupMessage(reachable?'In den abgefragten Buchkatalogen keine passenden Buchdaten gefunden. Die ISBN kann trotzdem gespeichert werden.':'Buchkatalog derzeit nicht erreichbar: '+errors.join('; '));return}
  const f=$('form').elements;
  if(f.namedItem('title').value.trim()&&!confirm('Vorhandenen Titel ersetzen?'))return;
  f.namedItem('title').value=info.title;
  f.namedItem('author').value=info.author||'';
  if(info.isbn){f.namedItem('isbn').value=info.isbn;$('lookup-isbn').value=info.isbn}
  if(info.series&&!f.namedItem('series').value)f.namedItem('series').value=info.series;
  if(info.cover&&!currentCover){currentCover=info.cover.replace(/^http:/,'https:');updateCoverPreview()}
  lookupMessage('✓ Buch gefunden: '+info.title+'. Bitte Angaben prüfen und unten speichern.');
 }finally{$('lookup').disabled=false}
}
$('lookup').onclick=findBook;
$('lookup-isbn').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findBook()}});
let scanControls=null,scanTimer=null,scanBusy=false;
function stopScanner(){
 scanLoop=false;if(scanTimer){clearTimeout(scanTimer);scanTimer=null}
 if(scanControls){try{scanControls.stop()}catch{}scanControls=null}
 if(scanReader){try{scanReader.reset?.()}catch{}scanReader=null}
 if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null}
 const v=$('scan-video');if(v){try{v.pause()}catch{}if(v.srcObject){v.srcObject.getTracks().forEach(t=>t.stop())}v.srcObject=null}
 $('scan-controls')?.classList.remove('active');
}
$('stop-scan').onclick=stopScanner;
async function startScanner(){
 stopScanner();scanLoop=true;$('scan-controls').classList.add('active');
 lookupMessage('Barcode-Erkennung wird geladen …');
 try{
  await loadScannerLibrary();
  if(!scanLoop)return;
  const ZX=window.ZXing;
  const hints=new Map([[ZX.DecodeHintType.POSSIBLE_FORMATS,[ZX.BarcodeFormat.EAN_13]],[ZX.DecodeHintType.TRY_HARDER,true]]);
  const reader=new ZX.BrowserMultiFormatReader(hints,180);
  scanReader=reader;
  lookupMessage('Scanner bereit. Halte den Strichcode ruhig und vollständig ins Bild.');
  // Use continuous ZXing decoding instead of the native detector that previously
  // returned zero results forever on some devices.
  const controls=await reader.decodeFromVideoDevice(undefined,$('scan-video'),(result,error)=>{
   if(!scanLoop||!result)return;
   const value=isbnClean(result.getText?.()||result.text||'');
   if(validISBN(value))onScanned(value);
  });
  if(controls?.stop)scanControls=controls;
 }catch(e){
  if(!scanLoop)return;
  lookupMessage('Ersatzscanner wird gestartet …');
  try{await startNativeScanner()}
  catch(err){stopScanner();lookupMessage('Scanner konnte nicht gestartet werden: '+(err.message||err)+'. Bitte ISBN eintippen.')}
 }
}
async function startNativeScanner(){
 if(!('BarcodeDetector'in window))throw Error('Barcode-Erkennung im Browser nicht verfügbar');
 const detector=new BarcodeDetector({formats:['ean_13']});
 const video=$('scan-video');
 const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
 if(!scanLoop){stream.getTracks().forEach(t=>t.stop());return}
 scanStream=stream;video.srcObject=stream;await video.play();
 lookupMessage('Ersatzscanner aktiv – Strichcode ruhig ins Bild halten.');
 const loop=async()=>{
  if(!scanLoop)return;
  if(!scanBusy&&video.readyState>=2){
   scanBusy=true;
   try{
    const results=await detector.detect(video);
    for(const r of results){
     const found=isbnClean(r.rawValue);
     if(validISBN(found)){onScanned(found);return}
    }
   }catch(e){stopScanner();lookupMessage('Barcode-Erkennung fehlgeschlagen: '+(e.message||e));return}
   finally{scanBusy=false}
  }
  if(scanLoop)scanTimer=setTimeout(loop,200);
 };
 loop();
}
function loadScannerLibrary(){
 if(window.ZXing?.BrowserMultiFormatReader)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  script.onload=()=>window.ZXing?.BrowserMultiFormatReader?resolve():reject(Error('Bibliothek nicht verfügbar'));
  script.onerror=()=>reject(Error('Scanner-Bibliothek konnte nicht geladen werden'));
  document.head.appendChild(script);
 });
}
function onScanned(isbn){stopScanner();$('lookup-isbn').value=isbn;$('form').elements.namedItem('isbn').value=isbn;lookupMessage('ISBN erkannt: '+isbn+'. Suche Buchdaten …');findBook()}
$('start-scan').onclick=startScanner;

// Cover image: downscale locally to limit browser storage use. No image upload.
function updateCoverPreview(){const im=$('cover-preview');im.style.display=currentCover?'block':'none';if(currentCover)im.src=currentCover;else im.removeAttribute('src');}
$('cover-remove').onclick=()=>{currentCover='';$('cover-file').value='';updateCoverPreview();$('cover-status').textContent='Cover entfernt (erst mit „Speichern“ übernehmen).'};
$('cover-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){$('cover-status').textContent='Bitte ein Bild auswählen.';return;}try{const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src});const max=500,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);currentCover=c.toDataURL('image/jpeg',0.67);updateCoverPreview();$('cover-status').textContent='✓ Coverfoto übernommen. Bitte Buch unten speichern.';}catch(err){$('cover-status').textContent='Foto konnte nicht verarbeitet werden. Bitte ein anderes Bild versuchen.';}});
