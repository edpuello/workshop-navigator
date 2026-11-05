// Shared part rules — copied exactly from the Checklist (index.html) so both pages count and search the same way.
// tests/parity checks that the Workshop page and the Checklist always show the same numbers. Needs: WN (sync.js).
// Functions that read the whole list take the items array; the Checklist's versions read its `data` variable.
const STOCK_LABEL={plenty:'Plenty',low:'Low',out:'Out'};
function qtyNum(x){return x.qty===''||x.qty==null||isNaN(Number(x.qty))?null:Number(x.qty)}
const RODLIKE=x=>/threaded rod/i.test(x.category||'');
function defaultLowAt(x){return RODLIKE(x)?1:10}
function lowAt(x){const v=x.lowAt;return v===''||v==null||isNaN(Number(v))?defaultLowAt(x):Number(v)}
function qtyLevel(x){const q=qtyNum(x);if(q==null)return '';const full=Math.max(Number(x.full)||0,q);
 if(q<lowAt(x))return 'low';if(q<full/2||(RODLIKE(x)&&q<full))return 'half';return 'ok'}
function qtyClass(x){const l=qtyLevel(x);return l?'q-'+l:''}
function countLevel(x){const q=qtyNum(x);if(q==null)return '';if(q===0)return 'out';return qtyLevel(x)==='low'?'low':'plenty'}
function stockLevel(x){return STOCK_LABEL[x.stock]?x.stock:countLevel(x)}
function itemStatus(x){return x.archived?'archived':x.store?'instock':x.need?'tobuy':x.buy?'putaway':'unmarked'}
function isLow(x){return !!x.store&&['low','out'].includes(stockLevel(x))}
const FILTER_ALIAS={need:'tobuy',owned:'instock',unstored:'unmarked'};
function matchFilter(x,f){f=FILTER_ALIAS[f]||f;if(f==='archived')return !!x.archived;if(x.archived)return false;return f==='all'||(f==='low'?isLow(x):f==='tobuy'?!!x.need:itemStatus(x)===f)}
const normS=v=>String(v??'').toLowerCase().replace(/[×✕]/g,'x').replace(/[“”″]/g,'"').replace(/\s+/g,' ');
const NUMT=/^[#m]?[0-9][0-9.\/]*$/;const reCache=new Map();
function termRe(t){let r=reCache.get(t);if(!r){r=new RegExp('(^|[^0-9./])'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![0-9./])');reCache.set(t,r)}return r}
function searchTerms(raw){return normS(raw).trim().split(' ').filter(t=>t&&t!=='x'&&t!=='×')}
function matchesSearch(x,terms){if(!terms.length)return true;const hay=normS([x.id,x.name,x.category,x.location,x.notes,STOCK_LABEL[stockLevel(x)]||''].join(' '));return terms.every(t=>NUMT.test(t)?termRe(t).test(hay):hay.includes(t))}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const SIZE_WORDS={'extra-small':.5,'x-small':.5,xs:.5,mini:.6,small:1,short:1,light:1,'light-duty':1,medium:2,'medium-duty':2,regular:2,standard:2,large:3,long:3,heavy:3,'heavy-duty':3,'x-large':4,xl:4,'extra-large':4};
const SIZE_RE=/#\s?(\d+)|\bm(\d+(?:\.\d+)?)\b|(\d+)-(\d+)\/(\d+)|(\d+)\/(\d+)|(\d+(?:\.\d+)?)/gi;
function sizeKey(name){const out=[],str=String(name||'').toLowerCase().replace(/#\s?(\d+)\s*\/\s*#\s?\d+/g,'#$1');str.replace(SIZE_RE,(m,g,mm,w,n,d,n2,d2,num)=>{out.push(g!=null?.06+.013*(+g):mm!=null?+mm:w!=null?+w+n/d:n2!=null?n2/d2:+num);return m});
 for(const w of str.split(/[^a-z-]+/))if(w in SIZE_WORDS){out.push(SIZE_WORDS[w]);break}return out}
function familyKey(name){return String(name||'').toLowerCase().replace(SIZE_RE,' ').replace(/[×✕"”″'’—–\-\/#.,()]/g,' ').split(/\s+/).filter(w=>w&&w!=='x'&&w!=='in'&&w!=='inch'&&w!=='mm'&&w!=='duty'&&!(w in SIZE_WORDS)).join(' ')}
function cmpSize(a,b){const ka=sizeKey(a.name),kb=sizeKey(b.name);if(!ka.length||!kb.length)return (kb.length-ka.length)||a.name.localeCompare(b.name);for(let i=0;i<Math.max(ka.length,kb.length);i++){const x=ka[i],y=kb[i];if(x==null)return -1;if(y==null)return 1;if(x!==y)return x-y}return a.name.localeCompare(b.name,undefined,{numeric:true})}
function orderIndex(items){const m=new Map();(items||WN.doc.items).forEach((x,i)=>m.set(x.id,i));return m}
function effOrder(x,idx){return typeof x.order==='number'?x.order:(idx.get(x.id)??0)*10}
function sortCat(list,idx){return list.slice().sort((a,b)=>effOrder(a,idx)-effOrder(b,idx)||(idx.get(a.id)-idx.get(b.id)))}
