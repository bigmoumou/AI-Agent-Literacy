/* Week 9 期中「時空密室」：一個真的 3D 空間（和首頁 Week 9 那一格同一套膠捲畫法：照光、景深、鐘塔的指針）。
   - 空間深處有一道時空裂縫，十幾條失焦的膠捲繞著它旋轉、慢慢被吸進去（漩渦）。課程的主時間線（膠捲上是 Week 1–8 的封面）從左邊流進去。
   - 5 條平行時空從裂縫一律順時針螺旋著轉出來（像雙臂的螺旋星系），一邊轉一邊從深處往前來，最後順著轉出來的方向伸直，
     正面朝向鏡頭：裂縫上方的往右走（在右邊），下方的往左走（在左邊），遠近大小不一。一路同一個方向轉，不會掉頭、反折。
     每條的頭端連著三組的作品格（01–03、04–06、07–09、10–12、13–15，比一般畫格長，約 2:1），最前面是一小段空白的片頭。
     另外一條有鐘塔的膠捲也從裂縫轉出來，往右邊飛出畫面。
   - 膠捲照物理規律彎：真的底片只能往正面、背面彎，不能在自己的平面裡往旁邊彎；所以寬的方向一定垂直於彎曲的方向，
     直的地方慢慢轉向鏡頭，扭轉沿著膠捲平均分散（不會突然翻過去）。滑鼠碰到時起的波也是往正反面晃。
   - 作品還沒交：作品格是還在沖洗的底片（這一組的色調、外框大數字、TEAM nn、PENDING、準備中），點了沒有反應。
   - 開場：裂縫亮起來，主時間線流進去，5 條從裂縫往外長，長過哪一組的作品格，那一格才顯影。
   - 滑鼠：鏡頭跟著平移（近的動得多、遠的動得少）；移到作品格上，那一格往鏡頭浮起、變亮，那條膠捲起一個小波，其他組稍微暗下來。
   - 滑鼠移到作品格上（手機上點一下、鍵盤用 Tab 選到）：那一格浮起來，缺掉的方塊一塊一塊補回來（資料暫時恢復），移開後又慢慢缺回去。
   - 從首頁 Week 9 那一格被吸進來（html.w9-arrive）：一開始鏡頭在主時間線的一格膠捲裡，往外拉出來，看到整個漩渦；頂列和介紹之後才浮出來。
     同一次瀏覽再回來：開場快三倍。
   - 顏色呼應：作品格的淡藍光散到它周圍的霧裡、照在旁邊經過的膠捲上；裂縫外圈也有一道冷藍的光。
   - 減少動態效果：停在完成的畫面。看不到時不畫；最多每秒 30 格，8 秒沒有操作、畫面又沒有在動時降到每秒 15 格；
     裝置像素比最多 1.5，電腦跟不上（每格超過 46 毫秒）時自動降低解析度。
   - 沒有 WebGL2：顯示 index.html 裡一般的 15 格（rooms.css 的樣式）。
   原生 WebGL2，不用函式庫。 */
