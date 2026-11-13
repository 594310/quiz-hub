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


  // 語音輸入（使用瀏覽器內建的語音辨識；不支援時會提示）
  function voice(targetId,btnId,statusId){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const btn=document.getElementById(btnId), ta=document.getElementById(targetId), st=document.getElementById(statusId);
    if(!btn||!ta) return;
    const IDLE='🎤 語音輸入';
    if(!SR){ btn.onclick=()=>{ if(st) st.textContent='這個瀏覽器不支援語音輸入。可以改用手機鍵盤上的麥克風按鈕，或換用 Chrome、Safari。' }; return }
    let rec=null,on=false,base='',err='';
    btn.onclick=()=>{
      if(on){ try{rec.stop()}catch(e){} return }
      rec=new SR(); rec.lang='zh-TW'; rec.interimResults=true; rec.continuous=false; rec.maxAlternatives=1; err='';
      base=ta.value?ta.value.replace(/\s+$/,'')+' ':'';
      rec.onstart=()=>{on=true;btn.classList.add('rec');btn.textContent='⏹ 停止（聆聽中…）';if(st)st.textContent='請開始說話…'};
      rec.onresult=e=>{let txt='';for(let i=0;i<e.results.length;i++)txt+=e.results[i][0].transcript;const max=ta.maxLength>0?ta.maxLength:1000;ta.value=(base+txt).slice(0,max);ta.dispatchEvent(new Event('input',{bubbles:true}))};
      rec.onerror=e=>{err=e.error==='not-allowed'||e.error==='service-not-allowed'?'沒有麥克風權限，請在瀏覽器網址列允許使用麥克風。':e.error==='no-speech'?'沒有聽到聲音，請再按一次再說話。':e.error==='network'?'語音辨識需要網路連線。':e.error==='aborted'?'':'語音輸入失敗（'+e.error+'），可以改用鍵盤輸入。';if(st)st.textContent=err};
      rec.onend=()=>{on=false;btn.classList.remove('rec');btn.textContent=IDLE;if(st&&!err)st.textContent=ta.value?'已輸入，可以再按一次補充，或直接修改文字。':''};
      try{rec.start()}catch(e){if(st)st.textContent='無法啟動語音輸入，請稍後再試。'}
    };
  }
  // 畫圖小工具
  function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
  function svgToImg(svg){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)})}
  const FONT='"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';
  window.HubKit={download,importFile,rr,svgToImg,FONT,allData,voice};
})();
