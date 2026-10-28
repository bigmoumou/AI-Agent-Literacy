/* 首頁 Week 9「時空密室」那一格：畫格變成一扇窗，窗裡很多條膠捲（平行的時空線）一層一層橫向流過去。
   照老師 2026-10-22 給的參考圖做（製作/week09/cover/reference-flow.jpg）：
   - 一條很寬的主膠捲橫過整個窗口、輕輕起伏，畫格大、看得清楚；
   - 左上、右上各一條中景的膠捲斜斜穿過；
   - 後面很多條小的、失焦模糊、偏藍紫的膠捲在不同高度流過去（景深）；
   - 每條膠捲上的畫格輪流是不同時代的場景；「WEEK 09 · MIDTERM」「準備中」壓在膠捲上面。
   - 畫格就是參考圖裡的插畫：製作/week09/cover/make_frames_atlas.py 把它們一格一格切出來、拉正，拼成 assets/week9-frames.webp
     （4×3；前 9 格清楚，後 3 格城堡夜景原圖太小、比較糊，只給失焦的背景膠捲用）。圖還沒到或載入失敗時，用 timeline-scenes.js 程式畫的場景。
   老師另外要的：上下大膽衝出去，一直都在，畫格要清楚；而且要「從裡面連出去、再連回裡面」：上面那條從窗口左上裡面出去、
   在畫格前面拱過膠捲上緣、從右邊回到窗口裡；下面那條從右下出去、拱過下緣、回到左下。連出去的那段在最上層。
   - 位置、寬度變化都照參考圖量（ref(x, y, 深度, 翻轉)）：膠捲中間靠近、兩端退向深處並翻過去，畫格跟著變小、變斜，才有參考圖的立體感。
   之前的版本（從窗裡深處飛出來、黑色漩渦）和老師每一輪的意見記在 製作/week09/README.md。
   - 跟首頁的膠捲畫在同一個 WebGL 畫面（assets/home.js），同一個相機和投影。
     位置用「那一格的座標」寫：X 以一格的寬為 1、Y 以膠捲的高為 1（±0.5 是膠捲上下緣）、D 是離圓柱面多遠（世界單位，負的在前面）。
     畫格的畫面（窗口）是 X ±0.461、Y ±0.346。at(sx, sy, d) 用「正中間時畫面上落在哪裡」反算回那一格的座標（深的東西會往中間縮）。
   - 每條帶子是真的 3D 帶子：沿著曲線用「不亂轉的框架」決定寬的方向；每個點照光（從左上前方來），翻到背面時畫面左右相反、暗一點，彎的地方有反光。
   - 首頁的畫布沒有深度緩衝，前後這樣處理：
     · D > 0（膠捲後面）的段落畫兩次：畫格之前畫一次（只看得到膠捲上下緣外面的部分），畫格之後再畫一次、只留窗口裡的部分
       （每個頂點算出「從相機看過去落在畫格上的哪裡」，在著色器裡裁掉窗口外面的）。所以穿過膠捲的地方一定要在窗口裡或上下緣外面。
     · D ≤ 0 的段落最後畫；同一層裡每 8 個點切一段，由遠到近排序再畫，交叉的地方前後才對。
     · 前面的帶子在 Week 9 那一格的膠捲上投下影子（只投在這一格）。
     · 兩行字另外畫一次，疊在窗口裡的膠捲上面、前面的帶子下面。
     · 最上層 "top"（首頁膠捲前面的道具之後）：先畫連出去的那幾段（D ≤ 0），再畫主膠捲（老師：中間那條圖層最高），最後兩行字。
   - 景深：越深越模糊（齒孔和邊緣變軟、畫面取比較糊的那一層貼圖）、越接近深藍的霧。
   - 平行時空（老師 2026-10-22：「多重平行時空感不夠強」）：
     · 每條膠捲的時間走法不一樣：走片方向、速度各不相同（有的往回走）。
     · 鐘塔畫格的指針由著色器即時畫：每個鐘各走各的時間、速度不同，有的倒著走（同一座鐘、不同的時間）。
       鐘塔在主膠捲上每三格一個（正中間那格一開始是鐘塔），在上下兩條每四格一個；鐘面沒有指針的圖由 製作/week09/cover/make_clock_tiles.py 產生。
     · 背景每條帶一點自己的色調（青、紫、琥珀、藍、綠），像不同的世界。
     · 前景（主膠捲、上下兩條）在後面的膠捲上投下柔和的暗影，前後層次更清楚。
   - 效能：圓柱座標和窗口裁切在頂點著色器裡算（JS 只給「那一格的座標」）；每一格只算一次、只上傳一次，三層共用；
     光暈只在滑鼠碰到那一條時才畫；深度一樣的背景膠捲整條一次畫完，只有前後穿插的才切段排序。
   - 視差：滑鼠在這一格上移動時，深處的東西相對窗口移一點、前面的反方向移一點（膠捲那一面不動）；沒有滑鼠時很慢地自己飄。
   - 一直慢慢走片；每條都有沿著走片方向前進的慢波（平面上和前後各一道），像水裡的緞帶；
     滑鼠碰到一條（清楚的那幾條），從碰到的點起一個小波往兩邊傳開（彈簧鏈），那一條稍微變亮。
   - 全部一直都在（第一次看到時，窗口裡的慢慢長出來；衝出去的兩條一開始就在）。全部留在 Week 9 這一格的寬度裡，不蓋到左右兩格。兩端都淡出，不會硬切。
   - 減少動態效果：停在完成的畫面，不擺、不走片、不起波。
   window.TimelineArt.create(gl, { R, TH, H, reduceMotion, scale, labels, frames }) → { draw(layer, ctx), step(now, angle), pointer(x, y), reset() }
   frames：{ img, cols, rows, tw, th, pad, sharp, clock, crop }（sharp：前幾格是清楚的；clock：鐘塔從第幾格起 4 格；
   crop：鐘塔畫格從 330×220 的原圖裁了哪一塊 [x0, 寬, 高]，指針要對準鐘心）；沒有就用程式畫的場景（鐘上已經有指針，就不另外畫）。 */