(function () {
  "use strict";
  const stage = document.getElementById("stage");
  const cv = document.getElementById("w9cv");
  if (!stage || !cv) return;
  const intro = stage.querySelector(".w9-intro");
  const pager = stage.querySelector(".pager");
  const roomEls = Array.from(stage.querySelectorAll(".room"));
  const fallback = () => { document.body.classList.remove("w9-anim", "w9-gl"); document.documentElement.classList.remove("w9-arrive"); roomEls.forEach((r) => r.classList.add("is-on")); window.__w9 = { fallback: true }; };
  const gl = cv.getContext("webgl2", { antialias: true, alpha: false, premultipliedAlpha: true, powerPreference: "high-performance" });
  if (!gl) { fallback(); return; }
  document.body.classList.add("w9-gl");
  const Q = new URLSearchParams(location.search);
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches || Q.get("still") === "1";
  const DEBUG = Q.get("debug") === "1";
  // 從首頁 Week 9 那一格被吸進來（index.html 開頭的小程式看到 home.js 記下的時間，先加上 html.w9-arrive）；同一次瀏覽看過開場了就快一點
  const ARRIVE = !REDUCE && document.documentElement.classList.contains("w9-arrive");
  if (!ARRIVE) document.documentElement.classList.remove("w9-arrive");
  let SEEN = false;
  try { SEEN = sessionStorage.getItem("w9-seen") === "1"; sessionStorage.removeItem("w9-arrive"); } catch (e) { /* 存不了就照第一次的開場 */ }
  const OSP = REDUCE ? 1 : ARRIVE ? 1.15 : SEEN ? 3 : 1;   // 開場的速度
  const ROOT = document.body.dataset.root || "../../";
  const LANG = (window.I18N && window.I18N.lang) || document.documentElement.lang || "zh-Hant";
  const N = roomEls.length;

  /* ---------- 圖集：插畫（首頁同一張 4×4）＋ Week 1–8 的封面（壓進 4:3 的格子，主時間線用 16:9 的畫格顯示，等於還原） ---------- */
  const TW = 300, TH = 225, PAD = 6, SW = TW + 2 * PAD, SH = TH + 2 * PAD;   // 一格 312×237
  const atlasCv = document.createElement("canvas");
  atlasCv.width = 4 * SW; atlasCv.height = 6 * SH;   // 0–15 插畫（9–12 鐘塔、13–15 城堡）、16–23 封面
  const ag = atlasCv.getContext("2d");
  ag.fillStyle = "#18130e"; ag.fillRect(0, 0, atlasCv.width, atlasCv.height);
  const atlasTex = gl.createTexture();
  function texParams() {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const an = gl.getExtension("EXT_texture_filter_anisotropic");
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }
  function uploadAtlas() {
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCv); }
    catch (e) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 32, 24, 255])); }   // 用 file:// 開：圖片不能進 WebGL，膠捲照畫、畫格是素的
    texParams();
  }
  uploadAtlas();
  let pending = 2;
  const loaded = () => { uploadAtlas(); wake(); if (--pending <= 0) ready(); };
  const frames = new Image();
  frames.decoding = "async";
  frames.onload = () => { ag.drawImage(frames, 0, 0, 4 * SW, 4 * SH); loaded(); };   // week9-frames.webp 本身就是 4×4、每格 312×237
  frames.onerror = loaded;
  frames.src = ROOT + "assets/week9-frames.webp";
  (function thumbs() {
    const W8 = window.WEEKS || {}, list = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => W8[n] && W8[n].thumb);
    let left = list.filter(Boolean).length;
    if (!left) { loaded(); return; }
    list.forEach((src, i) => {
      if (!src) return;
      const im = new Image(); im.decoding = "async";
      im.onload = im.onerror = () => {
        if (im.naturalWidth) { const x = (i % 4) * SW, y = (4 + (i >> 2)) * SH; ag.drawImage(im, x, y, SW, SH); ag.drawImage(im, x + PAD, y + PAD, TW, TH); }
        if (--left === 0) loaded();
      };
      im.src = ROOT + src;
    });
  })();

  /* ---------- 作品格的畫面（膠捲上那一長格裡面的圖）：15 組統一淡藍色，有「資訊缺失」的像素感 ----------
     貼圖的三個顏色通道各放一層：R＝大數字（實心，著色器把它變成一格一格的方塊、有些方塊缺掉）、G＝小字（TEAM nn、PENDING、準備中，保持清楚）、
     B＝底的明暗（中間亮、四周暗）。真正的顏色在著色器裡上。 */
  const PW = 512, PH = 256, PI = 6, portalCv = document.createElement("canvas");   // 一組一格 512×256，四周留 6 像素（縮小時不會滲到隔壁）
  portalCv.width = 4 * PW; portalCv.height = 4 * PH;
  const portalTex = gl.createTexture();
  function soonText(li) {
    const el = li.querySelector(".room-soon"); if (!el) return "";
    const d = el.dataset;
    return (LANG === "en" ? d.en : LANG === "zh-Hans" ? d.zhHans : LANG === "vi" ? d.vi : "") || el.textContent;
  }
  // 5×7 的像素數字（0 中間不畫斜線或點，方塊少的時候才不會看錯）
  const DIGITS = [
    ["01110", "10001", "10001", "10001", "10001", "10001", "01110"], ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    ["01110", "10001", "00001", "00010", "00100", "01000", "11111"], ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    ["00010", "00110", "01010", "10010", "11111", "00010", "00010"], ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    ["00110", "01000", "10000", "11110", "10001", "10001", "01110"], ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    ["01110", "10001", "10001", "01110", "10001", "10001", "01110"], ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ];
  function drawPortals() {
    const g = portalCv.getContext("2d"), MONO = '"JetBrains Mono", "Cascadia Mono", Consolas, monospace', SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
    const spaced = (on) => { if ("letterSpacing" in g) g.letterSpacing = on ? "2px" : "0px"; };
    g.globalCompositeOperation = "source-over"; g.fillStyle = "#000"; g.fillRect(0, 0, portalCv.width, portalCv.height);
    roomEls.forEach((li, i) => {
      const ox = (i % 4) * PW, oy = (i >> 2) * PH, n = String(i + 1).padStart(2, "0");
      const x = PI, y = PI, w = PW - 2 * PI, h = PH - 2 * PI;
      g.save(); g.translate(ox, oy); g.globalCompositeOperation = "lighter";   // 三層用加的，各自留在自己的通道
      const gr = g.createRadialGradient(x + w * 0.5, y + h * 0.48, 4, x + w * 0.5, y + h * 0.48, w * 0.6);
      gr.addColorStop(0, "rgb(0,0,255)"); gr.addColorStop(0.7, "rgb(0,0,110)"); gr.addColorStop(1, "rgb(0,0,40)");
      g.fillStyle = gr; g.fillRect(x, y, w, h);   // B：底的明暗
      // R：大數字，用 5×7 的像素字，每一點剛好對齊著色器的一格方塊（30×15），兩個字中間空一格，置中
      g.fillStyle = "rgb(255,0,0)";
      const cw = w / 30, ch = h / 15, c0 = 10, r0 = 4;
      [...n].forEach((dg, q) => DIGITS[+dg].forEach((row, ry) => [...row].forEach((bit, rx) => { if (bit === "1") g.fillRect(x + (c0 + q * 6 + rx) * cw, y + (r0 + ry) * ch, cw, ch); })));
      g.fillStyle = "rgb(0,255,0)"; g.textBaseline = "alphabetic";   // G：小字
      g.textAlign = "left"; g.font = `700 20px ${MONO}`; spaced(true); g.fillText(`TEAM ${n}`, x + 20, y + 34);
      g.textAlign = "right"; g.font = `700 15px ${MONO}`; g.globalAlpha = 0.6; g.fillText("PENDING", x + w - 20, y + 33); g.globalAlpha = 1; spaced(false);
      g.textAlign = "left"; g.font = `700 30px ${SANS}`; g.fillText(soonText(li), x + 20, y + h - 20);
      g.restore();
    });
    gl.bindTexture(gl.TEXTURE_2D, portalTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, portalCv);
    texParams();
  }
  drawPortals();
  if (document.fonts) Promise.all([document.fonts.load('700 20px "JetBrains Mono"'), document.fonts.load('700 30px "Noto Sans TC"', soonText(roomEls[0]) || "準備中")]).then(() => { drawPortals(); wake(); }).catch(() => {});

  /* ---------- 著色器 ---------- */
  const VS = `#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aInfo; layout(location=3) in vec4 aExt; layout(location=4) in vec4 aTeam; layout(location=5) in float aCool;
  uniform mat4 uVP; out vec2 vUv; out vec4 vInfo; out vec4 vExt; out vec4 vTeam; out float vCool;
  void main(){ vUv=aUv; vInfo=aInfo; vExt=aExt; vTeam=aTeam; vCool=aCool; gl_Position=uVP*vec4(aPos,1.0); }`;
  // aCool：作品格的淡藍光照到這一點有多少（離頭端越近越多）
  // aInfo：種子、亮度（負的＝看到背面）、透明度、一格的長寬比；aExt：反光、霧、失焦、色調（第幾組＋1，0＝不調）
  // aTeam：在頭端的第幾格（0–3，小數是格子裡的位置；3 以後是片頭；這條沒有作品就是 −99）、齒孔的位置、
  //        作品格的圖要不要左右／上下翻（1＋2；左右翻時三格的順序也倒過來）＋4×（片頭尾端在第幾格 − 3）×100、作品格的畫面長是膠捲寬的幾倍（0＝沒有）
  // aExt.w：色調；帶作品的膠捲放的是頭端第一組＋1
  const COMMON = `#version 300 es
  precision highp float;
  in vec2 vUv; in vec4 vInfo; in vec4 vExt; in vec4 vTeam;
  uniform sampler2D uAtlas; uniform vec3 uHaze; uniform float uTime; uniform float uGlow; uniform vec3 uTints[16];
  out vec4 o;
  vec2 tileUV(float idx, vec2 st){ float col=mod(idx,4.0), row=floor(idx/4.0); vec2 pad=vec2(${PAD}.0/${SW}.0, ${PAD}.0/${SH}.0); return (vec2(col,row)+pad+st*(1.0-2.0*pad))/vec2(4.0,6.0); }
  float seedOf(){ return floor(vInfo.x+0.5); }
  float hsh(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  // 每條膠捲自己的輪播順序（跨距 5、7、11、13，相鄰兩格不會一樣）；主時間線（種子 99）照 Week 1→8；
  // 清楚的每四格一座鐘塔；失焦的只用插畫和城堡
  float stepOf(float th){ float k=mod(th,4.0); return k<0.5 ? 5.0 : k<1.5 ? 7.0 : k<2.5 ? 11.0 : 13.0; }
  float pick(float k, float n){ float t=mod(k,n); return t>=8.5 ? t+4.0 : t; }   // 跳過鐘塔那 4 格
  float tileOf(float cell){
    float th=seedOf();
    if(th>98.5) return 16.0+mod(cell,8.0);
    if(vExt.z<0.25 && mod(cell+th,4.0)<0.5) return 9.0+mod(floor(cell/4.0)+th,4.0);
    return pick(th*5.0+cell*stepOf(th), vExt.z<0.25 ? 9.0 : 12.0);
  }
  vec3 tintOf(){ float k=vExt.w; if(k<0.5) return vec3(1.0); return uTints[int(k-0.5)]; }
  float rbox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }`;
  const FS_FILM = COMMON + `
  uniform sampler2D uTex; uniform vec3 uTeam[16];   // 作品格的圖；每組的顯影（0–1）、滑鼠（1＝移上去、負的＝別組被移上去）、資料恢復（0–1）
  in float vCool;
  const vec3 CK[4]=vec3[4](vec3(165.0,105.6,79.2),vec3(138.6,114.4,92.4),vec3(198.0,101.2,72.6),vec3(165.0,123.2,110.0));   // 鐘心、半徑（原圖 330×220 的像素）
  float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
  vec4 hands(float tile, float cell, vec2 st){   // 鐘的指針：每個鐘有自己的時間、速度，有的倒著走
    float vi=tile-9.0; if(vi<-0.5 || vi>3.5) return vec4(0.0);
    vec3 cc=CK[int(vi+0.5)];
    vec2 p=vec2(18.0+st.x*293.0, st.y*220.0), c=cc.xy; float r=cc.z;
    float th=seedOf(), h1=hsh(vec2(th+1.0, cell)), h2=hsh(vec2(cell*1.7, th+7.0));
    float rate=h1<0.22 ? -0.8 : 0.3+1.7*h1*h1;
    float mA=h2*6.2832+uTime*rate*0.14, hA=mA/12.0+h1*6.2832;
    vec2 md=vec2(sin(mA),-cos(mA)), hd=vec2(sin(hA),-cos(hA));
    float aa=max(fwidth(p.x),fwidth(p.y))*0.9;
    float d=min(min(seg(p,c,c+hd*r*0.45)-r*0.03, seg(p,c,c+md*r*0.68)-r*0.0175), length(p-c)-r*0.06);
    return vec4(0.165,0.09,0.035, 1.0-smoothstep(-aa,aa,d));
  }
  vec2 vary(vec2 st, float cell, out vec3 grade){   // 同一張插畫每次出現都像不同的鏡頭
    float th=seedOf(), h1=hsh(vec2(th*1.3+0.7, cell)), h2=hsh(vec2(cell+3.1, th*0.7)), h3=hsh(vec2(th+cell*0.37, 9.1));
    float z=1.0+0.28*h1; vec2 off=(vec2(h2,h3)*2.0-1.0)*(1.0-1.0/z)*0.5;
    st=0.5+(st-0.5)/z+off; if(h3<0.35) st.x=1.0-st.x;
    grade=mix(vec3(0.93,0.98,1.07), vec3(1.07,1.0,0.92), h2)*(0.95+0.1*h1);
    return st;
  }
  void main(){
    float u=vUv.x, v=vUv.y, ar=vInfo.w, bl=vExt.z;
    vec2 fw=fwidth(vUv);
    float band=0.13, soft=1.0+bl*12.0;
    bool back=vInfo.y<0.0;
    vec3 col=vec3(0.058,0.051,0.047)*(0.8+0.45*smoothstep(0.0,0.5,v)*(1.0-smoothstep(0.5,1.0,v)));
    float per=0.16, hu=(fract(vTeam.y/per)-0.5)*per*ar;   // 齒孔：沿著膠捲一直排下去（穿過作品格也不斷）
    vec2 hb=vec2(per*ar*0.23, band*0.31);
    float dh=min(rbox(vec2(hu,v-band*0.5),hb,0.018), rbox(vec2(hu,v-(1.0-band*0.5)),hb,0.018));
    float aa=max(fw.y,fw.x*ar)*1.1*soft;
    col=mix(col, vec3(0.95,0.91,0.83)*(0.92+0.08*sin(u*1.7+vInfo.x)), (1.0-smoothstep(-aa,aa,dh))*0.95);
    float q=max(min(v,1.0-v),0.0)/max(fw.y*1.5*soft,0.006);
    col+=vec3(0.14,0.12,0.1)*exp(-q*q);
    float gap=0.03, fu=fract(u), cell=floor(u), i0=band+0.015;
    float tile=tileOf(cell);
    float arT=vTeam.w, hU=vTeam.x, tongue=1.0;
    vec2 dhx=vec2(dFdx(hU), dFdx(v)), dhy=vec2(dFdy(hU), dFdy(v)); float fwh=fwidth(hU);   // 微分要在分支外面算
    if(arT>0.0 && hU>=0.0){   // 頭端：連著三組的作品格，最前面一小段空白的片頭（只有齒孔）
      if(hU>=3.0){   // 片頭：像真的膠捲片頭，尾端斜斜地裁窄成舌形（齒孔也被裁掉）
        int fe=int(vTeam.z+0.5);
        float pe=arT+2.0*gap*ar, hEnd=3.0+float(fe>>2)*0.01, xe=max(hEnd-hU,0.0)*pe;   // xe：離尾端多遠（膠捲寬的幾倍）
        float hw2=mix(0.2,0.5,clamp((xe-0.02)/0.34,0.0,1.0)), aaV=fw.y*1.2*soft;
        tongue=(1.0-smoothstep(hw2-aaV,hw2+aaV,abs(v-0.5)))*smoothstep(0.0,max(fwh*pe*1.5,0.004),xe);
      }
      if(hU<3.0){
        int fl=int(vTeam.z+0.5), j=int(min(floor(hU),2.0));   // 內插後的 2.0 可能變成 1.9999998：旗標先取整數再看（不然同一格會一半翻、一半不翻）
        int gi=int(vExt.w-0.5)+((fl&1)==1 ? 2-j : j);
        float pitch=arT+2.0*gap*ar, tu=(fract(hU)*pitch-gap*ar)/arT;   // pitch：一格（含前後空隙）是膠捲寬的幾倍
        float aaT=max(fw.y, fwh*pitch)*1.1*soft;
        float dT=rbox(vec2((tu-0.5)*arT, v-0.5), vec2(0.5*arT, 0.5-i0), 0.035);
        vec2 tst=vec2(tu,(v-i0)/(1.0-2.0*i0));
        if((fl&1)==1) tst.x=1.0-tst.x;
        if((fl&2)==2) tst.y=1.0-tst.y;
        const vec2 TS=vec2(${PW - 2 * PI}.0/${4 * PW}.0, ${PH - 2 * PI}.0/${4 * PH}.0);
        vec2 tuv=(vec2(float(gi%4), float(gi/4))*vec2(${PW}.0,${PH}.0)+${PI}.0)/vec2(${4 * PW}.0,${4 * PH}.0)+clamp(tst,0.0,1.0)*TS;
        vec2 kk=vec2(pitch/arT, 1.0/(1.0-2.0*i0))*TS;   // 用連續的微分取樣（格子交界處 fract 會跳）
        // 淡藍色、「資訊缺失」的像素感：大數字變成 30×15 的方塊，少數方塊一直缺、其他的偶爾慢慢淡掉又回來；
        // 背景裡零星的殘點、慢慢飄的霧、數字周圍很淡的微光（神秘感）。不做錯位、撕裂、掃描線（學生會以為電腦壞了）
        const vec2 GB=vec2(30.0,15.0);
        vec2 bq=tst*GB, bc=floor(bq), bf=fract(bq);
        vec2 base=(vec2(float(gi%4), float(gi/4))*vec2(${PW}.0,${PH}.0)+${PI}.0)/vec2(${4 * PW}.0,${4 * PH}.0);
        vec3 blk=textureLod(uTex, base+(bc+0.5)/GB*TS, 3.6).rgb;      // 一整塊的平均：數字變成方塊
        vec3 shp=textureGrad(uTex,tuv,dhx*kk,dhy*kk).rgb;             // 小字、底的明暗：照原本清楚
        float glowN=textureLod(uTex, tuv, 5.6).r;                       // 數字周圍很淡的微光
        vec3 tm=uTeam[gi];
        float h1=hsh(bc+vec2(float(gi)*7.31,1.7)), h2=hsh(bc*1.37+vec2(3.1,float(gi)*2.9)), h3=hsh(bc*2.13+vec2(5.3,float(gi)*1.7));
        float rcv=smoothstep(h3*0.85,h3*0.85+0.15,tm.z);   // 資料恢復（滑鼠移上去）：缺的方塊一塊一塊補回來，順序隨機；移開後照同樣的順序慢慢缺回去
        float miss=max(step(h1,0.035), smoothstep(0.93,0.995,0.5+0.5*sin(uTime*(0.25+0.4*h2)+h1*40.0)))*(1.0-rcv);   // 缺得不多：數字還認得出來
        float num=smoothstep(0.12,0.55,blk.r)*(1.0-miss);
        float fleck=step(0.91,h2)*(0.5+0.5*sin(uTime*0.35+h1*30.0))*(1.0-num)*(1.0-0.75*tm.z);   // 背景裡零星的殘點（恢復時變少）
        vec2 gx=vec2(dhx.x*pitch/arT*GB.x, dhx.y/(1.0-2.0*i0)*GB.y), gy=vec2(dhy.x*pitch/arT*GB.x, dhy.y/(1.0-2.0*i0)*GB.y);
        float fwb=max(abs(gx.x)+abs(gy.x), abs(gx.y)+abs(gy.y));
        float ed=min(min(bf.x,1.0-bf.x),min(bf.y,1.0-bf.y)), inset=mix(0.8,1.0,smoothstep(0.04,0.04+1.2*fwb,ed));   // 方塊之間細細的縫（像素感）
        float fog=0.86+0.14*sin(tst.x*3.3+uTime*0.21+float(gi))*sin(tst.y*2.7-uTime*0.17+float(gi)*0.7);   // 慢慢飄的霧
        const vec3 DEEP=vec3(0.03,0.06,0.115), MID=vec3(0.1,0.19,0.31), LITE=vec3(0.68,0.85,1.0);
        vec3 cc=mix(DEEP,MID,shp.b)*fog+LITE*(0.07*glowN+0.16*fleck*inset);
        cc=mix(cc, LITE*(0.78+0.22*fog)*(1.0+0.28*tm.z), num*inset);
        cc=mix(cc, LITE*0.92, smoothstep(0.2,0.7,shp.g)*0.9);
        vec2 pp=tst-0.5;
        float sweep=exp(-pow((pp.x+0.18*pp.y)-(fract(uTime*0.075+float(gi)*0.137)*2.4-1.2),2.0)*40.0);   // 顯影：一道很淡的光慢慢掃過
        vec3 timg=cc*mix(0.12,1.0,tm.x)*(1.0+0.32*max(tm.y,0.0)-0.18*max(-tm.y,0.0))+LITE*0.08*sweep*tm.x;
        col=mix(col,timg,1.0-smoothstep(-aaT,aaT,dT));
      }
    } else {
      vec2 st=vec2((fu-gap)/(1.0-2.0*gap),(v-i0)/(1.0-2.0*i0));
      if(back) st.x=1.0-st.x;
      float di=rbox(vec2((fu-0.5)*ar, v-0.5), vec2((0.5-gap)*ar, 0.5-i0), 0.035);
      bool clock=tile>8.5 && tile<12.5, cover=tile>15.5;
      vec3 grade=vec3(1.0);
      vec2 sv=(clock || cover) ? st : vary(st, cell, grade);
      vec3 img=texture(uAtlas, tileUV(tile, clamp(sv,0.0,1.0)), bl*2.4).rgb*grade;
      if(clock){ vec4 hn=hands(tile, cell, clamp(st,0.0,1.0)); img=mix(img, hn.rgb, hn.a*(1.0-smoothstep(0.15,0.4,bl))); }
      img=mix(vec3(dot(img,vec3(0.3,0.59,0.11))), img, 1.0-bl*0.3);
      if(!cover) img=mix(img, img*img*(3.0-2.0*img), 0.3*(1.0-bl))*(1.0+0.08*(1.0-bl));
      if(back) img=mix(vec3(0.06,0.05,0.045), img, 0.68);
      col=mix(col,img,1.0-smoothstep(-aa,aa,di));
    }
    float thin=smoothstep(0.05,0.16,fw.y);   // 很細的時候齒孔和畫面會閃，改成一條柔和的帶子
    if(thin>0.0){ vec3 av=textureLod(uAtlas, tileUV(tile, vec2(0.5)), 4.0).rgb; col=mix(col, mix(vec3(0.05,0.05,0.06), av, 0.75), thin); }
    col*=abs(vInfo.y);
    col+=vec3(1.0,0.93,0.82)*vExt.x+vec3(0.42,0.62,1.0)*0.15*vCool;   // 反光（暖）＋作品格的淡藍光（冷）
    col=mix(col,uHaze,vExt.y);
    float a=vInfo.z*(1.0-smoothstep(0.5-fw.y*1.5*soft,0.5,abs(v-0.5)))*tongue;
    if(a<0.03) discard;   // 幾乎看不到的地方不畫（也不寫深度）
    o=vec4(min(col,vec3(1.0))*a,a);
  }`;
  const FS_GLOW = COMMON + `
  void main(){   // 滑鼠碰到的那一條：一圈很淡的光
    float u=vUv.x-0.5, v=vUv.y, cell=floor(u), f=smoothstep(0.0,1.0,fract(u));
    vec3 avg=mix(textureLod(uAtlas, tileUV(tileOf(cell), vec2(0.5)), 5.0).rgb, textureLod(uAtlas, tileUV(tileOf(cell+1.0), vec2(0.5)), 5.0).rgb, f);
    avg=mix(avg, avg*tintOf(), 0.5);
    float lum=dot(avg,vec3(0.3,0.59,0.11));
    float dv=max(abs(v-0.5)-0.3,0.0);
    float fall=exp(-dv*dv*5.0)*(1.0-smoothstep(1.0,2.15,abs(v-0.5)*2.0));
    vec3 c=avg*(0.25+2.4*lum*lum)*fall*abs(vInfo.y)*vInfo.z*uGlow*(1.0-0.8*vExt.y);
    c=c/(1.0+max(c.r,max(c.g,c.b)));
    o=vec4(c,max(c.r,max(c.g,c.b)));
  }`;
  const VS_BG = `#version 300 es
  const vec2 P[3]=vec2[3](vec2(-1.0,-1.0),vec2(3.0,-1.0),vec2(-1.0,3.0)); void main(){ gl_Position=vec4(P[gl_VertexID],0.0,1.0); }`;
  // 背景：深藍的夜，越靠近裂縫越亮；裂縫一團暖光、外面兩圈很淡的刻度慢慢轉
  const FS_BG = `#version 300 es
  precision highp float; uniform vec2 uRes; uniform vec2 uRift; uniform float uDpr; uniform float uTime; uniform float uOpen; uniform float uZoom; uniform vec3 uHd[5]; out vec4 o;
  float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    vec2 fc=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y)/uDpr, res=uRes/uDpr;
    vec2 f=fc-uRift; float r=length(f), a=atan(f.y,f.x), m=min(res.x,res.y)*uZoom;   // uZoom：從首頁進來、鏡頭還在放大時，光暈一起放大
    vec3 c=mix(vec3(0.085,0.115,0.215), vec3(0.022,0.03,0.058), smoothstep(0.0,1.0,r/(max(res.x,res.y)*uZoom)*1.5));
    float pulse=0.88+0.12*sin(uTime*0.8);
    c+=vec3(0.45,0.28,0.14)*exp(-r*r/(0.07*m*0.07*m))*pulse*uOpen+vec3(0.55,0.42,0.28)*exp(-r*r/(0.02*m*0.02*m))*uOpen;   // 裂縫：一團暖光和很亮的芯
    c+=vec3(0.07,0.08,0.17)*exp(-r*r/(0.45*m*0.45*m))*uOpen;
    c+=vec3(0.16,0.26,0.5)*0.5*exp(-pow((r-0.15*m)/(0.07*m),2.0))*uOpen;   // 裂縫外圈一道冷藍的光（和作品格的淡藍呼應）
    for(int i=0;i<5;i++){ vec3 hd=uHd[i]; if(hd.z>0.0){ vec2 d=fc-hd.xy; c+=vec3(0.22,0.36,0.62)*0.075*exp(-dot(d,d)/(hd.z*hd.z)); } }   // 作品格的淡藍光散在周圍的霧裡
    float t1=0.5+0.5*cos(a*24.0-uTime*0.25), t2=step(0.86,fract(a*60.0/6.2832+uTime*0.006));
    c+=vec3(0.95,0.72,0.36)*0.12*exp(-pow((r-0.06*m)/1.3,2.0))*(0.35+0.65*t1)*uOpen;
    c+=vec3(0.8,0.78,0.95)*0.08*exp(-pow((r-0.09*m)/1.6,2.0))*t2*uOpen;
    c+=(h(gl_FragCoord.xy)-0.5)/255.0;
    o=vec4(c,1.0);
  }`;
  function prog(vs, fs) {
    const p = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([t, src]) => {
      const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  let PF, PG, PB;
  try { PF = prog(VS, FS_FILM); PG = prog(VS, FS_GLOW); PB = prog(VS_BG, FS_BG); }
  catch (e) { console.error("[week9]", e); fallback(); return; }
  const vao = gl.createVertexArray(), vbo = gl.createBuffer(), bgVao = gl.createVertexArray();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  const NF = 18, STRIDE = NF * 4;
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, STRIDE, 20);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, STRIDE, 36);
  gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, STRIDE, 52);
  gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 1, gl.FLOAT, false, STRIDE, 68);
  gl.bindVertexArray(null);
  const TINTS = new Float32Array(48);
  for (let i = 0; i < 16; i++) TINTS.set([0.68, 0.85, 1.0], i * 3);   // 15 組統一淡藍色（滑鼠移上去的光暈也是）
  const TEAMU = new Float32Array(48), HDU = new Float32Array(15);

  /* ---------- 向量 ---------- */
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function rotate(v, ax, c, s) { const k = cross(ax, v), d = dot(ax, v) * (1 - c); return [v[0] * c + k[0] * s + ax[0] * d, v[1] * c + k[1] * s + ax[1] * d, v[2] * c + k[2] * s + ax[2] * d]; }
  function catmull(P, n) {   // 向心 Catmull-Rom（alpha 0.5）：控制點間距差很多時也不會繞圈、不會有尖角；每段 n 點，第 j 個控制點在第 j*n 點
    const out = [], m = P.length, dist = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])));
    const ext = (a, b) => a.map((v, i) => 2 * v - b[i]);
    for (let i = 0; i < m - 1; i++) {
      const p1 = P[i], p2 = P[i + 1], p0 = i > 0 ? P[i - 1] : ext(p1, p2), p3 = i + 2 < m ? P[i + 2] : ext(p2, p1);
      const t0 = 0, t1 = t0 + dist(p0, p1), t2 = t1 + dist(p1, p2), t3 = t2 + dist(p2, p3);
      const L = (pa, pb, ta, tb, t) => pa.map((v, j) => ((tb - t) / (tb - ta)) * v + ((t - ta) / (tb - ta)) * pb[j]);
      for (let k = 0; k < n; k++) {
        const t = t1 + ((t2 - t1) * k) / n;
        const A1 = L(p0, p1, t0, t1, t), A2 = L(p1, p2, t1, t2, t), A3 = L(p2, p3, t2, t3, t);
        out.push(L(L(A1, A2, t0, t2, t), L(A2, A3, t1, t3, t), t1, t2, t));
      }
    }
    out.push(P[m - 1].slice());
    return out;
  }
  const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

  /* ---------- 相機：在原點往 −z 看；滑鼠移動時整台平移（不轉頭），近的東西移得多、遠的移得少 ---------- */
  const FOV = 42 * Math.PI / 180, NEAR = 0.3, FAR = 300;
  let W = 0, H = 0, DPR = 1, FP = 1;   // FP：深度 1 的地方一個世界單位是幾像素
  const U = (sx, sy, d) => [(sx - W / 2) / FP * d, -(sy - H / 2) / FP * d, -d];   // 畫面上的位置（像素）＋深度 → 世界座標（相機在原點時）
  const eye = [0, 0, 0], eye0 = [0, 0, 0];   // eye0：排版時的相機（不跟滑鼠動）
  // 放大（從首頁進來時，鏡頭從一格膠捲裡往外拉）：畫面座標 ndc' = Z·ndc + b。只改投影、不移動相機，所以不會穿過任何膠捲
  const ZM = { on: false, Z: 1, bx: 0, by: 0 };
  function project(p, out, raw) {
    const x = p[0] - eye[0], y = p[1] - eye[1], z = -(p[2] - eye[2]);
    out[0] = W / 2 + FP * x / z; out[1] = H / 2 - FP * y / z; out[2] = z;
    if (ZM.on && !raw) { const nx = (out[0] - W / 2) / (W / 2), ny = -(out[1] - H / 2) / (H / 2); out[0] = W / 2 + (ZM.Z * nx + ZM.bx) * W / 2; out[1] = H / 2 - (ZM.Z * ny + ZM.by) * H / 2; }
    return out;
  }
  function vpMatrix() {
    const f = 1 / Math.tan(FOV / 2), a = W / H, nf = 1 / (NEAR - FAR);
    const P = [f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (FAR + NEAR) * nf, -1, 0, 0, 2 * FAR * NEAR * nf, 0];
    const tx = -eye[0], ty = -eye[1], tz = -eye[2];   // 視矩陣只有平移
    const M = P.slice();
    M[12] = P[0] * tx; M[13] = P[5] * ty; M[14] = P[10] * tz + P[14]; M[15] = P[11] * tz;
    if (ZM.on) for (let c = 0; c < 4; c++) { M[c * 4] = ZM.Z * M[c * 4] + ZM.bx * M[c * 4 + 3]; M[c * 4 + 1] = ZM.Z * M[c * 4 + 1] + ZM.by * M[c * 4 + 3]; }
    return new Float32Array(M);
  }

  /* ---------- 版面：裂縫在中間；5 條帶作品的膠捲一律順時針螺旋著轉出來，頭端就是轉出來的方向（一路順著轉，不會掉頭、反折）。
     順時針轉出來，所以裂縫上方的頭端往右走（放在右邊）、下方的往左走（放在左邊）---------- */
  // 膠捲寬 1；作品格的畫面約 2.05:1（比一般 4:3 的畫格長），前後各留一般畫格之間的空隙；頭端（三格＋片頭）約 3.2 格長
  const WS = 1, CELL = 0.885 * WS, GW = 0.03 * CELL, LT = 2.05 * 0.71 * WS + 2 * GW, HEADL = 3.2, TIPF = 1.78;   // TIPF：片頭尾端離中間那格的中心幾格
  // 寬螢幕每一條頭端：中心（作品區的比例 x、y）、傾斜（度）、遠近（<1 近一點、大一點）、頭端前後起伏的幅度
  const HEADS_WIDE = [
    { x: 0.42, y: 0.08, tilt: -3, sc: 1.12, wave: 0.22 },   // 上面三條往右走（左、右、左錯開）
    { x: 0.71, y: 0.25, tilt: 5, sc: 0.94, wave: 0.3 },
    { x: 0.4, y: 0.42, tilt: -4, sc: 1.08, wave: 0.2 },
    { x: 0.68, y: 0.75, tilt: 4, sc: 0.95, wave: 0.28 },    // 下面兩條往左走（右、左）
    { x: 0.3, y: 0.92, tilt: -3, sc: 1.06, wave: 0.22 },
  ], RIFT_WIDE = [0.55, 0.585];
  let S = [], TEAM = [], RIFT = [0, 0, -30], PAR = 1, HC = [], ARR = null, arrDone = !ARRIVE;
  let DPR0 = 1, QF = 1;   // QF：自動畫質（電腦跟不上就降低解析度）
  const qSamp = [];
  function layout() {
    W = stage.clientWidth; H = stage.clientHeight; DPR0 = Math.min(1.5, window.devicePixelRatio || 1); DPR = DPR0 * QF; qSamp.length = 0;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    FP = (H / 2) / Math.tan(FOV / 2);
    const ir = intro.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    const iR = ir.right - sr.left, iB = ir.bottom - sr.top;
    const pB = pager ? pager.getBoundingClientRect().top - sr.top : H;
    const wide = W / H > 1.15 && W > 900;
    // 作品可以放的範圍（像素）：寬螢幕在介紹的右邊，窄螢幕在介紹的下面
    const A = wide ? { x0: iR + 34, y0: 10, x1: W - 10, y1: pB - 6 } : { x0: 6, y0: iB + 14, x1: W - 6, y1: pB - 8 };
    PAR = wide ? 1 : 0.35;   // 窄螢幕的頭端貼著畫面兩邊：鏡頭少飄一點，才不會被切掉
    const aw = A.x1 - A.x0, ah = A.y1 - A.y0, NG = Math.ceil(N / 3);
    // 膠捲寬（像素）：寬螢幕一條頭端約佔作品區一半寬；窄螢幕佔滿整個寬
    const sw = wide ? Math.max(56, Math.min(118, (aw * 0.48) / (HEADL * LT), ah * 0.135)) : Math.max(40, Math.min(112, (aw * 0.92) / (HEADL * LT), ah * 0.13));
    const list = wide ? HEADS_WIDE.slice(0, NG) : [0.08, 0.25, 0.42, 0.76, 0.93].slice(0, NG).map((y, g) => ({ x: [0.47, 0.55, 0.45, 0.54, 0.46][g % 5], y, tilt: [-3.5, 2.5, -2, 3.5, -2.5][g % 5], sc: [1, 1.06, 0.97, 1.04, 1][g % 5], wave: 0.2 }));
    const rN = wide ? RIFT_WIDE : [0.5, 0.59], rcx = A.x0 + rN[0] * aw, rcy = A.y0 + rN[1] * ah;
    const dBase = FP * WS / sw;
    const heads = list.map((r, g) => {
      const d = dBase * r.sc, Lpx = (LT * FP) / d, half = (HEADL * Lpx) / 2, hy = A.y0 + r.y * ah;
      const dir = hy < rcy ? 1 : -1, eL = (dir > 0 ? 1.55 : TIPF + 0.05) * Lpx, eR = (dir > 0 ? TIPF + 0.05 : 1.55) * Lpx;   // 頭端往左、往右各伸多遠（片頭那一側比較長）
      return { g, d, Lpx, dir, wave: r.wave, a: (r.tilt * Math.PI) / 180, hx: Math.max(A.x0 + eL + 4, Math.min(A.x1 - eR - 4, A.x0 + r.x * aw)), hy };
    });
    // 頭端互相不能蓋到：取每條頭端的中線（9 點）和半高，水平上重疊的地方上下距離不夠就推開（最多 40 次），再夾回作品區
    const hh = (h) => (h.Lpx / LT) / 2 + 8;   // 半高（膠捲寬的一半）＋留白
    const line = (h) => Array.from({ length: 9 }, (_, q) => { const f = -1.6 + ((1.6 + TIPF) * q) / 8; return [h.hx + Math.cos(h.a) * h.dir * f * h.Lpx, h.hy + Math.sin(h.a) * h.dir * f * h.Lpx]; });
    for (let it = 0; it < 40; it++) {
      let moved = false;
      for (let i = 0; i < heads.length; i++) for (let j = i + 1; j < heads.length; j++) {
        const P1 = line(heads[i]), P2 = line(heads[j]), need = hh(heads[i]) + hh(heads[j]);
        let worst = 0;
        for (const a of P1) for (const b of P2) if (Math.abs(a[0] - b[0]) < 0.3 * heads[i].Lpx) worst = Math.max(worst, need - Math.abs(a[1] - b[1]));
        if (worst > 0.5) { const sg = heads[i].hy < heads[j].hy ? -1 : 1; heads[i].hy += (sg * worst) / 2; heads[j].hy -= (sg * worst) / 2; moved = true; }
      }
      heads.forEach((h) => { const r = hh(h) + Math.abs(Math.sin(h.a)) * h.Lpx * 1.7; h.hy = Math.max(A.y0 + r, Math.min(A.y1 - r, h.hy)); });
      if (!moved) break;
    }
    // 深度：裂縫在最遠的頭端後面很深的地方
    const dMin = Math.min(...heads.map((h) => h.d)), dMax = Math.max(...heads.map((h) => h.d)), dR = dMax + 16;
    // 每條斜坡起點（螺旋的終點）的深度：比所有頭端都深，每條錯開一點
    heads.forEach((h) => { h.dp = Math.max(h.d + 3.4, dMax + 1.3) + [0, 0.9, 1.8, 0.45, 1.35][h.g % 5]; });
    const dpMax = Math.max(...heads.map((h) => h.dp));
    RIFT = U(rcx, rcy, dR);
    const old = S, oldT = TEAM; S = []; TEAM = [];
    const add = (o2) => { S.push(o2); return o2; };
    const tw4 = (arr, tw) => arr.map((p, j) => p.concat([typeof tw === "function" ? tw(j) : tw || 0]));
    // 從裂縫轉出來的螺旋：畫面上是一段只往一個方向彎的曲線（三次曲線；一律順時針，不會反過來彎、不會反折），
    // 終點的走向是 e2。起點的走向比「裂縫→終點」再逆時針偏 22 度，所以整段一路順時針轉，轉的角度 = 需要的角度 + 22 度（不會繞大圈）。
    // 深度沿著曲線均勻地從 d0 變到 d1，再加上每條自己的起伏（bulge），所以在 3D 裡是一段很緩的螺旋。回傳曲線上的點（不含裂縫和終點）
    const arc = (A2, e2, d0, d1, bulge = 0) => {
      const qx = A2[0] - rcx, qy = A2[1] - rcy, ch = Math.hypot(qx, qy), tc = Math.atan2(qy, qx), te = Math.atan2(e2[1], e2[0]);
      let dl = te - tc; while (dl <= -Math.PI) dl += 2 * Math.PI; while (dl > Math.PI) dl -= 2 * Math.PI;
      const sg = dl >= 0 ? 1 : -1, t0 = tc - sg * 0.38, turn = Math.abs(dl) + 0.38;   // 需要逆時針的（很少）才逆時針
      const k0 = ch * (0.32 + 0.12 * turn / Math.PI), k1 = ch * (0.5 + 0.1 * turn / Math.PI);   // 終點那一端的把手長：接近終點時幾乎是直的
      const c0 = [rcx + Math.cos(t0) * k0, rcy + Math.sin(t0) * k0], c1 = [A2[0] - e2[0] * k1, A2[1] - e2[1] * k1];
      const nseg = Math.max(3, Math.ceil(turn / 0.35) + 2), out = [];
      for (let k = 1; k < nseg; k++) {
        const t = k / nseg, u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
        out.push(U(b0 * rcx + b1 * c0[0] + b2 * c1[0] + b3 * A2[0], b0 * rcy + b1 * c0[1] + b2 * c1[1] + b3 * A2[1], d0 + (d1 - d0) * t + bulge * Math.sin(Math.PI * t)).concat([0]));
      }
      return out;
    };
    // 漩渦：十幾條失焦的膠捲從裂縫順時針螺旋著往外散開，整條都在裂縫後面（比所有清楚的膠捲都深，不會和它們穿過；遠了所以寬一點），慢慢被吸進裂縫
    const NA = wide ? 12 : 7, Rm = Math.hypot(W, H) * 0.62;
    for (let j = 0; j < NA; j++) {
      const a0 = (j / NA) * Math.PI * 2 + rnd(j, 30) * 0.5, rate = 2.3 + 0.7 * rnd(j, 31), pts = [];
      for (let q = 0; q <= 6; q++) {
        const f = q / 6, a = a0 + rate * f, rr = 18 + Rm * Math.pow(f, 1.25);
        pts.push(U(rcx + Math.cos(a) * rr, rcy + Math.sin(a) * rr * 0.86, dR + 0.6 + (2 + 3 * rnd(j, 35)) * f).concat([(rnd(j, 36) - 0.5) * 50 * f]));
      }
      add({ kind: "arm", seed: 40 + j, tint: 0, w: 1 + 0.5 * rnd(j, 32), v: -(0.035 + 0.03 * rnd(j, 33)), blur: 0.22 + 0.28 * rnd(j, 34), sp: 0.28, dRef: dR, P: pts, face: true });
    }
    for (let j = 0; j < 2; j++) {   // 很遠的兩條
      const y = H * (j ? 0.86 : 0.14), d = dR + 6;
      add({ kind: "far", seed: 52 + j, tint: 0, w: 1.1, v: (j ? -1 : 1) * 0.03, blur: 0.45, sp: 0.25, face: true,
        P: tw4([U(-W * 0.3, y + 40, d), U(W * 0.3, y - 30, d), U(W * 0.7, y + 30, d), U(W * 1.3, y - 40, d)], 0) });
    }
    // 主時間線：Week 1–8 的封面，從介紹文字的右邊（窄螢幕在介紹的下面）淡入，直直地退進裂縫：畫面上是直線、只往深處去，
    // 所以一直正面朝鏡頭；整條都比所有帶作品的膠捲（連斜坡最深的地方）還深：經過它們的時候一定整段在後面，不會看起來刺穿
    const xT = wide ? iR + 6 : -W * 0.08, yT = wide ? rcy - ah * 0.015 : A.y0 - 6;
    const along = (t, dd) => U(xT + (rcx - xT) * t, yT + (rcy - yT) * t, dd).concat([0]);
    add({ kind: "trunk", phys: true, seed: 99, tint: 0, w: wide ? 0.95 : 0.8, v: 0.09, blur: 0, start: 0.05, grow: 0.9, sp: 0.06, dRef: dpMax,
      P: [along(0, dpMax + 1.2), along(0.3, dpMax + 2.6), along(0.6, (dpMax + dR) / 2 + 1), along(0.85, dR - 2), RIFT.concat([0])] });
    // 一條有鐘塔的膠捲：也從裂縫順時針轉出來，往右邊飛出畫面（不帶作品）
    const hxE = W + 0.12 * aw, hyE = A.y0 + (wide ? 0.665 : 0.6) * ah, he = wide ? [Math.cos(0.4), Math.sin(0.4)] : [Math.cos(0.15), Math.sin(0.15)];   // 窄螢幕：從第三排和第四排中間飛出去（不碰到下面那條的斜坡）
    add({ kind: "hero", phys: true, seed: 30, tint: 0, w: 0.8, v: 0.06, blur: 0, sp: 0.06, start: 0.4, grow: 1.6, dRef: dpMax,
      P: [RIFT.concat([0]), ...arc([hxE, hyE], he, dR, dpMax + 1.2, -1.2), U(hxE, hyE, dpMax + 1.2).concat([0]), U(hxE + he[0] * 120, hyE + he[1] * 120, dpMax + 1.1).concat([0])] });
    // 5 條帶作品的膠捲：從裂縫順時針螺旋著轉出來（一路同一個方向轉），轉到頭端的後面、很深的地方時剛好朝著頭端的方向，
    // 再沿著頭端的方向從後面升上來（斜坡：畫面上是直的，只往前後彎，和正面朝鏡頭不衝突），接上頭端。
    // 螺旋上的膠捲多半側著（物理），到頭端要正面朝鏡頭：這 90 度的扭轉放在斜坡上慢慢完成（斜坡在 3D 裡約 3 個單位長），不會折到。
    // 頭端連著三組的作品格，最前面一小段空白的片頭。頭端在畫面上是直的、只往深度方向起伏（像參考圖那樣有一點波浪）
    heads.forEach((h) => {
      const { g, d, Lpx, dir } = h, ca = Math.cos(h.a), sa = Math.sin(h.a), ex = ca * dir, ey = sa * dir;
      const S2 = (f, dd) => U(h.hx + ex * f * Lpx, h.hy + ey * f * Lpx, dd).concat([0]);   // 沿著頭端：f＝離中間那一格的中心幾格（往走的方向是正的）
      const wv = [0.75, -0.55, 0.6, -0.2].map((v) => v * h.wave * (rnd(g, 41) < 0.5 ? 1 : -1));
      // 螺旋的終點：頭端前面、後面很深的地方（比所有頭端都深；每條錯開一點）；螺旋中段每條的深度起伏不同，交叉的地方才不會在同一個深度
      const dp = h.dp, ax = h.hx - ex * 2.45 * Lpx, ay = h.hy - ey * 2.45 * Lpx;
      // 頭端前後偏轉（每 1 格深度變多少）：一端近、一端遠，不像一塊正對鏡頭的硬板；只是整段斜著（沒有彎），符合物理
      const yaw = [0.2, -0.26, 0.16, -0.22, 0.24][g % 5] * (wide ? 1 : 0.6), D = (f, w) => d + w + yaw * f;
      const P = [RIFT.concat([0]), ...arc([ax, ay], [ex, ey], dR, dp, [1.6, -1.2, 2.6, -2.2, 0.4][g % 5]), S2(-2.45, dp), S2(-2.0, d + 1.25 - yaw * 2),   // 斜坡：從後面升上來
        S2(-1.5, D(-1.5, wv[0])), S2(-0.5, D(-0.5, wv[1])), S2(0.5, D(0.5, wv[2])), S2(1.5, D(1.5, wv[3])),   // 三組作品格：頭到尾
        S2(1.64, D(1.64, wv[3] + 0.03)), S2(TIPF, D(TIPF, wv[3] + 0.13))];   // 片頭：短短一段，最尾端微微往後捲（膠捲的自由端會有一點捲）
      const h0 = P.length - 6;
      const s = add({ kind: "spoke", phys: true, g, seed: 3 + g, tint: 3 * g + 1, w: WS, v: 0, blur: 0, sp: 0.06, dRef: d, grow: 2.2, hj: [h0, h0 + 3], P });
      for (let k = 0; k < 3 && 3 * g + k < N; k++) {
        const i = 3 * g + k, ot = oldT[i];
        TEAM[i] = { i, k, j: k, li: roomEls[i], s, hl: ot ? ot.hl : 0, dev: ot ? ot.dev : REDUCE ? 1 : 0, on: ot ? ot.on : false, rec: ot ? ot.rec : 0, poly: null, z: 99, cx: 0, cy: 0 };
      }
    });
    S.forEach((s, i) => build(s, old[i]));
    TEAM.forEach((tm) => { tm.j = tm.s.rev ? 2 - tm.k : tm.k; });
    // 每條頭端中間那一格的位置（世界座標）：作品格的淡藍光從這裡照到旁邊經過的膠捲
    HC = S.filter((q) => q.kind === "spoke").map((q) => { const k = q.kM[1]; return [q.b.x[k], q.b.y[k], q.b.z[k]]; });
    if (ARRIVE && !arrDone) planArrival();
    if (DEBUG) crossCheck();   // 膠捲在畫面上朝左時，三格的順序倒過來（由左往右讀還是 01、02、03）
    // 開場的時間：主時間線先流進去；5 條依序從裂縫長出來；漩渦慢慢淡入
    S.forEach((s, i) => {
      if (s.kind === "spoke") { s.start = 0.6 + s.g * 0.15; s.grow = 2.6; }
      else if (s.kind === "trunk" && ARRIVE) s.start = -10;   // 從首頁進來：鏡頭一開始就在主時間線的一格裡，主時間線要先在
      else if (s.kind === "arm" || s.kind === "far") { s.start = 0.15 + 0.06 * (i % 8); s.grow = 1.3; }
    });
  }
  function crossCheck() {
    const zr = RIFT[2] + 4, list = S.filter((q) => q.kind !== "far"), pts = list.map((q) => { const b = q.b, a = []; for (let k = 0; k < b.n; k += 2) if (b.z[k] > zr) a.push([b.x[k], b.y[k], b.z[k]]); return a; });
    const name = (q) => q.kind + (q.g !== undefined ? q.g : q.seed), out = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (list[i].kind === "arm" && list[j].kind === "arm") continue;   // 兩條都是失焦的背景：不寫深度，只是疊在一起
      let m2 = 1e9;
      for (const a of pts[i]) for (const c of pts[j]) { const dx = a[0] - c[0], dy = a[1] - c[1], dz = a[2] - c[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < m2) m2 = d2; }
      const md = Math.sqrt(m2), lim = 0.75 * (list[i].hw + list[j].hw);
      if (md < lim) out.push(name(list[i]) + "×" + name(list[j]) + " " + md.toFixed(2));
    }
    window.__w9x = out;
    // 畫面上的穿破：兩條在畫面上重疊、而且在畫面上離得很近（同一個交叉處）的兩組重疊點，前後順序卻相反
    // → 一條看起來從另一條中間穿過去（就算 3D 裡沒有真的碰到，例如從斜坡和頭端之間的深度縫隙穿過）
    const pr = list.map((q) => { const b = q.b, a = []; for (let k = 0; k < b.n; k += 2) { if (b.z[k] <= zr) continue; const z = -b.z[k]; a.push([W / 2 + (FP * b.x[k]) / z, H / 2 - (FP * b.y[k]) / z, z, (q.hw * FP) / z]); } return a; });
    const pierce = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (list[i].kind === "arm" && list[j].kind === "arm") continue;
      const ov = [];
      for (const a of pr[i]) for (const c of pr[j]) { const dx = a[0] - c[0], dy = a[1] - c[1], r = 0.8 * (a[3] + c[3]); if (dx * dx + dy * dy < r * r) ov.push([a[0], a[1], Math.sign(a[2] - c[2]), 2 * (a[3] + c[3])]); }
      let bad = null;
      for (let u = 0; u < ov.length && !bad; u++) for (let v = u + 1; v < ov.length; v++) {
        if (ov[u][2] === ov[v][2]) continue;
        const dx = ov[u][0] - ov[v][0], dy = ov[u][1] - ov[v][1], r = Math.max(ov[u][3], ov[v][3]);
        if (dx * dx + dy * dy < r * r) { bad = ov[u]; break; }
      }
      if (bad) pierce.push(name(list[i]) + "×" + name(list[j]) + " @" + Math.round(bad[0]) + "," + Math.round(bad[1]));
    }
    window.__w9p = pierce;
  }
  /* 從首頁進來：在主時間線上挑一格（畫面上看得到、最大的那一格，避開還沒捲到的地方），鏡頭從這一格裡往外拉。
     一開始這一格的畫面鋪滿看得到的區域（畫布在頂列下面，所以對準看得到的那一塊的中間），那一格換成 Week 8 的封面
     （從課程的時間線走進 Week 9）。 */
  function planArrival() {
    const tr = S.find((q) => q.kind === "trunk"); if (!tr) { ARR = null; return; }
    const b = tr.b, sr = stage.getBoundingClientRect(), vTop = Math.max(0, -sr.top), vBot = Math.min(H, window.innerHeight - sr.top);
    const hImg = tr.w * 0.71, wImg = tr.cell * 0.94, out = [0, 0, 0];
    let best = null;
    for (let k = 0; k < b.n; k++) {
      const f = b.s[k] / b.L; if (f < 0.18 || f > 0.7) continue;
      project([b.x[k], b.y[k], b.z[k]], out, true);
      const hp = (FP * hImg) / out[2];
      if (out[0] < W * 0.12 || out[0] > W * 0.88 || out[1] < vTop + (vBot - vTop) * 0.15 || out[1] > vBot - (vBot - vTop) * 0.15) continue;
      if (!best || hp > best.hp) best = { k, hp, wp: (FP * wImg) / out[2] };
    }
    if (!best) { ARR = null; return; }
    const visH = vBot - vTop, Z0 = Math.max((visH * 1.04) / best.hp, (W * 1.04) / best.wp, 2);
    const k = best.k;
    tr.scroll = b.s[k] / tr.cell - 7.5;   // 那一格正好是 Week 8 的封面（主時間線的第 8 格）
    ARR = { P: [b.x[k], b.y[k], b.z[k]], Z0, ax: 0, ay: (2 * ((vTop + vBot) / 2)) / H - 1 };
    ARR.ay = -ARR.ay;   // 畫面座標往下是正的，ndc 往上是正的
  }
  // 一條膠捲：取等距的點（作品格的頭尾一定有一點），算每一點的切線、寬的方向（不亂轉的框架，可沿著長的方向翻轉）、面的方向
  function build(s, old) {
    const fine = catmull(s.P, 30), acc = [0];
    for (let k = 1; k < fine.length; k++) acc.push(acc[k - 1] + Math.hypot(fine[k][0] - fine[k - 1][0], fine[k][1] - fine[k - 1][1], fine[k][2] - fine[k - 1][2]));
    const L = acc[acc.length - 1], dRef = s.dRef || 10;
    let ss = [];
    for (let x = 0, j2 = 0; x < L - 1e-4; ) {   // 依深度取樣：深的地方在畫面上小，點可以疏一點（最多 3 倍）
      ss.push(x);
      while (j2 < fine.length - 2 && acc[j2 + 1] < x) j2++;
      x += s.sp * Math.min(3, Math.max(1, -fine[j2][2] / dRef));
    }
    ss.push(L);
    if (s.kind === "spoke") {   // 頭端三格的分界一定有一點
      s.sH0 = acc[s.hj[0] * 30]; s.pitch = (acc[s.hj[1] * 30] - s.sH0) / 3;
      const cut = [0, 1, 2, 3].map((q) => s.sH0 + q * s.pitch);
      ss = ss.filter((x) => cut.every((c) => Math.abs(x - c) > 1e-4)).concat(cut).sort((a, b) => a - b);
    }
    const n = ss.length, F = () => new Float32Array(n);
    const b = { n, L, x: F(), y: F(), z: F(), s: F(), tw: F(), bx: F(), by: F(), bz: F(), nx: F(), ny: F(), nz: F() };
    let j = 0;
    for (let k = 0; k < n; k++) {
      const sk = ss[k]; while (j < fine.length - 2 && acc[j + 1] < sk) j++;
      const f = (sk - acc[j]) / Math.max(1e-6, acc[j + 1] - acc[j]);
      b.x[k] = fine[j][0] + (fine[j + 1][0] - fine[j][0]) * f; b.y[k] = fine[j][1] + (fine[j + 1][1] - fine[j][1]) * f;
      b.z[k] = fine[j][2] + (fine[j + 1][2] - fine[j][2]) * f; b.tw[k] = fine[j][3] + (fine[j + 1][3] - fine[j][3]) * f;
      b.s[k] = sk;
    }
    const T = [];
    for (let k = 0; k < n; k++) { const k0 = Math.max(0, k - 1), k1 = Math.min(n - 1, k + 1); T.push(norm([b.x[k1] - b.x[k0], b.y[k1] - b.y[k0], b.z[k1] - b.z[k0]])); }
    if (s.phys) physFrame(s, b, T);
    else faceFrame(s, b, T);
    s.b = b; s.hw = s.w / 2; s.cell = s.hw * 2 * (s.seed === 99 ? 1.18 : 0.885);   // 畫格 16:9（封面）或 4:3（插畫）
    s.arT = 0; s.flags = 0; s.rev = 0;
    if (s.kind === "spoke") {
      const find = (v) => { let best = 0; for (let k = 0; k < n; k++) if (Math.abs(b.s[k] - v) < Math.abs(b.s[best] - v)) best = k; return best; };
      s.kF = [0, 1, 2, 3].map((q) => find(s.sH0 + q * s.pitch));          // 三格的分界
      s.kM = [0, 1, 2].map((q) => find(s.sH0 + (q + 0.5) * s.pitch));     // 三格的中間
      s.arT = (s.pitch - 2 * GW) / s.w;
      // 作品格的圖要不要翻：沿著膠捲往前在畫面上朝左就左右翻（三格的順序也倒過來）；畫面的上緣（寬的 + 那一邊）在畫面上朝下就上下翻
      const k = s.kM[1], p = [b.x[k], b.y[k], b.z[k]], a0 = project(p, [0, 0, 0]);
      const kk = Math.min(n - 1, k + 1), a1 = project([b.x[kk], b.y[kk], b.z[kk]], [0, 0, 0]);
      const a2 = project([p[0] + b.bx[k] * 0.2, p[1] + b.by[k] * 0.2, p[2] + b.bz[k] * 0.2], [0, 0, 0]);
      s.flags = (a1[0] < a0[0] ? 1 : 0) + (a2[1] > a0[1] ? 2 : 0); s.rev = s.flags & 1;
      s.flags += 4 * Math.max(0, Math.min(400, Math.round(((L - s.sH0) / s.pitch - 3) * 100)));   // 片頭尾端的位置一起帶給著色器（舌形）
    }
    s.disp = F(); s.vel = F(); s.live = false;
    s.px = F(); s.py = F(); s.pz = F(); s.sh = F(); s.spec = F(); s.al = F(); s.hz = F(); s.bv = F(); s.scr = F(); s.scrY = F(); s.scrR = F(); s.cl = F();
    s.scroll = old ? old.scroll : rnd(s.seed, 17); s.phase = rnd(s.seed, 18) * 6.28; s.hl = old ? old.hl : 0;
    s.reveal = old ? old.reveal : REDUCE ? 1 : 0; s.nVis = 0;
  }
  // 物理的膠捲（帶作品的、主時間線、鐘塔那條）：底片只能往正面、背面彎，不能在自己的平面裡往旁邊彎，
  // 所以寬的方向要垂直於彎曲的方向（彎得越厲害越要遵守）；直的地方慢慢轉向鏡頭；頭端一定正面朝鏡頭。
  // 寬的方向用「不扭轉的框架」加一個扭轉角 θ 表示；θ 沿著膠捲要平滑（扭轉是漸進的），解一個三對角的方程（Thomas 演算法）。
  function physFrame(s, b, T) {
    const n = b.n, Ux = [], Vx = [], EPS = 1e-6, PI = Math.PI;
    // 點不等距：每一點的權重乘上它管的長度 hk，相鄰兩點之間的平滑係数 ce = 1.3² / 間距（扭轉在約 1.3 個單位長的範圍內漸進）
    const hk = new Float64Array(n), ce = new Float64Array(n);
    for (let k = 0; k < n; k++) { const a = k > 0 ? b.s[k] - b.s[k - 1] : 0, c = k < n - 1 ? b.s[k + 1] - b.s[k] : 0; hk[k] = Math.max(1e-4, (a + c) / 2); if (k < n - 1) ce[k] = 1.69 / Math.max(1e-4, c); }
    let u = norm(Math.abs(T[0][2]) < 0.9 ? cross(T[0], [0, 0, 1]) : cross(T[0], [0, 1, 0]));
    for (let k = 0; k < n; k++) {
      if (k > 0) { const ax = cross(T[k - 1], T[k]), sn = Math.hypot(ax[0], ax[1], ax[2]); if (sn > 1e-9) u = rotate(u, [ax[0] / sn, ax[1] / sn, ax[2] / sn], dot(T[k - 1], T[k]), sn); }
      const dd = dot(u, T[k]); u = norm([u[0] - T[k][0] * dd, u[1] - T[k][1] * dd, u[2] - T[k][2] * dd]);
      Ux.push(u); Vx.push(cross(T[k], u));
    }
    const ang = (k, w) => Math.atan2(dot(w, Vx[k]), dot(w, Ux[k]));
    const head0 = s.kind === "spoke" ? s.sH0 - 0.05 : Infinity, tg = [];
    for (let k = 0; k < n; k++) {   // 每一點想要的方向：[角度, 權重, 週期（π：正反面都可以；2π：一定要正面）]
      const list = [], k0 = Math.max(0, k - 2), k1 = Math.min(n - 1, k + 2), ds = Math.max(1e-6, b.s[k1] - b.s[k0]);
      const K = [(T[k1][0] - T[k0][0]) / ds, (T[k1][1] - T[k0][1]) / ds, (T[k1][2] - T[k0][2]) / ds], kap = Math.hypot(K[0], K[1], K[2]);
      const wp = 6 * sm(0.08, 0.45, kap);   // 彎曲：寬垂直於彎的方向（彎得越急越要遵守）
      if (wp > 1e-3) list.push([ang(k, norm(cross(T[k], K))), wp, PI]);
      const v = norm([eye0[0] - b.x[k], eye0[1] - b.y[k], eye0[2] - b.z[k]]), wf = cross(v, T[k]), lf = Math.hypot(wf[0], wf[1], wf[2]);
      if (lf > 1e-3) {   // 朝向鏡頭（寬垂直於視線）：一般的地方很輕，頭端很重而且一定是正面
        const af = ang(k, [wf[0] / lf, wf[1] / lf, wf[2] / lf]);
        if (b.s[k] >= head0) list.push([af, 14, PI]); else list.push([af, 0.35 * lf * lf, PI]);   // 頭端正面或背面朝鏡頭都可以（作品格的圖會自己翻正）：硬要正面，膠捲就得在頭端前面翻半圈，會像折到
      }
      tg.push(list);
    }
    const near = (t, th, per) => t + per * Math.round((th - t) / per);
    const th = new Float64Array(n), cp = new Float64Array(n), dp = new Float64Array(n);
    let prev = 0;
    if (tg[0].length) prev = tg[0].reduce((a, q) => (q[1] > a[1] ? q : a))[0];
    for (let k = 0; k < n; k++) { const c0 = k > 0 ? ce[k - 1] : 1; let sw = c0, st = c0 * prev; for (const q of tg[k]) { sw += q[1] * hk[k]; st += q[1] * hk[k] * near(q[0], prev, q[2]); } th[k] = prev = st / sw; }
    for (let it = 0; it < 5; it++) {   // 選最近的那一支（角度有週期）→ 解三對角方程 → 再選、再解
      for (let k = 0; k < n; k++) {
        let w = EPS, t = EPS * th[k];
        for (const q of tg[k]) { w += q[1] * hk[k]; t += q[1] * hk[k] * near(q[0], th[k], q[2]); }
        const cl = k > 0 ? ce[k - 1] : 0, cr = k < n - 1 ? ce[k] : 0, m = w + cl + cr + (k > 0 ? cl * cp[k - 1] : 0);
        cp[k] = -cr / m; dp[k] = (t + (k > 0 ? cl * dp[k - 1] : 0)) / m;
      }
      th[n - 1] = dp[n - 1];
      for (let k = n - 2; k >= 0; k--) th[k] = dp[k] - cp[k] * th[k + 1];
    }
    for (let k = 0; k < n; k++) {
      const c = Math.cos(th[k]), sn = Math.sin(th[k]), Bk = [Ux[k][0] * c + Vx[k][0] * sn, Ux[k][1] * c + Vx[k][1] * sn, Ux[k][2] * c + Vx[k][2] * sn], Nn = cross(T[k], Bk);
      b.bx[k] = Bk[0]; b.by[k] = Bk[1]; b.bz[k] = Bk[2]; b.nx[k] = Nn[0]; b.ny[k] = Nn[1]; b.nz[k] = Nn[2];
    }
    if (DEBUG) {   // ?debug=1：量折痕（在 window.__w9.dbg）：kg＝最大的「往旁邊彎」（1/單位），tw＝最快的扭轉（弧度/單位），at＝在哪裡（0–1）
      let kg = 0, kgAt = 0, tw = 0, twAt = 0;
      for (let k = 2; k < n - 2; k++) {
        const ds = b.s[k + 2] - b.s[k - 2]; if (ds < 1e-4) continue;
        const K = [(T[k + 2][0] - T[k - 2][0]) / ds, (T[k + 2][1] - T[k - 2][1]) / ds, (T[k + 2][2] - T[k - 2][2]) / ds];
        const g2 = Math.abs(K[0] * b.bx[k] + K[1] * b.by[k] + K[2] * b.bz[k]);
        if (g2 > kg) { kg = g2; kgAt = b.s[k] / b.L; }
        const t2 = Math.abs(th[k + 2] - th[k - 2]) / ds;
        if (t2 > tw) { tw = t2; twAt = b.s[k] / b.L; }
      }
      s.dbg = { kind: s.kind, g: s.g, kg: +kg.toFixed(3), kgAt: +kgAt.toFixed(2), tw: +tw.toFixed(2), twAt: +twAt.toFixed(2), head: s.sH0 ? +(s.sH0 / b.L).toFixed(2) : null };
    }
  }
  // 失焦的背景膠捲：沿用舊的做法（寬取切線在畫面上的左手邊，盡量正面朝鏡頭），看不清楚，不必照物理
  function faceFrame(s, b, T) {
    const n = b.n;
    let B = Math.hypot(T[0][0], T[0][1]) > 0.2 ? norm([-T[0][1], T[0][0], 0]) : norm(cross([1, 0, 0], T[0]));
    for (let k = 0; k < n; k++) {
      if (k > 0) { const ax = cross(T[k - 1], T[k]), sn = Math.hypot(ax[0], ax[1], ax[2]); if (sn > 1e-6) B = rotate(B, [ax[0] / sn, ax[1] / sn, ax[2] / sn], dot(T[k - 1], T[k]), sn); }
      if (s.face) {   // 盡量讓正面朝相機（畫面才看得到）：寬取「切線在畫面上的左手邊」，切線幾乎正對相機時沿用上一點的
        const xy = Math.hypot(T[k][0], T[k][1]), wf = Math.min(1, Math.max(0, (xy - 0.12) / 0.3)) * 0.85;
        if (wf > 0) { let Bf = [-T[k][1] / xy, T[k][0] / xy, 0]; if (dot(Bf, B) < 0) Bf = [-Bf[0], -Bf[1], 0]; B = norm([B[0] + (Bf[0] - B[0]) * wf, B[1] + (Bf[1] - B[1]) * wf, B[2] * (1 - wf)]); }
      }
      { const dd = dot(B, T[k]); B = norm([B[0] - T[k][0] * dd, B[1] - T[k][1] * dd, B[2] - T[k][2] * dd]); }
      const ang = (b.tw[k] * Math.PI) / 180, Bk = ang ? rotate(B, T[k], Math.cos(ang), Math.sin(ang)) : B, Nn = cross(T[k], Bk);   // 面的方向：寬在切線左手邊時朝相機（正面）
      b.bx[k] = Bk[0]; b.by[k] = Bk[1]; b.bz[k] = Bk[2]; b.nx[k] = Nn[0]; b.ny[k] = Nn[1]; b.nz[k] = Nn[2];
    }
  }

  /* ---------- 互動 ---------- */
  let ptr = null, ptrV = 0, hoverS = -1, hoverP = -1, kbd = -1, pin = null, lastInput = 0;
  const par = { x: 0, y: 0, vx: 0, vy: 0 };
  const markInput = () => { lastInput = performance.now(); };
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, t = performance.now();
    if (ptr) { const dt = Math.max(8, t - ptr.t) / 1000; ptrV = ptrV * 0.6 + (Math.hypot(x - ptr.x, y - ptr.y) / dt) * 0.4; }
    ptr = { x, y, t, touch: e.pointerType !== "mouse" }; markInput(); wake();
  });
  stage.addEventListener("pointerleave", () => { ptr = null; ptrV = 0; wake(); });
  // 手機、平板沒有滑鼠：點一下作品格，那一格浮起來、資料恢復 2.8 秒（鏡頭不跟著手指跑，捲動頁面時才不會晃）
  stage.addEventListener("pointerdown", (e) => {
    const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    ptr = { x, y, t: performance.now(), touch: e.pointerType !== "mouse" }; markInput();
    if (ptr.touch) { let best = 1e9, hit = -1; TEAM.forEach((tm) => { if (tm.poly && tm.on && tm.z < best && inPoly(tm.poly, x, y)) { best = tm.z; hit = tm.i; } }); if (hit >= 0) pin = { i: hit, until: performance.now() + 2800 }; }
    wake();
  });
  // 鍵盤：15 組的清單（給讀屏軟體，看不到）每一格都可以用 Tab 選到，選到哪一組，畫面上那一格就浮起來、資料恢復
  roomEls.forEach((li, i) => {
    li.addEventListener("focus", () => { kbd = i; markInput(); wake(); });
    li.addEventListener("blur", () => { if (kbd === i) kbd = -1; wake(); });
  });
  ["keydown", "wheel", "scroll"].forEach((ev) => window.addEventListener(ev, markInput, { passive: true }));
  function kick(s, at, amp) { s.live = true; const sig = Math.max(3, (s.hw / s.sp) * 0.9); for (let k = Math.max(1, (at - 4 * sig) | 0); k < Math.min(s.b.n - 1, at + 4 * sig); k++) s.vel[k] += amp * Math.exp(-((k - at) * (k - at)) / (sig * sig)); }
  function physics(s, dt) {
    if (!s.live) return;
    // 每一小步最多 0.007 秒（這組參數的穩定上限約 0.0125 秒；電腦慢、一格拖很久時也不會爆掉）
    const n = s.b.n, d = s.disp, v = s.vel, c2 = 80 * 80, k0 = 34, damp = 3.6, steps = Math.max(4, Math.ceil(dt / 0.007)), h = dt / steps;
    for (let st = 0; st < steps; st++) {
      for (let i = 1; i < n - 1; i++) v[i] += (c2 * (d[i - 1] + d[i + 1] - 2 * d[i]) - k0 * d[i] - damp * v[i]) * h;
      for (let i = 1; i < n - 1; i++) d[i] += v[i] * h;
      d[0] = v[0] = d[n - 1] = v[n - 1] = 0;
    }
    let e = 0; for (let i = 0; i < n; i++) e = Math.max(e, Math.abs(d[i]), Math.abs(v[i]) * 0.1);
    if (e < 1e-4 || !(e < 5)) { d.fill(0); v.fill(0); s.live = false; }
  }
  function inPoly(P, x, y) {   // 點在多邊形裡（射線法）
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; }
    return c;
  }

  /* ---------- 每一格 ---------- */
  const LX = -0.38, LY = 0.72, LZ = 0.58, LN = Math.hypot(LX, LY, LZ), Lx = LX / LN, Ly = LY / LN, Lz = LZ / LN;
  let buf = new Float32Array(1 << 19), o = 0;
  function put(x, y, z, u, v, seed, sh, a, ar, sp, hz, bl, tint, tu, hu, fl, arT, cool) {
    if (buf.length - o < NF * 4) { const nb = new Float32Array(buf.length * 2); nb.set(buf); buf = nb; }
    buf[o] = x; buf[o + 1] = y; buf[o + 2] = z; buf[o + 3] = u; buf[o + 4] = v; buf[o + 5] = seed; buf[o + 6] = sh; buf[o + 7] = a; buf[o + 8] = ar;
    buf[o + 9] = sp; buf[o + 10] = hz; buf[o + 11] = bl; buf[o + 12] = tint; buf[o + 13] = tu; buf[o + 14] = hu; buf[o + 15] = fl; buf[o + 16] = arT; buf[o + 17] = cool; o += NF;
  }
  let T0 = 0, tPrev = 0, lastDraw = 0, raf = 0, visible = true, started = false, open = REDUCE ? 1 : 0, dbgMs = 0, wasBusy = true, prevGap = 31, seenSet = SEEN, qHold = 0;
  function applyQ() { DPR = DPR0 * QF; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
  const tmp = [0, 0, 0], tmp2 = [0, 0, 0];
  const camD = (x, y, z) => { const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2]; return dx * dx + dy * dy + dz * dz; };
  const quiet = (s) => s.kind === "arm" || s.kind === "far";   // 背景：不理滑鼠、不變暗

  function frame(now) {
    raf = 0;
    if (!started) return;
    // 最多每秒 30 格；8 秒沒有操作、畫面上又沒有東西在動（開場、彈簧、波、資料恢復）時，每秒 15 格就夠（省電）
    const gap = !wasBusy && arrDone && now - lastInput > 8000 ? 64 : 31;
    if (!REDUCE && now - lastDraw < gap) { schedule(); return; }
    // 自動畫質：連續 24 格的間隔，中位數超過 46 毫秒（每秒不到 22 格），解析度降一級（最低 0.55 倍）
    if (!REDUCE && lastDraw && now - lastDraw < 500 && gap === 31 && prevGap === 31 && now - T0 > 2500 && now > qHold) {
      qSamp.push(now - lastDraw);
      if (qSamp.length >= 24) {
        const med = qSamp.slice().sort((a, b) => a - b)[12]; qSamp.length = 0;
        if (med > 46 && QF > 0.56) { QF = Math.max(0.55, QF * 0.8); applyQ(); qHold = now + 1500; }
      }
    }
    prevGap = gap; lastDraw = now;
    const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now;
    const t = (now - T0) / 1000, el = REDUCE ? 100 : t, elo = el * OSP;
    let busy = false;
    // 從首頁進來：先停在主時間線的一格裡 0.3 秒（畫布從深藍淡入，看得出「在膠捲裡」），再往外拉（2.6 秒，先快後慢）；拉到七成時頂列和介紹浮出來
    let arrK = 0;
    if (ARR && !arrDone) {
      const u = Math.min(1, Math.max(0, (el - 0.3) / 2.6)), e0 = u * u * (3 - 2 * u), e = 0.35 * e0 + 0.65 * (1 - Math.pow(1 - u, 2)), Z = Math.exp(Math.log(ARR.Z0) * (1 - e));
      arrK = (Z - 1) / (ARR.Z0 - 1);
      ZM.on = false; const q = project(ARR.P, [0, 0, 0], true), nx = (q[0] - W / 2) / (W / 2), ny = -(q[1] - H / 2) / (H / 2);
      ZM.on = true; ZM.Z = Z; ZM.bx = ARR.ax * arrK - Z * nx * arrK; ZM.by = ARR.ay * arrK - Z * ny * arrK;
      if (!document.documentElement.classList.contains("w9-out")) document.documentElement.classList.add("w9-out");   // 畫布從深藍淡入
      if (u > 0.7) document.documentElement.classList.remove("w9-arrive");
      if (u >= 1) { arrDone = true; ZM.on = false; document.documentElement.classList.remove("w9-arrive", "w9-out"); }
      busy = true;
    } else if (!arrDone) { arrDone = true; ZM.on = false; document.documentElement.classList.remove("w9-arrive", "w9-out"); }
    // 鏡頭：沒有滑鼠時很慢地自己飄；有滑鼠就跟著
    if (!REDUCE) {
      let tx = 0.28 * Math.sin(el * 0.17), ty = 0.18 * Math.sin(el * 0.13 + 1.3);
      if (ptr && !ptr.touch && arrDone) { tx = (ptr.x / W - 0.5) * 1.0; ty = -(ptr.y / H - 0.5) * 0.7; }
      // 彈簧：稍微超過一點再回來（比直接滑過去有彈性）
      par.vx += (9 * (tx - par.x) - 4.4 * par.vx) * dt; par.vy += (9 * (ty - par.y) - 4.4 * par.vy) * dt;
      par.x += par.vx * dt; par.y += par.vy * dt;
      eye[0] = par.x * PAR * (1 - arrK); eye[1] = par.y * PAR * (1 - arrK);   // 拉出來的時候鏡頭不飄（放大很多倍，一飄就晃得很厲害）
      open = easeOut((elo - 0.3) / 1.0);
    }
    // 進場：長過作品格，那一格才顯影
    S.forEach((s) => {
      if (!REDUCE) { s.reveal = easeOut((elo - s.start) / (s.grow || 1)); if (s.reveal < 1) busy = true; }
    });
    if (!busy && !seenSet) { seenSet = true; try { sessionStorage.setItem("w9-seen", "1"); } catch (e) { /* 存不了就算了 */ } }
    TEAM.forEach((tm) => {   // 送到定位：最靠尖端的那一格先亮，亮的時候彈一下
      const s = tm.s, lead = s.rev ? tm.j : 2 - tm.j;
      if (!tm.on && s.reveal >= 0.975 + 0.008 * lead) { tm.on = true; if (!REDUCE) kick(s, Math.round((s.kF[tm.j] + s.kF[tm.j + 1]) / 2), 0.2); }
    });
    // 滑鼠：先看作品格（最前面的），再看膠捲
    let hp = -1;
    if (ptr && !ptr.touch && arrDone) { let best = 1e9; TEAM.forEach((tm) => { if (tm.poly && tm.on && tm.z < best && inPoly(tm.poly, ptr.x, ptr.y)) { best = tm.z; hp = tm.i; } }); }
    if (hp < 0 && pin && now < pin.until && TEAM[pin.i].on) hp = pin.i;   // 手機上點了一下
    if (hp < 0 && kbd >= 0 && TEAM[kbd] && TEAM[kbd].on) hp = kbd;           // 鍵盤選到
    if (hp !== hoverP) { if (hp >= 0 && !REDUCE) { const s = TEAM[hp].s; kick(s, Math.max(2, s.kF[0] - Math.round(0.9 / s.sp)), -0.45); } hoverP = hp; }
    let hs = -1, hat = 0;
    if (ptr && !ptr.touch && hp < 0 && arrDone) {
      let bz = 1e9;
      S.forEach((s, i) => { if (quiet(s) || !s.nVis) return; for (let k = 0; k < s.nVis; k += 2) { const dx = s.scr[k] - ptr.x, dy = s.scrY[k] - ptr.y; if (s.scrR[k] > 0 && dx * dx + dy * dy < s.scrR[k] * s.scrR[k] && -s.pz[k] < bz) { bz = -s.pz[k]; hs = i; hat = k; } } });
    }
    if (hs !== hoverS) { if (hs >= 0 && !REDUCE) kick(S[hs], hat, -0.45 - Math.min(0.35, ptrV * 0.0005)); hoverS = hs; }
    else if (hs >= 0 && !REDUCE && ptrV > 80 && now - ptr.t < 60) kick(S[hs], hat, -0.05 * dt * 60);
    const focusS = hoverP >= 0 ? S.indexOf(TEAM[hoverP].s) : hoverS;
    S.forEach((s, i) => {
      const target = focusS < 0 || quiet(s) ? 0 : i === focusS ? 1 : -0.5;
      s.hl += (target - s.hl) * Math.min(1, dt * 7);
      if (Math.abs(target - s.hl) > 0.01) busy = true;
      if (!REDUCE) { physics(s, dt); s.scroll += dt * s.v * (1 + Math.max(0, s.hl) * 1.8); }
      if (s.live) busy = true;
    });
    TEAM.forEach((tm) => {
      const target = hoverP < 0 ? 0 : tm.i === hoverP ? 1 : -0.35;
      if (REDUCE) tm.hl = target;
      else { tm.hv = (tm.hv || 0) + (170 * (target - tm.hl) - 15 * (tm.hv || 0)) * dt; tm.hl += tm.hv * dt; if (Math.abs(tm.hv) > 0.01) busy = true; }   // 彈簧：浮起來時稍微彈一下
      if (!REDUCE) tm.dev += ((tm.on ? 1 : 0) - tm.dev) * Math.min(1, dt * 2.2); else tm.dev = 1;
      if (Math.abs(target - tm.hl) > 0.01 || Math.abs((tm.on ? 1 : 0) - tm.dev) > 0.01) busy = true;
      const want = tm.i === hoverP ? 1 : 0;   // 資料恢復：0.45 秒補齊，移開後 2.4 秒慢慢缺回去
      if (REDUCE) tm.rec = want; else { tm.rec = want > tm.rec ? Math.min(1, tm.rec + dt * 2.2) : Math.max(0, tm.rec - dt * 0.42); if (tm.rec > 0 && tm.rec < 1) busy = true; }
      TEAMU[tm.i * 3] = tm.dev; TEAMU[tm.i * 3 + 1] = tm.hl; TEAMU[tm.i * 3 + 2] = tm.rec;
      if (tm.on && !tm.li.classList.contains("is-on")) tm.li.classList.add("is-on");
    });

    // 幾何：膠捲每 10 點切一段，由遠到近排
    const items = [], tG = DEBUG ? performance.now() : 0;
    o = 0;
    S.forEach((s) => {
      const b = s.b, n = b.n, spoke = s.kind === "spoke", tms = spoke ? TEAM.filter((q) => q.s === s) : null;
      s.nVis = s.reveal <= 0 ? 0 : s.reveal >= 1 ? n : Math.max(2, Math.min(n, (() => { const tipS = s.reveal * b.L; let k = 0; while (k < n - 1 && b.s[k] < tipS) k++; return k + 1; })()));
      s.scrR.fill(0);
      if (!s.nVis) return;
      const tip = b.s[s.nVis - 1], dir = s.v < 0 ? -1 : 1, lift = 1 + 0.25 * Math.max(0, s.hl) - 0.15 * Math.max(0, -s.hl);
      const wa = REDUCE ? 0 : 0.05 + 0.05 * s.blur, wd = REDUCE ? 0 : 0.12 + 0.2 * s.blur;
      // 從裂縫送出來（帶作品的、鐘塔那條）：還沒送完時，膠捲上的內容跟著尖端走（作品格一路轉出來），尖端是片頭、不淡出
      const fed = (spoke || s.kind === "hero") && !REDUCE && s.reveal < 1, shift = fed ? b.L - tip : 0;
      for (let k = 0; k < s.nVis; k++) {
        const sk = b.s[k], f = sk / b.L;
        // 接著裂縫、頭端的地方不晃（作品格保持平穩，字才看得清楚）
        const pin = spoke ? sm(0, 0.1, f) * (1 - sm(s.sH0 - 1.4 * LT, s.sH0 - 0.25 * LT, sk)) : s.kind === "trunk" ? 1 - sm(0.82, 1, f) : 1;
        const sw = wa * pin * (0.68 * Math.sin(0.6 * sk - dir * 0.5 * el + s.phase) + 0.32 * Math.sin(1.27 * sk + dir * 0.23 * el + s.phase * 2.3));
        const dz = wd * pin * (0.7 * Math.sin(0.42 * sk - dir * 0.36 * el + s.phase * 1.7) + 0.3 * Math.sin(0.9 * sk + 0.29 * el + s.phase * 0.6));
        let dd = s.phys ? 0 : sw + s.disp[k], dn = s.phys ? dz + s.disp[k] : dz;   // 物理的膠捲只往正反面晃（不在自己的平面裡往旁邊晃）
        if (spoke && !REDUCE) {   // 頭端輕輕浮動（各條不同步）：上下浮一點、前後浮一點、沿著頭端一道很淺的波
          const hm = sm(s.sH0 - 3.2, s.sH0 - 0.4, sk);
          dd += hm * 0.07 * Math.sin(0.47 * el + s.phase);
          dn += hm * (0.16 * Math.sin(0.33 * el + s.phase * 1.7) + 0.06 * Math.sin(0.95 * sk - 0.9 * el + s.phase));
          const fe = sm(tip - 1.6, tip, sk);   // 自由端（離尖端 1.6 個單位內）：越靠尖端擺得越多，像旗子的尾巴（只往正反面擺）
          if (fe > 0) dn += fe * fe * (0.13 * Math.sin(1.7 * sk - 2.2 * el + s.phase) + 0.05 * Math.sin(3.3 * sk - 3.1 * el + s.phase * 0.7));
        }
        let px = b.x[k] + b.bx[k] * dd + b.nx[k] * dn, py = b.y[k] + b.by[k] * dd + b.ny[k] * dn, pz = b.z[k] + b.bz[k] * dd + b.nz[k] * dn;
        let vx = eye[0] - px, vy = eye[1] - py, vz = eye[2] - pz; const vl = Math.sqrt(vx * vx + vy * vy + vz * vz); vx /= vl; vy /= vl; vz /= vl;
        const fdot = b.nx[k] * vx + b.ny[k] * vy + b.nz[k] * vz, sg = fdot < 0 ? -1 : 1;
        const fx = b.nx[k] * sg, fy = b.ny[k] * sg, fz = b.nz[k] * sg;
        if (spoke) {   // 滑鼠移上去：那一格往鏡頭浮起來
          let bump = 0;
          for (const tm of tms) if (tm.hl > 0) { const g2 = (sk - (s.sH0 + (tm.j + 0.5) * s.pitch)) / (s.pitch * 0.6); bump += 0.45 * tm.hl * Math.exp(-g2 * g2); }
          if (bump > 0) { px += fx * bump; py += fy * bump; pz += fz * bump; }
        }
        s.px[k] = px; s.py[k] = py; s.pz[k] = pz;
        const diff = Math.max(0, fx * Lx + fy * Ly + fz * Lz);
        if (s.blur < 0.2) {   // 反光（失焦的不算）：x^48 用連乘（比 Math.pow 快）
          const hx = Lx + vx, hy = Ly + vy, hz = Lz + vz, c1 = Math.max(0, (fx * hx + fy * hy + fz * hz) / Math.sqrt(hx * hx + hy * hy + hz * hz));
          const c2 = c1 * c1, c4 = c2 * c2, c8 = c4 * c4, c16 = c8 * c8;
          s.spec[k] = c16 * c16 * c16 * 0.3 * (1 - s.blur);
          if (s.phys) { const rx = RIFT[0] - px, ry = RIFT[1] - py, rz = RIFT[2] - pz; s.spec[k] += 0.22 * Math.exp(-(rx * rx + ry * ry + rz * rz) / 60); }   // 裂縫的暖光從背後透過底片（越靠近裂縫越亮）
        } else s.spec[k] = 0;
        const shade = ((0.58 + 0.5 * diff) / 0.87) * (0.8 + 0.2 * Math.min(1, Math.abs(fdot) * 3)) * lift;
        s.sh[k] = sg > 0 ? shade : -shade * 0.9;
        const root = spoke ? Math.min(1, sk / 2.5) : s.kind === "arm" ? Math.min(1, sk / 1.5) : 1;   // 從裂縫裡長出來：根部淡入
        const tail = spoke ? 1 : s.kind === "trunk" ? sm(0, 0.16, f) * (1 - sm(0.9, 1, f) * 0.9) : s.kind === "hero" ? sm(0, 0.06, f) * (1 - sm(0.82, 1, f)) : Math.min(1, (1 - f) * 6);
        s.al[k] = (fed ? 1 : Math.max(0, Math.min(1, (tip - sk) / 1.2 + (s.reveal >= 1 ? 1 : 0)))) * root * tail * (s.kind === "arm" ? 0.85 : s.kind === "far" ? 0.75 : 1);
        s.hz[k] = Math.min(0.55, s.blur * 0.5 + Math.max(0, vl - 13) * 0.02);
        s.bv[k] = Math.min(0.6, s.blur + Math.max(0, vl - 17) * 0.012);
        let cool = 0;   // 作品格的淡藍光：離每條頭端中間越近越亮（作品格自己不算；失焦的背景太遠，不算）
        if (!quiet(s) && !(spoke && sk + shift >= s.sH0 - 0.05)) for (const c of HC) { const ex = px - c[0], ey = py - c[1], ez = pz - c[2]; cool += Math.exp(-(ex * ex + ey * ey + ez * ez) / 2.6); }
        s.cl[k] = Math.min(1, cool);
      }
      const ar = s.cell / (s.hw * 2), g = 0.4 * Math.max(0, s.hl);
      const emit = (glow) => {
        const first = o / NF, w = s.hw * (glow ? 2.15 : 1 + 0.05 * Math.max(0, s.hl)), v0 = glow ? -0.575 : 0, v1 = glow ? 1.575 : 1;
        for (let k = 0; k < s.nVis; k++) {
          const sk = b.s[k], sp = glow ? 0 : s.spec[k];
          // 一般畫格：剛好接到頭端的第一格（頭端是膠捲上連著的三格）；齒孔一直排下去
          const sc = sk + shift;   // 膠捲上的內容的位置（送出來的時候跟著尖端走）
          const u = spoke ? (sc < s.sH0 ? (sc - s.sH0) / s.cell : 0) : sc / s.cell - s.scroll;
          const tu = spoke ? (sc - s.sH0) / s.pitch : -99, hu = spoke ? sc / s.cell : u;
          put(s.px[k] + b.bx[k] * w, s.py[k] + b.by[k] * w, s.pz[k] + b.bz[k] * w, u, v0, s.seed, s.sh[k], s.al[k], ar, sp, s.hz[k], s.bv[k], s.tint, tu, hu, s.flags, s.arT, s.cl[k]);
          put(s.px[k] - b.bx[k] * w, s.py[k] - b.by[k] * w, s.pz[k] - b.bz[k] * w, u, v1, s.seed, s.sh[k], s.al[k], ar, sp, s.hz[k], s.bv[k], s.tint, tu, hu, s.flags, s.arT, s.cl[k]);
        }
        return first;
      };
      const STEP = 10;
      const chunks = (first, kind, extra) => {   // 頭端每一格自己一塊，排的時候當作近一點（旁邊轉彎上來的膠捲不會蓋到它）
        const last = s.nVis - 1, cuts = spoke ? [0, ...s.kF.filter((k) => k > 0 && k < last), last] : [0, last];
        for (let c = 0; c < cuts.length - 1; c++) {
          const a = cuts[c], z = cuts[c + 1], team = spoke && a >= s.kF[0], step = team ? z - a : STEP;
          for (let j = a; j < z; j += step) {
            const j1 = Math.min(z, j + step), m = (j + j1) >> 1;
            let key = camD(s.px[m], s.py[m], s.pz[m]);
            if (team) { const dd = Math.max(0.5, Math.sqrt(key) - 1.4); key = dd * dd; }
            items.push(Object.assign({ kind, first: first + 2 * j, count: 2 * (j1 - j + 1), key, dw: kind === 1 && !quiet(s) }, extra));
          }
        }
      };
      if (g > 0.02) chunks(emit(true), 0, { glow: g });
      chunks(emit(false), 1, null);
      if (!quiet(s)) for (let k = 0; k < s.nVis; k += 2) {   // 螢幕上的位置（給滑鼠判斷）
        tmp2[0] = s.px[k]; tmp2[1] = s.py[k]; tmp2[2] = s.pz[k]; project(tmp2, tmp); const x0 = tmp[0], y0 = tmp[1];
        tmp2[0] += b.bx[k] * s.hw; tmp2[1] += b.by[k] * s.hw; tmp2[2] += b.bz[k] * s.hw; project(tmp2, tmp);
        s.scr[k] = x0; s.scrY[k] = y0; s.scrR[k] = Math.hypot(tmp[0] - x0, tmp[1] - y0) * 1.05;
      }
      if (spoke) for (const tm of tms) {   // 每一格作品格在畫面上的外框（給滑鼠判斷）
        const k0 = s.kF[tm.j], k1 = s.kF[tm.j + 1];
        if (s.nVis - 1 < k1) { tm.poly = null; continue; }
        const Lp = [], Rp = [], stp = Math.max(1, ((k1 - k0) / 6) | 0);
        for (let k = k0; ; k = Math.min(k1, k + stp)) {
          tmp2[0] = s.px[k] + b.bx[k] * s.hw; tmp2[1] = s.py[k] + b.by[k] * s.hw; tmp2[2] = s.pz[k] + b.bz[k] * s.hw; project(tmp2, tmp); Lp.push([tmp[0], tmp[1]]);
          tmp2[0] = s.px[k] - b.bx[k] * s.hw; tmp2[1] = s.py[k] - b.by[k] * s.hw; tmp2[2] = s.pz[k] - b.bz[k] * s.hw; project(tmp2, tmp); Rp.push([tmp[0], tmp[1]]);
          if (k === k1) break;
        }
        tm.poly = Lp.concat(Rp.reverse());
        const k = s.kM[tm.j]; tmp2[0] = s.px[k]; tmp2[1] = s.py[k]; tmp2[2] = s.pz[k]; project(tmp2, tmp);
        tm.cx = tmp[0]; tm.cy = tmp[1]; tm.z = Math.sqrt(camD(s.px[k], s.py[k], s.pz[k]));
      }
    });
    items.sort((a, b) => b.key - a.key);
    HDU.fill(0);
    S.forEach((q) => {
      if (q.kind !== "spoke") return;
      const ts = TEAM.filter((tm) => tm.s === q && tm.poly); if (ts.length < 3) return;
      const a = ts.find((tm) => tm.j === 0), c = ts.find((tm) => tm.j === 1), z = ts.find((tm) => tm.j === 2);
      HDU.set([c.cx, c.cy, Math.hypot(a.cx - z.cx, a.cy - z.cy) * 0.62 + 24], q.g * 3);
    });
    if (DEBUG) { const ms = performance.now() - tG; dbgMs = dbgMs ? dbgMs * 0.9 + ms * 0.1 : ms; }

    // 畫：由遠到近畫（半透明的邊才混得對）＋深度緩衝（遮擋逐像素正確：後面的膠捲不會畫到前面的上面）。
    // 失焦的背景和光暈不寫深度
    gl.viewport(0, 0, cv.width, cv.height);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(PB.p); gl.bindVertexArray(bgVao);
    project(RIFT, tmp);
    gl.uniform2f(PB.u.uRes, cv.width, cv.height); gl.uniform2f(PB.u.uRift, tmp[0], tmp[1]); gl.uniform1f(PB.u.uDpr, DPR);
    gl.uniform1f(PB.u.uTime, REDUCE ? 0 : el); gl.uniform1f(PB.u.uOpen, open); gl.uniform1f(PB.u.uZoom, ZM.on ? ZM.Z : 1); gl.uniform3fv(PB.u["uHd[0]"], HDU);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, o), gl.DYNAMIC_DRAW);
    const VP = vpMatrix();
    for (const P of [PF, PG]) {
      gl.useProgram(P.p); gl.uniformMatrix4fv(P.u.uVP, false, VP);
      if (P.u.uHaze) gl.uniform3f(P.u.uHaze, 0.12, 0.155, 0.29);
      if (P.u.uTime) gl.uniform1f(P.u.uTime, REDUCE ? 0 : el);
      if (P.u["uTints[0]"]) gl.uniform3fv(P.u["uTints[0]"], TINTS);
      if (P.u["uTeam[0]"]) gl.uniform3fv(P.u["uTeam[0]"], TEAMU);
      if (P.u.uAtlas) gl.uniform1i(P.u.uAtlas, 0);
      if (P.u.uTex) gl.uniform1i(P.u.uTex, 1);
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, portalTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    let cur = null, dw = null;
    for (const d of items) {
      const P = d.kind === 0 ? PG : PF;
      if (cur !== P) { gl.useProgram(P.p); cur = P; gl.blendFunc(gl.ONE, d.kind === 0 ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); }
      if (dw !== d.dw) { gl.depthMask(d.dw); dw = d.dw; }
      if (d.kind === 0) gl.uniform1f(PG.u.uGlow, d.glow);
      gl.drawArrays(gl.TRIANGLE_STRIP, d.first, d.count);
    }
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.depthMask(true);

    wasBusy = busy || TEAM.some((tm) => tm.hl > 0.02) || S.some((q) => q.live);
    if (REDUCE) { if (busy) schedule(); }
    else schedule();
    window.__w9 = { t, hoverP, hoverS, n: S.length, items: items.length, teams: TEAM.map((tm) => [Math.round(tm.cx), Math.round(tm.cy)]) };
    if (DEBUG) { window.__w9.dbg = S.filter((q) => q.dbg).map((q) => q.dbg); window.__w9.ms = +dbgMs.toFixed(2); window.__w9.verts = o / NF; window.__w9.cross = window.__w9x; window.__w9.pierce = window.__w9p; window.__w9.q = QF; window.__w9.fps = gap === 31 ? 30 : 15; window.__w9.pin = pin && [pin.i, Math.round(pin.until - now)]; window.__w9.ptr = ptr && [ptr.touch, Math.round(ptr.x), Math.round(ptr.y)]; }
  }
  function schedule() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function wake() { schedule(); }
  function ready() { if (!started) begin(); }
  function begin() { if (started) return; started = true; T0 = tPrev = performance.now(); if (REDUCE) roomEls.forEach((r) => r.classList.add("is-on")); wake(); }
  setTimeout(begin, SEEN ? 300 : 900);
  // ?debug=1：量每一格畫完要多久（含顯示卡：每一格之後讀回一個像素，等它真的畫完）。__w9bench(格數, 解析度倍數)
  if (DEBUG) window.__w9bench = (n = 40, q) => {
    if (!started) begin();
    const keep = QF; if (q) { QF = q; applyQ(); }
    const px = new Uint8Array(4), ts = [], size = cv.width + "x" + cv.height;
    for (let i = 0; i < n; i++) { const a = performance.now(); lastDraw = -1e9; frame(a); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ts.push(performance.now() - a); }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    QF = keep; applyQ(); schedule();
    ts.sort((a, b) => a - b);
    return { median: +ts[n >> 1].toFixed(2), p90: +ts[Math.floor(n * 0.9)].toFixed(2), canvas: size };
  };

  layout();
  let lw = W, lh = H;
  new ResizeObserver(() => { if (stage.clientWidth !== lw || stage.clientHeight !== lh) { lw = stage.clientWidth; lh = stage.clientHeight; layout(); lastDraw = 0; wake(); } }).observe(stage);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) { tPrev = performance.now(); wake(); } }).observe(stage);
  document.addEventListener("visibilitychange", () => { qSamp.length = 0; if (!document.hidden) { tPrev = performance.now(); wake(); } });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); drawPortals(); lastDraw = 0; wake(); });
})();
