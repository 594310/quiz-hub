/* hubkit.js — 結果圖片匯出 / 匯入（資料藏在 PNG 的 tEXt 區塊，完全在瀏覽器內處理）*/
(function(){
  const KEY='hubdata';
  const crcT=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
  function crc32(buf){let c=0xFFFFFFFF;for(let i=0;i<buf.length;i++)c=crcT[(c^buf[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
  function u32(n){return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]}
  const enc=s=>Uint8Array.from(unescape(encodeURIComponent(s)),c=>c.charCodeAt(0));

  function allData(){
    const o={};
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('hub.'))o[k]=JSON.parse(localStorage.getItem(k))}}catch(e){}
    return o;
  }
  function toBase64(str){return btoa(unescape(encodeURIComponent(str)))}
  function fromBase64(b){return decodeURIComponent(escape(atob(b)))}

  // 把資料塞進 PNG
  async function embed(canvas){
    const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
    const buf=new Uint8Array(await blob.arrayBuffer());
    const data=enc(KEY+'\0'+toBase64(JSON.stringify({v:1,t:Date.now(),data:allData()})));
    const type=[0x74,0x45,0x58,0x74]; // tEXt
    const body=new Uint8Array(4+data.length); body.set(type); body.set(data,4);
    const chunk=new Uint8Array(12+data.length);
    chunk.set(u32(data.length),0); chunk.set(body,4); chunk.set(u32(crc32(body)),8+data.length);
    const cut=buf.length-12; // IEND 之前
    const out=new Uint8Array(buf.length+chunk.length);
    out.set(buf.subarray(0,cut),0); out.set(chunk,cut); out.set(buf.subarray(cut),cut+chunk.length);
    return new Blob([out],{type:'image/png'});
  }
  async function download(canvas,filename){
    const b=await embed(canvas), a=document.createElement('a');
    a.href=URL.createObjectURL(b); a.download=filename||'結果圖片.png'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  }
  // 從 PNG 讀出資料
  async function read(file){
    const buf=new Uint8Array(await file.arrayBuffer());
    if(buf[0]!==0x89||buf[1]!==0x50) throw new Error('請選擇本站匯出的 PNG 圖片');
    let p=8;
    while(p<buf.length){
      const len=(buf[p]<<24|buf[p+1]<<16|buf[p+2]<<8|buf[p+3])>>>0, type=String.fromCharCode(...buf.subarray(p+4,p+8));
      if(type==='tEXt'){
        const s=String.fromCharCode(...buf.subarray(p+8,p+8+len)), i=s.indexOf('\0');
        if(s.slice(0,i)===KEY) return JSON.parse(fromBase64(s.slice(i+1)));
      }
      if(type==='IEND') break;
      p+=12+len;
    }
    throw new Error('這張圖片裡沒有備份資料。常見原因：圖片被 LINE、Messenger 等壓縮過，請用「原圖／檔案」方式傳送。');
  }
  async function importFile(file){
    const o=await read(file); let n=0;
    Object.keys(o.data||{}).forEach(k=>{if(k.startsWith('hub.')){localStorage.setItem(k,JSON.stringify(o.data[k]));n++}});
    return n;
  }

  // 畫圖小工具
  function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
  function svgToImg(svg){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)})}
  const FONT='"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';
  window.HubKit={download,importFile,rr,svgToImg,FONT,allData};
})();