(function () {
  "use strict";

  /* 時空線。p 是控制點 [X, Y, D]；w 是寬（膠捲高的幾分之幾）；theme 是畫格順序的種子（每條膠捲輪流出現不同時代）；v 是走片速度；
     start 是長出來的先後（秒）；fixed：一直都在（不長出來）；face：盡量讓正面朝相機（拱的腳才不會轉成側面）；
     blur：失焦程度（0 清楚～1 很糊）；root：根部淡入的長度；sp：取樣間距；tint：背景的色調（0 不調、1 青、2 紫、3 琥珀、4 藍、5 綠）；
     drop：在後面的膠捲上投暗影；v 是走片速度（負的往回走）；wa、wd：波動的幅度（平面上、前後，世界單位，沒寫就照失焦程度給）。
     規則：D 從負變正（穿過膠捲那一面）的地方，要嘛在窗口裡，要嘛在膠捲上下緣外面；前面的部分在畫面上 X 留在 ±0.44 裡。
     排列順序就是滑鼠判斷的先後：越前面的越後面寫。 */
  const at = (sx, sy, d) => { const k = 7.5 / (7.5 + d); return [sx / k, (sy - 0.043) / k + 0.043, d]; };   // 相機離膠捲 7.5、在膠捲中線上方一點
  // 參考圖（1320×1016）的像素座標 → 正中間時的畫面位置：參考圖的窗口是 x 15～1305、y 195～835，對到我們的窗口 X ±0.461、Y ±0.346。
  // 第四個數是翻轉的角度（度）：膠捲沿著長的方向轉，畫面就斜著看、變窄（參考圖裡膠捲兩端往深處退、翻過去的樣子）。
  const ref = (x, y, d, tw = 0) => at((0.461 * (x - 660)) / 645, (0.346 * (515 - y)) / 320, d).concat([tw]);
  /* 2026-10-22 照參考圖量的（每條膠捲上下緣在幾個 x 的位置）：
     - 主膠捲：中間（x 660）最靠近、約 270 像素高，往兩邊退向深處，左端約 150、右端剩 90 像素（右端還翻過去）。
     - 右上：左端捲進深處（約 95 像素），往右越來越近（約 157 像素）。左上：約 85 像素，往右退到主膠捲後面。
     - 背景：每條只有 40～55 像素高，有點糊、偏藍紫。
     老師另外要的兩條：上下衝出去、一直都在（不用一開始衝出去、後面又收回），畫格要清楚。 */
  /* 上下兩條（老師：從裡面連出去、越過膠捲上緣（下緣）、再連回裡面；2026-10-22 晚上：「突出去的方式太不自然，重新好好設計」）。
     之前是對稱的半圓拱，上下合起來像一個圈住窗口的環，形狀又固定不動，像裝飾框。
     現在是「一道浪」（座標都用 at()＝正中間時畫面上的位置，第三個數是深度、第四個是翻轉）：
     - 從窗口一邊的深處流過來，中段像浪頭一樣緩緩升起、越過膠捲邊緣（最靠近鏡頭、順勢微微翻轉），再退回另一邊的深處。
       方向只轉五十度左右，沒有急彎（底片在自己的平面裡急轉彎就是不自然的來源，試過「捲起的浪」也一樣，見 製作/week09/README.md）。
     - 上下兩條流向相反，浪頭和波谷位置錯開、大小不同，不鏡像。
     - 兩條都會隨著波動起伏（見 geom 的 WAVE），不是固定的形狀。 */
  const LINES = [
    // 背景（兩端都在窗口外面）
    // 最遠一層：很糊，填滿膠捲之間的空隙
    { id: "g9", theme: 9, tint: 2, w: 0.09, blur: 0.36, start: 0.6, v: 0.03, sp: 0.12, p: [ref(-60, 346, 2.16), ref(300, 352, 2.16), ref(660, 336, 2.16), ref(1000, 340, 2.16), ref(1400, 310, 2.16)] },
    { id: "g10", theme: 3, tint: 4, w: 0.09, blur: 0.39, start: 0.6, v: -0.025, sp: 0.12, p: [ref(-60, 470, 2.4), ref(350, 454, 2.4), ref(700, 478, 2.4), ref(1050, 461, 2.4), ref(1400, 482, 2.4)] },
    { id: "g11", theme: 6, tint: 1, w: 0.09, blur: 0.36, start: 0.6, v: 0.035, sp: 0.12, p: [ref(-60, 572, 2.16), ref(330, 580, 2.16), ref(700, 552, 2.16), ref(1050, 548, 2.16), ref(1400, 516, 2.16)] },
    { id: "g12", theme: 1, tint: 3, w: 0.09, blur: 0.36, start: 0.6, v: -0.03, sp: 0.12, p: [ref(-60, 676, 2.3), ref(400, 676, 2.3), ref(800, 708, 2.3), ref(1400, 728, 2.3)] },
    { id: "g8", theme: 9, tint: 5, w: 0.087, blur: 0.23, start: 0.5, v: -0.04, sp: 0.12, p: [ref(-60, 205, 1.92), ref(300, 215, 1.92), ref(620, 200, 1.92), ref(800, 205, 2.02)] },
    { id: "g1", theme: 2, tint: 1, w: 0.084, blur: 0.2, start: 0.45, v: 0.045, sp: 0.12, p: [ref(200, 234, 1.44), ref(500, 212, 1.44), ref(900, 224, 1.44), ref(1200, 200, 1.44), ref(1400, 194, 1.44)] },
    { id: "g4", theme: 6, tint: 2, w: 0.088, blur: 0.2, start: 0.5, v: -0.035, sp: 0.12, p: [ref(1000, 486, 1.68), ref(1200, 506, 1.68), ref(1400, 514, 1.68)] },
    { id: "g3", theme: 1, tint: 3, w: 0.091, blur: 0.18, start: 0.4, v: 0.05, sp: 0.12, p: [ref(820, 424, 1.2), ref(1000, 446, 1.2), ref(1200, 432, 1.2), ref(1400, 464, 1.2)] },
    { id: "g2", theme: 4, tint: 4, w: 0.091, blur: 0.18, start: 0.35, v: -0.045, sp: 0.12, p: [ref(-60, 370, 1.2), ref(150, 396, 1.2), ref(400, 384, 1.2), ref(700, 414, 1.2)] },
    { id: "g7", theme: 8, tint: 2, w: 0.105, blur: 0.18, start: 0.4, v: 0.04, sp: 0.12, p: [ref(-60, 616, 1.44), ref(170, 684, 1.44), ref(380, 702, 1.44)] },
    { id: "g6", theme: 3, tint: 1, w: 0.104, blur: 0.18, start: 0.3, v: -0.05, sp: 0.12, p: [ref(-60, 780, 1.34), ref(300, 806, 1.34), ref(650, 806, 1.34), ref(1000, 826, 1.34), ref(1400, 812, 1.34)] },
    { id: "g5", theme: 5, tint: 5, w: 0.106, blur: 0.16, start: 0.25, v: 0.055, sp: 0.12, p: [ref(-60, 734, 0.96), ref(300, 764, 0.96), ref(700, 772, 0.96), ref(1050, 792, 0.96)] },
    // 上面那條：一道浪。從窗口左邊深處往右流過來，中段浪頭緩緩升起、越過膠捲上緣（最靠近鏡頭，順勢微微翻轉），再往右下退回深處
    { id: "tw", theme: 7, w: 0.16, fixed: true, face: true, drop: true, v: 0.09, wa: 0.022, wd: 0.04, root: 0.9, p: [at(-0.44, 0.15, 2.4), at(-0.34, 0.15, 1.5), at(-0.24, 0.18, 0.7), at(-0.14, 0.25, 0.15), at(-0.05, 0.34, -0.15).concat([10]), at(0.08, 0.44, -0.3).concat([26]), at(0.18, 0.47, -0.34).concat([32]), at(0.27, 0.43, -0.25).concat([20]), at(0.34, 0.35, -0.12).concat([6]), at(0.39, 0.27, -0.02), at(0.43, 0.22, 0.45), at(0.46, 0.19, 1.5)] },
    // 下面那條：反方向流（右往左），比較小、比較淺，波谷錯開到中間偏左
    { id: "bw", theme: 2, w: 0.125, fixed: true, face: true, drop: true, v: -0.075, wa: 0.018, wd: 0.035, root: 0.9, p: [at(0.45, -0.17, 2.2), at(0.36, -0.18, 1.3), at(0.27, -0.22, 0.55), at(0.18, -0.29, 0.08), at(0.07, -0.39, -0.18).concat([-6]), at(-0.03, -0.44, -0.27).concat([-14]), at(-0.12, -0.43, -0.24).concat([-12]), at(-0.2, -0.36, -0.14).concat([-4]), at(-0.25, -0.29, -0.02), at(-0.28, -0.24, 0.45), at(-0.3, -0.2, 1.5)] },
    // 主膠捲（放在最後：滑鼠判斷從最後一條往前找，跟畫的順序一致，主膠捲在最上層）：中間最靠近，往兩邊退向深處，右端還翻過去
    { id: "m", theme: 99, top: true, centerClock: true, drop: true, w: 0.36, start: 0, v: 0.1, wa: 0.02, wd: 0.03, root: 0.6, p: [ref(-60, 470, 3.5, 15), ref(30, 500, 2.6, 8), ref(100, 535, 2.2), ref(200, 578, 1.2), ref(300, 585, 1.0), ref(450, 588, 0.6), ref(660, 586, 0.25), ref(800, 581, 0.45), ref(950, 596, 1.0), ref(1100, 621, 1.8, 10), ref(1200, 656, 2.6, 30), ref(1290, 672, 3.2, 42), ref(1370, 690, 3.8, 50)] },
  ];
  const FADE = 0.45;                                       // 尾端淡出的長度（世界單位）
  const PAR = 0.03;                                        // 視差：每往後 1 單位，跟著滑鼠移多少（深淺層次靠它在動的時候分出來）
  const LX = -0.38, LY = 0.72, LZ = 0.58;                   // 光從左上前方來（指向光源，世界座標）
  const LN = Math.hypot(LX, LY, LZ), Lx = LX / LN, Ly = LY / LN, Lz = LZ / LN;

  // 頂點只給「那一格的座標」（世界單位）：圓柱上的位置、從相機看過去落在畫格上的哪裡（窗口裁切用），都在這裡算
  const VS = `#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aInfo; layout(location=3) in vec4 aExt;
  uniform mat4 uProj; uniform vec3 uCam; uniform float uAngle, uBend, uR, uWF, uH;
  out vec2 vUv; out vec4 vInfo; out vec3 vExt; out vec2 vClip; out float vAng;
  void main(){
    vUv=aUv; vInfo=aInfo; vExt=aExt.xyz;
    float a=uAngle+aPos.x/uR, r=uR+aPos.z;
    vec3 d=vec3(r*sin(a), aPos.y+uBend*a*a, -r*cos(a))-uCam;
    float A=d.x*d.x+d.z*d.z, B=uCam.x*d.x+uCam.z*d.z, C=uCam.x*uCam.x+uCam.z*uCam.z-uR*uR;
    float t=(-B+sqrt(max(0.0,B*B-A*C)))/max(A,1e-6);
    vec3 q=uCam+t*d; float aq=atan(q.x,-q.z);
    vClip=vec2((aq-uAngle)*uR/uWF, (q.y-uBend*aq*aq)/uH);
    vAng=a;
    gl_Position=uProj*vec4(d,1.0);
  }`;
  // aInfo：種子（＋100×色調）、亮度（負的＝看到背面）、透明度、一格的長寬比；aExt：反光、霧、失焦
  const COMMON = `#version 300 es
  precision highp float;
  in vec2 vUv; in vec4 vInfo; in vec3 vExt; in vec2 vClip; in float vAng;
  uniform sampler2D uAtlas; uniform vec2 uGrid; uniform vec2 uPad; uniform vec3 uFog; uniform float uGlow; uniform int uClip; uniform vec3 uHaze;
  uniform float uSharp; uniform float uClock;
  out vec4 o;
  vec2 tileUV(float idx, vec2 st){ float col=mod(idx,uGrid.x), row=floor(idx/uGrid.x); return (vec2(col,row)+uPad+st*(1.0-2.0*uPad))/uGrid; }
  float seedOf(){ return mod(floor(vInfo.x+0.5),100.0); }
  bool softSet(){ return floor(vInfo.x+0.5)>999.5; }   // 用哪一組圖由整條決定（種子碼 +1000＝失焦的背景）；失焦程度可以逐點變（越遠越糊），圖不會跟著跳   // 種子內插後可能是 0.9999999：先取整數，不然整除的那一格會逐像素亂跳
  // 插畫輪流：跳過鐘塔那 4 格；程式畫的場景（40 張）裡 32～35 是紅色警報門，太搶眼，換成沉沒圖書館
  float pick(float k, float n){ float t=mod(k,n); t=t>=uClock ? t+4.0 : t; return (t>=32.0 && t<36.0) ? t+4.0 : t; }
  // 第幾格放哪一張：主膠捲（種子 99）一格鐘塔、一格插畫；其他清楚的每四格一個鐘塔；失焦的只用插畫和城堡
  // 每條膠捲自己的輪播順序：跨距照種子選 5、7、11、13（和 9 張、12 張、36 張都互質，每張都輪得到、相鄰兩格不會一樣），
  // 不同的膠捲同一時間不會排出一樣的順序（2026-10-23 老師：部分膠捲的內容重複性太高）
  float stepOf(float th){ float k=mod(th,4.0); return k<0.5 ? 5.0 : k<1.5 ? 7.0 : k<2.5 ? 11.0 : 13.0; }
  float tileOf(float cell){
    float th=seedOf();
    if(th>90.0){   // 主膠捲：每三格一個鐘塔（原本一格隔一格，畫面上一次看到三個鐘太重複），其他是插畫
      float g=floor(cell/3.0), r=mod(cell,3.0);
      return r<0.5 ? uClock+mod(g,4.0) : pick((g*2.0+r-1.0)*7.0+2.0, uSharp-4.0);
    }
    if(!softSet()){ if(mod(cell+th,4.0)<0.5) return uClock+mod(floor(cell/4.0)+th,4.0); return pick(th*5.0+cell*stepOf(th), uSharp-4.0); }
    return pick(th*5.0+cell*stepOf(th), uGrid.x*uGrid.y-4.0);
  }
  float fogOf(){ return smoothstep(0.22,0.75,abs(vAng))*0.85; }
  float rbox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
  float clipA(){   // 1：只留窗口（畫格的畫面）裡；2：只留 Week 9 這一格的膠捲上（影子）
    if(uClip==0) return 1.0;
    vec2 px=vClip*vec2(1024.0,768.0);
    float d=uClip==1 ? rbox(px,vec2(472.0,266.0),10.0) : rbox(px,vec2(512.0,384.0),2.0);
    float w=max(fwidth(d),0.5);
    float a=1.0-smoothstep(-w,w,d);
    if(uClip==1) a*=0.55+0.45*smoothstep(0.0,22.0,-d);   // 窗口邊緣暗一點，像從洞口往裡看
    return a;
  }`;
  const FS_FILM = COMMON + `
  uniform float uTime, uHands; uniform vec3 uClockC[4]; uniform vec3 uCrop;
  float hsh(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
  // 同一張插畫每次出現都像不同的鏡頭：放大 1～1.28 倍、平移、有的左右翻轉、偏暖或偏冷、亮一點或暗一點（鐘塔不變，指針要對準鐘心）
  vec2 vary(vec2 st, float cell, out vec3 grade){
    float th=seedOf(), h1=hsh(vec2(th*1.3+0.7, cell)), h2=hsh(vec2(cell+3.1, th*0.7)), h3=hsh(vec2(th+cell*0.37, 9.1));
    float z=1.0+0.28*h1;
    vec2 off=(vec2(h2,h3)*2.0-1.0)*(1.0-1.0/z)*0.5;
    st=0.5+(st-0.5)/z+off;
    if(h3<0.35) st.x=1.0-st.x;
    grade=mix(vec3(0.93,0.98,1.07), vec3(1.07,1.0,0.92), h2)*(0.95+0.1*h1);
    return st;
  }
  vec3 tintOf(float ti){
    if(ti<0.5) return vec3(1.0);
    if(ti<1.5) return vec3(0.78,1.0,1.1);    // 青
    if(ti<2.5) return vec3(1.02,0.8,1.14);   // 紫
    if(ti<3.5) return vec3(1.14,0.95,0.74);  // 琥珀
    if(ti<4.5) return vec3(0.84,0.92,1.18);  // 藍
    return vec3(0.9,1.08,0.86);              // 綠
  }
  // 鐘的指針：每個鐘（哪一條、第幾格）有自己的時間、速度，有的倒著走（平行時空：同一座鐘、不同的時間）
  vec4 hands(float tile, float cell, vec2 st){
    float vi=tile-uClock; if(uHands<0.5 || vi<-0.5 || vi>3.5) return vec4(0.0);
    vec3 cc=vi<0.5 ? uClockC[0] : vi<1.5 ? uClockC[1] : vi<2.5 ? uClockC[2] : uClockC[3];
    vec2 p=vec2(uCrop.x+st.x*uCrop.y, st.y*uCrop.z), c=cc.xy; float r=cc.z;
    float th=seedOf(), h1=hsh(vec2(th+1.0, cell)), h2=hsh(vec2(cell*1.7, th+7.0));
    float rate=h1<0.22 ? -0.8 : 0.3+1.7*h1*h1;
    float mA=h2*6.2832+uTime*rate*0.14, hA=mA/12.0+h1*6.2832;
    vec2 md=vec2(sin(mA),-cos(mA)), hd=vec2(sin(hA),-cos(hA));
    float aa=max(fwidth(p.x),fwidth(p.y))*0.9;
    float d=min(min(seg(p,c,c+hd*r*0.45)-r*0.03, seg(p,c,c+md*r*0.68)-r*0.0175), length(p-c)-r*0.06);
    return vec4(0.165,0.09,0.035, 1.0-smoothstep(-aa,aa,d));
  }
  void main(){
    float u=vUv.x, v=vUv.y, ar=vInfo.w, bl=vExt.z;
    vec2 fw=fwidth(vUv);
    float band=0.13, soft=1.0+bl*12.0;   // 齒孔那一條佔膠捲寬的 13%（照參考圖）；失焦：邊緣、齒孔都變軟
    bool back=vInfo.y<0.0;
    vec3 col=vec3(0.058,0.051,0.047)*(0.8+0.45*smoothstep(0.0,0.5,v)*(1.0-smoothstep(0.5,1.0,v)));   // 底片：偏棕的深黑（照參考圖）
    float per=0.16, hu=(fract(u/per)-0.5)*per*ar;   // 一格約 6 個齒孔
    vec2 hb=vec2(per*ar*0.23, band*0.31);           // 齒孔大一點（照參考圖）
    float dh=min(rbox(vec2(hu,v-band*0.5),hb,0.018), rbox(vec2(hu,v-(1.0-band*0.5)),hb,0.018));
    float aa=max(fw.y,fw.x*ar)*1.1*soft;
    col=mix(col, vec3(0.95,0.91,0.83)*(0.92+0.08*sin(u*1.7+vInfo.x)), (1.0-smoothstep(-aa,aa,dh))*0.95);
    float q=max(min(v,1.0-v),0.0)/max(fw.y*1.5*soft,0.006);   // 不用 pow：邊緣的像素 v 可能略小於 0，pow 會算出 NaN
    col+=vec3(0.14,0.12,0.1)*exp(-q*q);
    float gap=0.03, fu=fract(u), cell=floor(u), i0=band+0.015;
    vec2 st=vec2((fu-gap)/(1.0-2.0*gap),(v-i0)/(1.0-2.0*i0));
    if(back) st.x=1.0-st.x;   // 從背面看：膠片是透的，畫面左右相反、暗一點
    float di=rbox(vec2((fu-0.5)*ar, v-0.5), vec2((0.5-gap)*ar, 0.5-i0), 0.035);   // 畫面四角稍微圓一點（照參考圖）
    float tile=tileOf(cell);
    bool clock=tile>=uClock-0.5 && tile<uClock+3.5;
    vec3 grade=vec3(1.0);
    vec2 sv=clock ? st : vary(st, cell, grade);
    vec3 img=texture(uAtlas, tileUV(tile, clamp(sv,0.0,1.0)), bl*2.4).rgb*grade;   // 失焦的取比較糊的那一層
    if(!softSet()){ vec4 hn=hands(tile, cell, clamp(st,0.0,1.0)); img=mix(img, hn.rgb, hn.a*(1.0-smoothstep(0.15,0.4,bl))); }
    img=mix(vec3(dot(img,vec3(0.3,0.59,0.11))), img, 1.0-bl*0.3);   // 清楚的保留插畫原本的顏色；越糊顏色收一點
    if(softSet()) img*=1.12;   // 背景膠捲亮一點（2026-10-23 老師：背後的膠捲太暗淡）
    img=mix(img, img*img*(3.0-2.0*img), 0.3*(1.0-bl))*(1.0+0.08*(1.0-bl));   // 清楚的對比、亮度稍微拉一點（參考圖的插畫比較鮮明）
    img*=tintOf(floor(mod(floor(vInfo.x+0.5),1000.0)/100.0));   // 每個時空自己的色調
    if(back) img=mix(vec3(0.06,0.05,0.045), img, 0.68);
    col=mix(col,img,1.0-smoothstep(-aa,aa,di));
    float thin=smoothstep(0.05,0.16,fw.y);   // 帶子在畫面上只剩十幾像素寬：齒孔和畫面細到會閃，改成一條柔和的帶子
    if(thin>0.0){ vec3 av=textureLod(uAtlas, tileUV(tile, vec2(0.5)), 4.0).rgb; col=mix(col, mix(vec3(0.05,0.05,0.06), av, 0.75), thin); }
    col*=abs(vInfo.y);
    col+=vec3(1.0,0.93,0.82)*vExt.x;   // 彎的地方的反光
    col=mix(col,uHaze,vExt.y);         // 越遠越接近深藍的霧
    col=mix(col,uFog,fogOf());
    float a=vInfo.z*(1.0-smoothstep(0.5-fw.y*1.5*soft,0.5,abs(v-0.5)))*clipA();
    o=vec4(min(col,vec3(1.0))*a,a);
  }`;
  const FS_GLOW = COMMON + `
  void main(){   // 滑鼠碰到的那一條才畫：一圈很淡的光
    float u=vUv.x-0.5, v=vUv.y, cell=floor(u), f=smoothstep(0.0,1.0,fract(u));
    vec3 avg=mix(textureLod(uAtlas, tileUV(tileOf(cell), vec2(0.5)), 5.0).rgb, textureLod(uAtlas, tileUV(tileOf(cell+1.0), vec2(0.5)), 5.0).rgb, f);
    float lum=dot(avg,vec3(0.3,0.59,0.11));
    float dv=max(abs(v-0.5)-0.3,0.0);
    float fall=exp(-dv*dv*5.0)*(1.0-smoothstep(1.0,2.15,abs(v-0.5)*2.0));
    vec3 c=avg*(0.25+2.4*lum*lum)*fall*abs(vInfo.y)*vInfo.z*uGlow*(1.0-fogOf())*(1.0-0.8*vExt.y)*clipA();
    c=c/(1.0+max(c.r,max(c.g,c.b)));   // 壓一下最亮的地方
    o=vec4(c,max(c.r,max(c.g,c.b)));   // 透明度也要加：畫布是預乘透明度，透明的地方只加顏色會變成不合法的顏色
  }`;
  const FS_SHADOW = COMMON + `
  void main(){
    float d=abs(vUv.y-0.5)*2.0, k=1.0-smoothstep(0.15,1.0,d);
    float a=vInfo.z*k*k*clipA()*(1.0-fogOf());
    o=vec4(0.0,0.0,0.0,a);
  }`;
  const FS_LABEL = COMMON + `
  uniform sampler2D uLabel;
  void main(){ vec4 t=texture(uLabel,vUv); vec3 c=mix(t.rgb,uFog,fogOf()); o=vec4(c*t.a,t.a); }`;

  function catmull(P, n) {   // 經過每個控制點的平滑曲線（Catmull-Rom），每段 n 點
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1, 2, 3].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(P[P.length - 1].slice());
    return out;
  }
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function rotate(v, ax, c, s) {   // 繞單位軸 ax 轉（Rodrigues）
    const k = cross(ax, v), d = dot(ax, v) * (1 - c);
    return [v[0] * c + k[0] * s + ax[0] * d, v[1] * c + k[1] * s + ax[1] * d, v[2] * c + k[2] * s + ax[2] * d];
  }

  // 兩行字（和 home.js 的 drawTimeline 同一個位置、同一個字型）：畫在一張小圖上，上面一列是「WEEK 09 · MIDTERM」、下面一列是「準備中」
  // 兩塊在畫格貼圖上的範圍（像素，畫格貼圖 1024×768）：上 (60,140)–(460,184)、下 (60,566)–(460,666)
  const LBOX = [[60, 140, 460, 184], [60, 566, 460, 666]];
  function labelCanvas(lb) {
    const S2 = 2, W = 400, Hc = 44 + 100, cv = document.createElement("canvas");
    cv.width = W * S2; cv.height = Hc * S2;
    const g = cv.getContext("2d");
    g.setTransform(S2, 0, 0, S2, 0, 0);
    g.shadowColor = "rgba(4,6,14,.75)"; g.shadowBlur = 9;   // 壓在膠捲上也看得清楚
    g.fillStyle = "rgba(255,255,255,.62)"; g.font = `700 19px ${lb.mono}`; g.fillText(lb.top, 72 - 60, 170 - 140);
    g.fillStyle = "rgba(255,255,255,.92)"; g.font = `700 34px ${lb.sans}`; g.fillText(lb.bottom, 70 - 60, 44 + (616 - 566));
    return cv;
  }

  function create(gl, opt) {
    const R = opt.R, TH = opt.TH, H = opt.H, WF = R * TH;
    const REDUCE = !!opt.reduceMotion;
    const fr = opt.frames;
    const atl = fr ? { canvas: fr.img, cols: fr.cols, rows: fr.rows, tw: fr.tw, th: fr.th, pad: fr.pad, sharp: fr.sharp, clock: fr.clock, crop: fr.crop, hands: 1 }
      : Object.assign(window.CoverScenes.build(opt.scale || 0.7), { sharp: 40, clock: 4, crop: [0, 330, 220], hands: 0 });
    const CLOCKS = [[0.5, 0.48, 0.36], [0.42, 0.52, 0.42], [0.6, 0.46, 0.33], [0.5, 0.56, 0.5]].map(([x, y, r]) => [330 * x, 220 * y, 220 * r]);   // 鐘心、半徑（原圖像素）
    function texFrom(canvas, mip) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    const tex = texFrom(atl.canvas, true);
    const ltex = opt.labels ? texFrom(labelCanvas(opt.labels), false) : null;
    const PADU = atl.pad / (atl.tw + atl.pad * 2), PADV = atl.pad / (atl.th + atl.pad * 2);

    function prog(fs) {
      const p = gl.createProgram();
      [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]].forEach(([t, src]) => {
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
    const PROG = { film: prog(FS_FILM), glow: prog(FS_GLOW), shadow: prog(FS_SHADOW), label: prog(FS_LABEL) };
    const vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const NF = 12, STRIDE = NF * 4;   // 那一格的座標 xyz、uv、種子／亮度／透明度／長寬比、反光／霧／失焦
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, STRIDE, 20);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, STRIDE, 36);
    gl.bindVertexArray(null);

    // 每條線：取等距的點（座標都換成世界單位：x 沿著圓柱的弧長、y、d），再算每一點的切線、寬的方向、面的方向
    const S = LINES.map((d, i) => {
      const P = d.p.map(([x, y, z, tw]) => [x * WF, y * H, z, tw || 0]);   // 第四個是翻轉角度（度）
      const fine = catmull(P, 40), acc = [0];
      for (let k = 1; k < fine.length; k++) acc.push(acc[k - 1] + Math.hypot(fine[k][0] - fine[k - 1][0], fine[k][1] - fine[k - 1][1], fine[k][2] - fine[k - 1][2]));
      const sp = d.sp || 0.05, L = acc[acc.length - 1], n = Math.max(3, Math.floor(L / sp) + 1);
      const F = () => new Float32Array(n);
      const b = { n, L, x: F(), y: F(), d: F(), s: F(), tw: F(), bx: F(), by: F(), bd: F(), nx: F(), ny: F(), nd: F() };
      let j = 0;
      for (let k = 0; k < n; k++) {
        const s = (k / (n - 1)) * L; while (j < fine.length - 2 && acc[j + 1] < s) j++;
        const f = (s - acc[j]) / Math.max(1e-6, acc[j + 1] - acc[j]);
        b.x[k] = fine[j][0] + (fine[j + 1][0] - fine[j][0]) * f; b.y[k] = fine[j][1] + (fine[j + 1][1] - fine[j][1]) * f; b.d[k] = fine[j][2] + (fine[j + 1][2] - fine[j][2]) * f; b.s[k] = s;
        b.tw[k] = fine[j][3] + (fine[j + 1][3] - fine[j][3]) * f;
      }
      // 不亂轉的框架：第一點的寬朝「切線在畫面上的左手邊」，之後每一點只做把上一點切線轉到這一點切線的最小旋轉
      const T = [];
      for (let k = 0; k < n; k++) { const k0 = Math.max(0, k - 1), k1 = Math.min(n - 1, k + 1); T.push(norm([b.x[k1] - b.x[k0], b.y[k1] - b.y[k0], b.d[k1] - b.d[k0]])); }
      let B = Math.hypot(T[0][0], T[0][1]) > 0.2 ? norm([-T[0][1], T[0][0], 0]) : norm(cross([1, 0, 0], T[0]));
      for (let k = 0; k < n; k++) {
        if (k > 0) {
          const ax = cross(T[k - 1], T[k]), sn = Math.hypot(ax[0], ax[1], ax[2]);
          if (sn > 1e-6) B = rotate(B, [ax[0] / sn, ax[1] / sn, ax[2] / sn], dot(T[k - 1], T[k]), sn);
        }
        if (d.face) {   // 盡量讓正面朝相機：寬取「切線在畫面上的左手邊」，切線幾乎正對相機時才沿用上一點的
          const xy = Math.hypot(T[k][0], T[k][1]), wf = Math.min(1, Math.max(0, (xy - 0.12) / 0.3));
          if (wf > 0) {
            let Bf = [-T[k][1] / xy, T[k][0] / xy, 0];
            if (dot(Bf, B) < 0) Bf = [-Bf[0], -Bf[1], 0];
            B = norm([B[0] + (Bf[0] - B[0]) * wf, B[1] + (Bf[1] - B[1]) * wf, B[2] * (1 - wf)]);
          }
        }
        { const dd = dot(B, T[k]); B = norm([B[0] - T[k][0] * dd, B[1] - T[k][1] * dd, B[2] - T[k][2] * dd]); }
        const ang = (b.tw[k] * Math.PI) / 180, Bk = ang ? rotate(B, T[k], Math.cos(ang), Math.sin(ang)) : B;   // 沿著長的方向翻轉
        const N = cross(Bk, T[k]);   // 畫面那一面朝哪（一開始朝相機）
        b.bx[k] = Bk[0]; b.by[k] = Bk[1]; b.bd[k] = Bk[2]; b.nx[k] = N[0]; b.ny[k] = N[1]; b.nd[k] = N[2];
      }
      const hw = d.w * H / 2, over = [];
      if (d.fixed) for (let k = 0; k < n; k += 2) if (Math.abs(b.y[k]) > H / 2) over.push(k);   // 衝出膠捲上下緣的那些點（讓開首頁的字和按鈕用）
      let dMin = 1e9, dMax = -1e9; for (let k = 0; k < n; k++) { dMin = Math.min(dMin, b.d[k]); dMax = Math.max(dMax, b.d[k]); }
      const chunk = !d.top && dMax - dMin > 0.4;   // 前後穿插的才要切段排序；深度一樣的整條一次畫
      return { d, b, theme: d.theme + 100 * (d.tint || 0) + ((d.blur || 0) >= 0.15 ? 1000 : 0), bv: F(), hw, sp, over, chunk, live: false, blur: d.blur || 0, cell: hw * 2 * 1.0, disp: F(), vel: F(),
        px: F(), py: F(), pd: F(), wx: F(), wy: F(), wz: F(), sh: F(), spec: F(), al: F(), hz: F(), ex: F(), ey: F(),
        sx: F(), sy: F(), sr: F(), nVis: 0,
        scroll: (i * 0.37) % 1, phase: i * 1.7, hl: 0, start: d.start, reveal: REDUCE || d.fixed ? 1 : 0 };
    });
    S.forEach((s) => {   // centerClock：窗口正中間（X = 0）那一格一開始是鐘塔（偶數格、剛好置中）
      if (!s.d.centerClock) return;
      let kc = 0; for (let k = 1; k < s.b.n; k++) if (Math.abs(s.b.x[k]) < Math.abs(s.b.x[kc])) kc = k;
      const c = s.b.s[kc] / s.cell - 0.5; s.scroll = c - 3 * Math.floor(c / 3);   // 正中間那一格的編號是 3 的倍數（鐘塔）
    });

    let buf = new Float32Array(1 << 16), o = 0;
    let t0 = 0, tPrev = 0, now = 0, ptr = null, hover = -1, ptrPrev = null, ptrV = 0, seen = false, focus = false, focusT = 0;
    const par = { x: 0, y: 0 };   // 視差（−1.5～1.5）：滑鼠在這一格上的位置；沒有滑鼠時很慢地自己飄
    const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

    function kick(s, at, amp) {
      s.live = true;
      const sig = Math.max(3, (s.hw / s.sp) * 0.9);
      for (let k = Math.max(1, (at - 4 * sig) | 0); k < Math.min(s.b.n, at + 4 * sig); k++) s.vel[k] += amp * Math.exp(-((k - at) * (k - at)) / (sig * sig));
    }
    function physics(s, dt) {   // 一維的波：鄰居拉、原位拉回、阻尼；根部固定，尾端放開。靜下來就停（不用每格都算）
      if (!s.live) return;
      const n = s.b.n, d = s.disp, v = s.vel, c2 = 80 * 80, k0 = 34, damp = 3.6, steps = 4, h = dt / steps;
      for (let st = 0; st < steps; st++) {
        for (let i = 1; i < n - 1; i++) v[i] += (c2 * (d[i - 1] + d[i + 1] - 2 * d[i]) - k0 * d[i] - damp * v[i]) * h;
        v[n - 1] += (c2 * (d[n - 2] - d[n - 1]) - k0 * d[n - 1] - damp * v[n - 1]) * h;
        for (let i = 1; i < n; i++) d[i] += v[i] * h;
        d[0] = 0; v[0] = 0;
      }
      let e = 0; for (let i = 0; i < n; i++) e = Math.max(e, Math.abs(d[i]), Math.abs(v[i]) * 0.1);
      if (e < 1e-4) { d.fill(0); v.fill(0); s.live = false; }
    }

    // 每一格：進場、走片、擺動、波（step 只算數字，draw 才畫）
    function step(t, ang) {   // ang：那一格現在轉到哪（弧度，0＝正中間）
      now = t;
      if (!t0) { t0 = t; tPrev = t; }
      const dt = Math.min(0.05, t - tPrev); tPrev = t;
      const el = t - t0, aa = Math.abs(ang || 0);
      if (!focus && seen && aa < 0.08) { focus = true; focusT = t; }
      else if (focus && aa > 0.14) focus = false;
      if (!REDUCE) {
        let tx = 0.45 * Math.sin(el * 0.21), ty = 0.3 * Math.sin(el * 0.16 + 1.3);
        if (ptr && frameScr.r) {
          const cl = (v) => Math.max(-1.5, Math.min(1.5, v));
          tx = cl((ptr.x - frameScr.x) / frameScr.r); ty = cl((ptr.y - frameScr.y) / frameScr.r);
        }
        const e = 1 - Math.exp(-dt * 2.4);
        par.x += (tx - par.x) * e; par.y += (ty - par.y) * e;
      }
      S.forEach((s, i) => {
        if (!REDUCE) {
          if (s.d.fixed) s.reveal = 1;   // 上下衝出去的兩條一直都在（老師：不用一開始衝出去、後面又收回）
          else if (!s.d.outer) s.reveal = seen ? easeOut((el - 0.05 - s.start * 0.4) / 0.85) : 0;   // 約 1 秒長好（原本 2 秒多）
          else if (focus) s.reveal = Math.max(s.reveal, easeOut((t - focusT - 0.15 - s.start) / 1.2));
          else s.reveal = Math.max(0, s.reveal - dt / 0.5);   // 收回：從尾巴捲回去
          physics(s, dt);
          if (!s.d.centerClock || focus) s.scroll += dt * s.d.v * (1 + Math.max(0, s.hl) * 1.5);   // 主膠捲等那一格轉到正中間才開始走片：第一眼正中間是鐘塔
        }
        const target = hover < 0 ? 0 : i === hover ? 1 : -1;
        s.hl += (target - s.hl) * Math.min(1, dt * 7);
      });
      // 滑鼠：最前面、落在帶子寬度內的那一條（看上一格算好的螢幕位置）
      if (ptr) {
        let hit = -1, at = 0;
        for (let i = S.length - 1; i >= 0 && hit < 0; i--) {
          const s = S[i];
          for (let k = 0; k < s.nVis; k += 2) { const dx = s.sx[k] - ptr.x, dy = s.sy[k] - ptr.y; if (s.sr[k] > 0 && dx * dx + dy * dy < s.sr[k] * s.sr[k]) { hit = i; at = k; break; } }
        }
        if (hit !== hover) { if (hit >= 0 && !REDUCE) kick(S[hit], at, -0.55 - Math.min(0.4, ptrV * 0.0006)); hover = hit; }
        else if (hit >= 0 && !REDUCE && ptrV > 80 && performance.now() - ptr.t < 60) kick(S[hit], at, -0.06 * dt * 60);
      } else hover = -1;
    }

    /* ---------- 每一格的幾何 ---------- */
    let C = null;   // 這一格的相機、角度……（draw 傳進來的 ctx）
    const frameScr = { x: 0, y: 0, r: 0 };   // 這一格在螢幕上的中心、半寬（像素）
    function world(lx, ly, ld, out) {   // 那一格的座標（世界單位）→ 圓柱上的世界座標
      const a = C.angle + lx / R, r = R + ld;
      out[0] = r * Math.sin(a); out[1] = ly + C.bend * a * a; out[2] = -r * Math.cos(a);
      return out;
    }
    function onFrame(p, out) {   // 從相機看過去，p 落在畫格（圓柱面）上的哪裡 → 那一格的座標 [X, Y]
      const c = C.cam, dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2];
      const A = dx * dx + dz * dz, Bq = c[0] * dx + c[2] * dz, Cq = c[0] * c[0] + c[2] * c[2] - R * R;
      const t = (-Bq + Math.sqrt(Math.max(0, Bq * Bq - A * Cq))) / A;
      const qx = c[0] + t * dx, qy = c[1] + t * dy, qz = c[2] + t * dz, aq = Math.atan2(qx, -qz);
      out[0] = ((aq - C.angle) * R) / WF; out[1] = (qy - C.bend * aq * aq) / H;
      return out;
    }
    function toScreen(p) {
      const pr = C.proj, c = C.cam, x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
      const cx = pr[0] * x + pr[8] * z, cy = pr[5] * y + pr[9] * z, cw = -z;
      return [(cx / cw * 0.5 + 0.5) * C.vw, (1 - (cy / cw * 0.5 + 0.5)) * C.vh];
    }
    const tmp = [0, 0, 0], tmp2 = [0, 0, 0], fx2 = [0, 0];
    // 衝出去的那段碰到首頁的字或按鈕（C.avoid：螢幕上的長方形，像素）時，要再壓低多少（0～1）。
    // 螢幕上的高度跟衝出去的量成正比，所以直接解出剛好碰不到的比例；水平方向沒有重疊的就不管（桌機的拱在中間，照樣衝出去）。
    function fitAmp(s, amp, near, edge) {
      const R0 = C.avoid; if (!R0 || !R0.length || !frameScr.r) return 1;
      const b = s.b, pxw = frameScr.r / (WF / 2);
      let f = 1;
      for (const k of s.over) {
        const yb = b.y[k], sg = yb > 0 ? 1 : -1, o = (Math.abs(yb) - edge) * amp;
        let pd = b.d[k]; if (pd < 0 && near < 1) pd *= near;
        const px = b.x[k] + PAR * par.x * pd, sh = -PAR * par.y * pd;
        const p0 = toScreen(world(px, sg * edge + sh, pd, tmp)), p1 = toScreen(world(px, sg * (edge + o) + sh, pd, tmp));
        const rad = s.hw * pxw * (7.5 / (7.5 + pd)) * 1.15, dy = p0[1] - p1[1];
        if (Math.abs(dy) < 1e-3) continue;
        for (const q of R0) {
          if (Math.max(p0[0], p1[0]) + rad < q.l || Math.min(p0[0], p1[0]) - rad > q.r) continue;
          if (sg > 0 && q.b <= p0[1]) f = Math.min(f, (p0[1] - q.b - rad - 6) / dy);        // 在上面的字、按鈕：拱的頂要停在它下面
          else if (sg < 0 && q.t >= p0[1]) f = Math.min(f, (q.t - rad - 6 - p0[1]) / -dy);  // 在下面的：拱的底要停在它上面
        }
      }
      return Math.max(0.03, Math.min(1, f));
    }
    function geom() {   // 每一點：位置（加上擺動、波和視差）、照光、透明度、霧；膠捲後面的點另外算它落在畫格上的哪裡
      const el = now - t0, cam = C.cam;
      const c0 = toScreen(world(0, 0, 0, tmp)), c1 = toScreen(world(WF / 2, 0, 0, tmp));
      frameScr.x = c0[0]; frameScr.y = c0[1]; frameScr.r = Math.max(40, Math.abs(c1[0] - c0[0]));
      for (const s of S) {
        const b = s.b, n = b.n;
        const rv = REDUCE && s.d.outer ? (Math.abs(C.angle) < 0.1 ? 1 : 0) : s.reveal;
        s.nVis = rv <= 0 ? 0 : Math.max(2, Math.ceil((n - 1) * rv) + 1);
        s.sr.fill(0);
        if (!s.nVis) continue;
        const tip = b.s[s.nVis - 1], hl = s.hl, root = s.d.root || 0.3;
        const wa = REDUCE ? 0 : s.d.wa != null ? s.d.wa : 0.025 + 0.03 * s.blur, wd = REDUCE ? 0 : s.d.wd != null ? s.d.wd : 0.08 + 0.15 * s.blur;   // 越遠的波越大（在畫面上看起來差不多）
        const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
        const fadeIn = s.d.fixed && !REDUCE ? sm(0.05, 0.75, el) : 1;   // 一直都在的兩條：第一次出現時淡入，不要一下子冒出來
        // 上下衝出去的兩條：那一格轉到旁邊時，衝出膠捲上下緣的部分貼回邊緣附近（兩側的畫格透視比較高，不然會碰到首頁上面的按鈕和字）；
        // 跟著膠捲轉動連續變，不會消失
        // 轉到旁邊時也把連出去的那段壓近膠捲那一面（離鏡頭近的會被透視放大很多）
        const side = s.d.fixed ? sm(0.1, 0.36, Math.abs(C.angle)) : 0, near = 1 - 0.85 * side, edge = 0.5 * H;
        // 浪頭很慢地升降（約 15 秒一次，高低差一成），像緞帶被氣流托起又放下；碰到首頁的字和按鈕時照樣讓開
        const breath = s.d.fixed && !REDUCE ? 1 + 0.1 * Math.sin(0.42 * el + s.phase) : 1, a0 = (1 - 0.92 * side) * breath;
        const amp = a0 * (s.d.fixed ? fitAmp(s, a0, near, edge) : 1);
        const lift = 1 + 0.22 * Math.max(0, hl) - 0.1 * Math.max(0, -hl);
        for (let k = 0; k < s.nVis; k++) {
          // WAVE：沿著走片方向前進的慢波（像水裡的緞帶）：平面上（垂直於帶子）一道、前後一道，波長、速度略有不同，不會同步
          const sk = b.s[k], dir = s.d.v < 0 ? -1 : 1;
          const sw = wa * (0.68 * Math.sin(0.6 * sk - dir * 0.5 * el + s.phase) + 0.32 * Math.sin(1.27 * sk + dir * 0.23 * el + s.phase * 2.3));
          const dz = wd * (0.7 * Math.sin(0.42 * sk - dir * 0.36 * el + s.phase * 1.7) + 0.3 * Math.sin(0.9 * sk + 0.29 * el + s.phase * 0.6));
          const dd = sw + s.disp[k];
          let pd = b.d[k] + b.bd[k] * dd + dz;
          if (pd < 0 && near < 1) pd *= near;
          let by0 = b.y[k];
          if (amp !== 1 && Math.abs(by0) > edge) by0 = Math.sign(by0) * (edge + (Math.abs(by0) - edge) * amp);
          const px = b.x[k] + b.bx[k] * dd + PAR * par.x * pd, py = by0 + b.by[k] * dd - PAR * par.y * pd;   // 視差：越深移越多，膠捲那一面（D = 0）不動
          s.px[k] = px; s.py[k] = py; s.pd[k] = pd;
          const a = C.angle + px / R, sa = Math.sin(a), co = Math.cos(a);
          world(px, py, pd, tmp); s.wx[k] = tmp[0]; s.wy[k] = tmp[1]; s.wz[k] = tmp[2];
          // 面的方向換到世界座標（那一格的 x 軸 = (cos a, 0, sin a)、y 軸向上、d 軸 = (sin a, 0, −cos a)）
          const nx = b.nx[k] * co + b.nd[k] * sa, ny = b.ny[k], nz = b.nx[k] * sa - b.nd[k] * co;
          let vx = cam[0] - tmp[0], vy = cam[1] - tmp[1], vz = cam[2] - tmp[2]; const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
          const f = nx * vx + ny * vy + nz * vz, sg = f < 0 ? -1 : 1;
          const fx = nx * sg, fy = ny * sg, fz = nz * sg;
          const diff = Math.max(0, fx * Lx + fy * Ly + fz * Lz);
          const hx = Lx + vx, hy = Ly + vy, hz = Lz + vz, hn = Math.hypot(hx, hy, hz);
          s.spec[k] = Math.pow(Math.max(0, (fx * hx + fy * hy + fz * hz) / hn), 48) * 0.3 * (1 - s.blur);   // 彎的地方一道淡淡的反光（太亮會像一條白線）
          const shade = ((0.58 + 0.5 * diff) / 0.87) * (0.8 + 0.2 * Math.min(1, Math.abs(f) * 3)) * lift;   // 環境光多一點，翻過去的地方不會暗成一片
          s.sh[k] = sg > 0 ? shade : -shade * 0.9;
          s.al[k] = Math.max(0, Math.min(1, (tip - b.s[k]) / FADE)) * Math.min(1, b.s[k] / root) * fadeIn;
          s.hz[k] = s.blur > 0 ? Math.min(0.45, 0.05 + s.blur * 0.4 + pd * 0.015) : Math.min(0.42, Math.max(0, pd - 0.5) * 0.13);
          s.bv[k] = s.blur > 0 ? s.blur : Math.min(0.34, Math.max(0, pd - 0.8) * 0.15);   // 景深：清楚的那幾條退到深處也會慢慢變糊，融進背景   // 霧主要給失焦的背景（看得出畫格、偏藍紫）；清楚的遠一點只變小、不變灰
          if (pd > 0) { onFrame(tmp, fx2); s.ex[k] = fx2[0]; s.ey[k] = fx2[1]; } else { s.ex[k] = 0; s.ey[k] = 0; }
        }
      }
    }

    // 一個頂點 12 個數：那一格的座標 xyz（世界單位）、uv、種子、亮度、透明度、長寬比、反光、霧、失焦
    function put(x, y, z, u, v, theme, sh, a, ar, sp, hz, bl) {
      if (buf.length - o < 64) { const nb = new Float32Array(buf.length * 2); nb.set(buf); buf = nb; }
      buf[o] = x; buf[o + 1] = y; buf[o + 2] = z; buf[o + 3] = u; buf[o + 4] = v; buf[o + 5] = theme;
      buf[o + 6] = sh; buf[o + 7] = a; buf[o + 8] = ar; buf[o + 9] = sp; buf[o + 10] = hz; buf[o + 11] = bl; o += NF;
    }
    // kind 0 光暈、1 膠捲、2 影子（投在膠捲那一面上）、4 暗影（投在後面的膠捲上）
    function emit(s, k0, k1, kind, rec) {
      const first = o / NF, b = s.b, ar = s.cell / (s.hw * 2);
      const w = kind === 0 ? s.hw * 2.15 : kind === 4 ? s.hw * 1.6 : s.hw * (1 + 0.04 * Math.max(0, s.hl));
      for (let k = k0; k <= k1; k++) {
        const u = b.s[k] / s.cell - s.scroll;
        if (kind === 2) {   // 影子：沿著光的方向投到膠捲那一面（D = 0）上，離得越遠越大、越淡
          const a = C.angle + s.px[k] / R, sa = Math.sin(a), co = Math.cos(a);
          const ll = Lx * co + Lz * sa, ld = Lx * sa - Lz * co, t = s.pd[k] / ld;
          const cx = s.px[k] - ll * t, cy = s.py[k] - Ly * t;
          let bx = b.bx[k], by = b.by[k]; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
          // 影子要軟：離得越遠越寬、越淡；離膠捲太遠（拱的頂端）就不投，不然投影會被拉成一條條細線
          const far = Math.min(1, Math.max(0, (t - 0.12) / 0.23)), ww = s.hw * (1.6 + t * 3.6), al = (0.2 * s.al[k] * (1 - far * far * (3 - 2 * far))) / (1 + t * 2.5);
          put(cx + bx * ww, cy + by * ww, 0, u, 0, s.theme, 1, al, ar, 0, 0, 0);
          put(cx - bx * ww, cy - by * ww, 0, u, 1, s.theme, 1, al, ar, 0, 0, 0);
          continue;
        }
        if (kind === 4) {   // 暗影：往右下（光從左上來）偏一點、稍微往後，軟軟地壓在後面的膠捲上
          const ox = s.px[k] + 0.08, oy = s.py[k] - 0.15, od = s.pd[k] + 0.05, al = 0.58 * s.al[k];
          put(ox + b.bx[k] * w, oy + b.by[k] * w, od + b.bd[k] * w, u, 0, s.theme, 1, al, ar, 0, 0, 0);
          put(ox - b.bx[k] * w, oy - b.by[k] * w, od - b.bd[k] * w, u, 1, s.theme, 1, al, ar, 0, 0, 0);
          continue;
        }
        const v0 = kind === 1 ? 0 : -0.575, v1 = kind === 1 ? 1 : 1.575, sp = kind === 1 ? s.spec[k] : 0;
        put(s.px[k] + b.bx[k] * w, s.py[k] + b.by[k] * w, s.pd[k] + b.bd[k] * w, u, v0, s.theme, s.sh[k], s.al[k], ar, sp, s.hz[k], s.bv[k]);
        put(s.px[k] - b.bx[k] * w, s.py[k] - b.by[k] * w, s.pd[k] - b.bd[k] * w, u, v1, s.theme, s.sh[k], s.al[k], ar, sp, s.hz[k], s.bv[k]);
        // 螢幕上的位置（給滑鼠判斷，每兩點算一次）：窗口裡的只算窗口看得到的那段
        if (rec && !(k & 1) && (s.pd[k] <= 0 || (Math.abs(s.ex[k]) < 0.44 && Math.abs(s.ey[k]) < 0.33))) {
          tmp[0] = s.wx[k]; tmp[1] = s.wy[k]; tmp[2] = s.wz[k];
          const c0 = toScreen(tmp), e = toScreen(world(s.px[k] + b.bx[k] * w, s.py[k] + b.by[k] * w, s.pd[k] + b.bd[k] * w, tmp2));
          s.sx[k] = c0[0]; s.sy[k] = c0[1]; s.sr[k] = Math.hypot(e[0] - c0[0], e[1] - c0[1]) * 1.02;
        }
      }
      return { first, count: o / NF - first };
    }
    function runs(s, test) {   // 連續符合條件的點（前後各多帶一點，兩段接起來看不到縫）
      const out = [], n = s.nVis; let k0 = -1;
      for (let k = 0; k < n; k++) {
        const inc = test(s, k) || (k > 0 && test(s, k - 1)) || (k + 1 < n && test(s, k + 1));
        if (inc) { if (k0 < 0) k0 = k; } else if (k0 >= 0) { if (k - 1 > k0) out.push([k0, k - 1]); k0 = -1; }
      }
      if (k0 >= 0 && n - 1 > k0) out.push([k0, n - 1]);
      return out;
    }
    // 一層：前後穿插的膠捲每 8 點切一段、由遠到近畫；深度一樣的整條一次畫（相鄰又接得上的段落合併成一次）。
    // 光暈只畫滑鼠碰到的那一條；drop 的在自己後面先畫一條暗影
    function layerItems(items, test, clip, rec) {
      const films = [];
      const key = (s, m) => { const dx = s.wx[m] - C.cam[0], dy = s.wy[m] - C.cam[1], dz = s.wz[m] - C.cam[2]; return dx * dx + dy * dy + dz * dz; };
      for (const s of S) {
        if (!s.nVis) continue;
        const rs = runs(s, test);
        const g = 0.35 * Math.max(0, s.hl) * (1 - s.blur);
        if (g > 0.02) for (const [k0, k1] of rs) items.push({ kind: 0, clip, glow: g, ...emit(s, k0, k1, 0, false) });
        for (const [k0, k1] of rs) {
          const sh = s.d.drop ? emit(s, k0, k1, 4, false) : null;
          const r = emit(s, k0, k1, 1, rec && s.blur < 0.3);   // 失焦的那幾條不給滑鼠碰
          const step = s.chunk ? 8 : k1 - k0;
          for (let j = k0; j < k1; j += step) {
            const j1 = Math.min(k1, j + step), m = (j + j1) >> 1, kk = key(s, m);
            if (sh) films.push({ kind: 4, clip: 1, first: sh.first + 2 * (j - k0), count: 2 * (j1 - j + 1), key: kk + 0.3 });
            films.push({ kind: 1, clip, first: r.first + 2 * (j - k0), count: 2 * (j1 - j + 1), key: kk });
          }
        }
      }
      films.sort((a, b) => b.key - a.key);
      for (const f of films) {
        const last = items[items.length - 1];
        if (last && last.kind === f.kind && last.clip === f.clip && f.first === last.first + last.count - 2) last.count += f.count - 2;
        else items.push(f);
      }
    }
    function labelItems(items) {   // 兩行字：貼在膠捲那一面上（跟著圓柱彎），每塊切 6 段
      if (!ltex) return;
      let v0 = 0;
      for (const [x0, y0, x1, y1] of LBOX) {
        const first = o / NF, v1 = v0 + (y1 - y0) / 144;
        for (let i = 0; i <= 6; i++) {
          const f = i / 6, lx = (x0 + (x1 - x0) * f) / 1024 - 0.5;
          for (const [yy, vv] of [[y0, v0], [y1, v1]]) put(lx * WF, (0.5 - yy / 768) * H, -0.002, f, vv, 0, 1, 1, 1, 0, 0, 0);
        }
        items.push({ kind: 3, clip: 0, first, count: 14 });
        v0 = v1;
      }
    }
    const isFront = (s, k) => s.pd[k] <= 0;
    const outsideFilm = (s, k) => s.pd[k] > 0 && Math.abs(s.ey[k]) > 0.44;   // 膠捲上下緣外面才看得到
    const inWindow = (s, k) => s.pd[k] > 0 && Math.abs(s.ex[k]) < 0.5 && Math.abs(s.ey[k]) < 0.4;

    // 每一格只算一次、只上傳一次：back 那次把三層都準備好，front、top 直接畫
    const L = { back: [], front: [], top: [] };
    let builtAt = -1, builtAng = NaN;
    function build(c) {
      geom();
      o = 0; L.back = []; L.front = []; L.top = [];
      layerItems(L.back, outsideFilm, 0, false);
      for (const s of S) { if (!s.nVis) continue; for (const [k0, k1] of runs(s, isFront)) L.front.push({ kind: 2, clip: 2, ...emit(s, k0, k1, 2, false) }); }
      layerItems(L.front, (s, k) => !s.d.top && inWindow(s, k), 1, true);   // 窗口裡的膠捲（主膠捲之外）
      layerItems(L.top, isFront, 0, true);                                    // 連出去的那幾段
      layerItems(L.top, (s, k) => s.d.top && inWindow(s, k), 1, true);     // 主膠捲：最上層（老師：中間那條圖層應該是最高的）
      labelItems(L.top);                                                       // 兩行字永遠看得到
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, o), gl.DYNAMIC_DRAW);
      for (const k in PROG) {   // 這一格的共用設定
        const P = PROG[k];
        gl.useProgram(P.p); gl.uniformMatrix4fv(P.u.uProj, false, c.proj); gl.uniform3fv(P.u.uCam, c.cam);
        gl.uniform1f(P.u.uAngle, c.angle); gl.uniform1f(P.u.uBend, c.bend); gl.uniform1f(P.u.uR, R); gl.uniform1f(P.u.uWF, WF); gl.uniform1f(P.u.uH, H);
        if (P.u.uAtlas) gl.uniform1i(P.u.uAtlas, 0);
        if (P.u.uLabel) gl.uniform1i(P.u.uLabel, 1);
        if (P.u.uGrid) gl.uniform2f(P.u.uGrid, atl.cols, atl.rows);
        if (P.u.uPad) gl.uniform2f(P.u.uPad, PADU, PADV);
        if (P.u.uFog) gl.uniform3fv(P.u.uFog, c.fog);
        if (P.u.uHaze) gl.uniform3f(P.u.uHaze, 0.2, 0.21, 0.36);   // 偏藍紫的暮色（參考圖背景膠捲的色調；原本 0.13,0.13,0.24 太暗）
        if (P.u.uSharp) gl.uniform1f(P.u.uSharp, atl.sharp);
        if (P.u.uClock) gl.uniform1f(P.u.uClock, atl.clock);
        if (P.u.uTime) gl.uniform1f(P.u.uTime, REDUCE ? 0 : now - t0);
        if (P.u.uHands) gl.uniform1f(P.u.uHands, atl.hands);
        if (P.u.uCrop) gl.uniform3f(P.u.uCrop, atl.crop[0], atl.crop[1], atl.crop[2]);
        if (P.u["uClockC[0]"]) gl.uniform3fv(P.u["uClockC[0]"], CLOCKS.flat());
      }
    }
    function draw(layer, c) {   // layer "back"（畫格之前）、"front"（畫格之後）、"top"（首頁膠捲前面的道具之後，最上層）
      if (c.suck > 0.01) return;
      seen = true; C = c;
      if (layer === "back" || builtAt !== now || builtAng !== c.angle) { build(c); builtAt = now; builtAng = c.angle; }
      const items = L[layer];
      if (!items || !items.length) return;
      gl.bindVertexArray(vao);
      gl.enable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      if (ltex) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ltex); gl.activeTexture(gl.TEXTURE0); }
      let cur = null;
      for (const d of items) {
        const P = d.kind === 0 ? PROG.glow : d.kind === 1 ? PROG.film : d.kind === 3 ? PROG.label : PROG.shadow;
        if (cur !== P) { gl.useProgram(P.p); cur = P; gl.blendFunc(gl.ONE, d.kind === 0 ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); }
        if (P.u.uClip) gl.uniform1i(P.u.uClip, d.clip);
        if (d.kind === 0) gl.uniform1f(P.u.uGlow, d.glow);
        gl.drawArrays(gl.TRIANGLE_STRIP, d.first, d.count);
      }
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }
    return {
      draw, step,
      pointer(x, y) {   // 滑鼠在畫面上的位置（null＝離開）
        const t = performance.now();
        if (x == null) { ptr = null; ptrPrev = null; ptrV = 0; return; }
        if (ptrPrev) { const dt = Math.max(8, t - ptrPrev.t) / 1000; ptrV = ptrV * 0.6 + (Math.hypot(x - ptrPrev.x, y - ptrPrev.y) / dt) * 0.4; }
        ptr = { x, y, t }; ptrPrev = ptr;
      },
      reset() { t0 = 0; seen = false; focus = false; S.forEach((s) => { s.reveal = REDUCE || s.d.fixed ? 1 : 0; }); },
    };
  }
  window.TimelineArt = { create };
})();
