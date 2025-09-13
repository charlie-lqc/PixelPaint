import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import logo from "./assets/logo.png";

/**
 * Pixel Paint Game — Storage V2 (robust, snapshot/progress split) + Fullscreen HUD + i18n + PNG export + Bomb tool
 * Fixes: old saves getting corrupted when creating a new artwork, duplicate saves, cross-artwork autosave bleed,
 * entering canvas without an image, and TS context typing issues.
 *
 * Storage V2:
 *  - List:          ppg:v2:list -> MetaV2[]
 *  - Snapshot:      ppg:v2:<id>:snap -> { cols, rows, palette, kIdx_b64 }
 *  - Progress:      ppg:v2:<id>:prog -> { mask_b64, counts:number[], hidden:number[] }
 *  - Migration: one-time from v1 keys if present.
 */

// ===== i18n =====
type Lang = "en" | "zh";
const i18n: Record<Lang, Record<string, string>> = {
  en: {
    title: "PixelPaint",
    home: "Home",
    board: "Board",
    language: "Language",
    english: "English",
    chinese: "中文",
    guide: "Guide",
    guide_title: "How to Play",
    guide_body: `
      <h3>Welcome!</h3>
      <p><b>Pixel Paint Game</b> turns any picture into a numbered pixel-art puzzle. Each cell shows a number. Pick a matching colour chip and paint by numbers to reveal the artwork.</p>
      <h3>What you can do</h3>
      <ul>
        <li><b>Upload & Configure</b>: Choose an image, set <b>Cells Across</b> (detail level), <b>Palette Size (K)</b>, and <b>Quality</b> (clustering iterations).</li>
        <li><b>Generate Board</b>: Creates a puzzle grid with numbers.</li>
        <li><b>Paint</b>: Select a colour chip then left-click (or drag) to fill matching-number cells.</li>
        <li><b>Brush Size</b>: Use the slider or the <b>[</b> and <b>]</b> keys.</li>
        <li><b>Pan & Zoom</b>: Right/Middle mouse to pan, mouse wheel to zoom at cursor.</li>
        <li><b>Fit/Reset/Fullscreen</b>: Quickly frame your artwork and focus.</li>
        <li><b>Bomb Tool</b>: Drag the bomb icon onto the canvas to rapidly fill the <b>selected colour</b> within a radius of <b>(cells across)/5</b>. The bomb shakes while dragging.</li>
        <li><b>Autosave</b>: Your progress is saved to your browser automatically.</li>
        <li><b>Gallery</b>: Re-open, export PNG, or delete saved artworks.</li>
        <li><b>Export Pixelated Upload</b>: Exports a pixelated PNG of the uploaded source based on your current "Cells Across".</li>
      </ul>
      <h3>Tips</h3>
      <ul>
        <li>Try <b>Cells Across</b> 64–256 and <b>K</b> 8–20 for a good balance.</li>
        <li>Pick a colour to highlight all matching cells that are not yet filled.</li>
        <li>Use the <b>Bomb</b> to quickly fill large same-colour regions (remember: all correct colours within a radius).</li>
      </ul>
      <h3>Controls</h3>
      <ul>
        <li><b>Left mouse</b>: paint (drag to keep painting)</li>
        <li><b>[</b> / <b>]</b>: decrease / increase brush size</li>
        <li><b>Right or Middle mouse</b>: pan</li>
        <li><b>Mouse wheel</b>: zoom at cursor</li>
        <li><b>Fit to frame</b>: scale the artwork to fit</li>
        <li><b>Fullscreen</b>: expand the artwork to fullscreen (palette, brush, bomb all usable)</li>
      </ul>
    `,
    upload_config: "1) Upload & Configure",
    title_label: "Title",
    upload_image: "Upload image",
    remove_image: "Remove image",
    export_pixelated: "Export pixelated upload",
    cells_across: "Cells Across",
    palette_size: "Palette size (K)",
    quality: "Quality (iterations)",
    autosave: "Autosave",
    enabled: "Enabled",
    generate_open_board: "Generate & Open Board",
    show_grid: "Show grid on board",
    tip: "Tip: 64–256 cells across; K 8–20.",
    gallery: "2) Gallery",
    no_saved: "No saved artworks yet. Generate one and it will auto-save here.",
    open: "Open",
    export_png: "Export PNG",
    delete: "Delete",
    back: "← Back",
    progress: "Progress",
    reset_fills: "Reset fills",
    save: "Save",
    brush: "Brush",
    reset_view: "Reset view",
    fit_to_frame: "Fit to frame",
    fullscreen: "Fullscreen",
    exit_fullscreen: "Exit Fullscreen",
    palette_label: "Palette",
    completed_title: "🎉 Completed!",
    completed_desc: "You filled every colour. Nice work.",
    save_to_gallery: "Save to Gallery",
    close: "Close",
    ok: "OK",
    hud_palette: "Palette",
    saving: "Saving…",
    saved: "Saved",
  },
  zh: {
    title: "像素填色游戏",
    home: "首页",
    board: "画板",
    language: "语言",
    english: "English",
    chinese: "中文",
    guide: "使用指南",
    guide_title: "如何游玩",
    guide_body: `
      <h3>简介</h3>
      <p><b>像素填色游戏</b>可将任意图片转换为带编号的像素谜题。每个格子有数字，选择对应颜色进行填色，最终还原整幅图像。</p>
      <h3>功能与玩法</h3>
      <ul>
        <li><b>上传与设置</b>：选择图片，设置<b>横向像素数量</b>、<b>调色板大小（K）</b>和<b>质量</b>（聚类迭代）。</li>
        <li><b>生成画板</b>：创建带编号的网格。</li>
        <li><b>涂色</b>：先从调色板选择颜色，左键点击或拖动涂色（仅能涂正确编号）。</li>
        <li><b>画笔大小</b>：使用滑块或 <b>[</b> / <b>]</b> 快捷键调整。</li>
        <li><b>拖拽与缩放</b>：右键/中键拖动画布，滚轮以光标为中心缩放。</li>
        <li><b>适配/重置/全屏</b>：快速调整视图；全屏下<b>调色板/画笔/炸弹</b>均可使用。</li>
        <li><b>炸弹工具</b>：将炸弹图标拖到画布，可在半径<b>(横向像素)/5</b>内快速填充<b>当前选中颜色</b>。拖动时炸弹会抖动。</li>
        <li><b>自动保存</b>：进度自动保存到浏览器。</li>
        <li><b>图库</b>：重新打开、导出 PNG 或删除作品。</li>
        <li><b>导出像素化原图</b>：根据当前“横向像素”导出上传图片的像素化 PNG。</li>
      </ul>
      <h3>提示</h3>
      <ul>
        <li>推荐<b>横向像素</b> 64–256，<b>K</b> 8–20。</li>
        <li>选择颜色后会高亮所有尚未填充的对应格子。</li>
        <li>使用<b>炸弹</b>快速填充大面积同色区域（注：范围内所有对应颜色）。</li>
      </ul>
      <h3>操作</h3>
      <ul>
        <li><b>左键</b>：涂色（拖动连续涂）</li>
        <li><b>[</b> / <b>]</b>：减小 / 增大画笔</li>
        <li><b>右键或中键</b>：拖动画布</li>
        <li><b>鼠标滚轮</b>：以光标为中心缩放</li>
        <li><b>适配窗口</b>：缩放以适配视窗</li>
        <li><b>全屏</b>：切换至全屏（全屏下可用调色板/画笔/炸弹）</li>
      </ul>
    `,
    upload_config: "1) 上传与设置",
    title_label: "标题",
    upload_image: "上传图片",
    remove_image: "移除图片",
    export_pixelated: "导出像素化原图",
    cells_across: "横向像素数量",
    palette_size: "调色板大小（K）",
    quality: "质量（迭代次数）",
    autosave: "自动保存",
    enabled: "启用",
    generate_open_board: "生成并打开画板",
    show_grid: "在画板显示网格",
    tip: "提示：横向像素 64–256；K 8–20。",
    gallery: "2) 图库",
    no_saved: "暂时没有已保存的作品。生成后会自动保存到这里。",
    open: "打开",
    export_png: "导出 PNG",
    delete: "删除",
    back: "← 返回",
    progress: "进度",
    reset_fills: "清除填色",
    save: "保存",
    brush: "画笔",
    reset_view: "重置视图",
    fit_to_frame: "适配窗口",
    fullscreen: "全屏",
    exit_fullscreen: "退出全屏",
    palette_label: "调色板",
    completed_title: "🎉 完成！",
    completed_desc: "你填满了所有颜色，干得漂亮。",
    save_to_gallery: "保存到图库",
    close: "关闭",
    ok: "确定",
    hud_palette: "调色板",
    saving: "保存中…",
    saved: "已保存",
  }
};

function useI18n() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("ppg:lang") as Lang) || "en");
  const t = useCallback((key: string) => (i18n[lang] && i18n[lang][key]) || i18n.en[key] || key, [lang]);
  const setLanguage = (l: Lang) => { setLang(l); localStorage.setItem("ppg:lang", l); };
  return { lang, setLanguage, t };
}

// ===== Types (Storage V2) =====
type MetaV2 = { id:string; title:string; createdAt:number; updatedAt:number; cols:number; rows:number; progress:number; thumb?:string };
type SnapV2 = { cols:number; rows:number; palette:number[][]; kIdx_b64:string };
type ProgV2 = { mask_b64:string; counts:number[]; hidden:number[] };
const LIST_KEY = 'ppg:v2:list';
const snapKey = (id:string)=>`ppg:v2:${id}:snap`;
const progKey = (id:string)=>`ppg:v2:${id}:prog`;

// ===== App =====
export default function App() {
  const { lang, setLanguage, t } = useI18n();

  // THEME
type ThemeMode = "light" | "dark" | "system";
const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
  return (localStorage.getItem("ppg:themeMode") as ThemeMode) || "system";
});
const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

// Resolve theme (follows system when in "system")
useEffect(() => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const compute = () =>
    setResolvedTheme(themeMode === "system" ? (mq.matches ? "dark" : "light") : themeMode);

  compute();
  const onChange = () => themeMode === "system" && compute();
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}, [themeMode]);

// Persist choice
useEffect(() => {
  localStorage.setItem("ppg:themeMode", themeMode);
}, [themeMode]);


  // --- Styles (cosmetics only; layout preserved) ---
    // --- Styles (cosmetics only; layout preserved) ---
  const styles = `:root{
  /* modern pastel-neon theme */
  --bg:#f7f7fb;
  --card:#ffffff;
  --text:#0f172a;
  --muted:#6b7280;
  --primary:#7c3aed;        /* violet-600 */
  --primary-600:#6d28d9;    /* violet-700 */
  --primary-300:#c4b5fd;
  --accent:#22c55e;         /* green-500 */
  --danger:#ef4444;         /* red-500 */
  --border:#e5e7eb;
  --chip-border:#cbd5e1;

  --grad:
    radial-gradient(1200px 800px at 10% -10%, #ede9fe 0%, transparent 40%),
    radial-gradient(1200px 800px at 100% 0%, #e7fbef 0%, transparent 45%);
  --shadow-sm: 0 1px 2px rgba(0,0,0,.06);
  --shadow-md: 0 6px 18px rgba(23,23,23,.08);
  --shadow-lg: 0 10px 35px rgba(23,23,23,.12);
}

/* Base */
*{ box-sizing:border-box }
body{
  margin:0;
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Inter,Helvetica,Arial;
  background:var(--bg);
  color:var(--text);
}
.app{
  min-height:100vh;
  position:relative;
  isolation:isolate;
  background:transparent;
}

/* Header */
.header{
  position:sticky; top:0; z-index:10;
  background:rgba(255,255,255,.7);
  backdrop-filter:blur(10px);
  border-bottom:1px solid var(--border);
}
.header-inner{
  max-width:1200px; margin:0 auto; padding:12px 16px;
  display:flex; align-items:center; justify-content:space-between;
}
.title{
  font-weight:900; font-size:22px; letter-spacing:.2px;
  background:linear-gradient(90deg,#7c3aed,#22c55e);
  -webkit-background-clip:text; background-clip:text; color:transparent;
}

/* Layout */
.container{ max-width:1200px; margin:0 auto; padding:16px; animation:fadeIn .35s ease }
.card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:16px;
  padding:16px;
  box-shadow:var(--shadow-sm);
  transition:box-shadow .25s ease, transform .2s ease;
}
.card:hover{ box-shadow:var(--shadow-md); }
.grid2{ display:grid; grid-template-columns:1fr 1fr; gap:16px }
.row{ display:flex; align-items:center; gap:10px; flex-wrap:wrap }
.label{ font-size:12px; font-weight:700; color:var(--muted); letter-spacing:.2px }
.small{ font-size:12px; color:var(--muted) }

/* Buttons */
.btn{
  position:relative;               /* for ripple */
  flex-shrink:0;
  width:auto;
  min-width:110px;
  padding:10px 20px;
  font-size:14px;
  font-weight:600;
  white-space:nowrap;
  border-radius:9999px;
  border:1px solid rgba(124,58,237,.25);
  background:#fff;
  color:var(--text);
  cursor:pointer;
  transition:transform .12s ease, box-shadow .2s ease, filter .2s ease;
  box-shadow:0 2px 6px rgba(0,0,0,.08);
}
.btn:hover{ box-shadow:0 6px 14px rgba(0,0,0,.12); transform:translateY(-1px) }
.btn:active{ transform:scale(.97) }
.btn:focus-visible{ outline:2px solid var(--primary-300); outline-offset:2px }

/* Ripple (centered; no JS) */
.btn::after{
  content:""; position:absolute; left:50%; top:50%;
  width:0; height:0; border-radius:9999px;
  background:radial-gradient(circle, rgba(124,58,237,.18), rgba(124,58,237,0) 60%);
  transform:translate(-50%,-50%); opacity:0; pointer-events:none;
  transition:width .45s ease, height .45s ease, opacity .6s ease;
}
.btn:active::after{ width:220px; height:220px; opacity:.9 }

.btn-primary{
  color:#fff !important;
  border-color:transparent !important;
  background:linear-gradient(180deg,var(--primary),var(--primary-600)) !important;
  box-shadow:0 6px 18px rgba(124,58,237,.25);
}
.btn-primary:hover{ filter:brightness(1.05) }

.btn-success{
  color:#fff !important;
  border-color:transparent !important;
  background:linear-gradient(180deg,var(--accent),#16a34a) !important;
  box-shadow:0 6px 18px rgba(34,197,94,.25);
}
.btn.exit-btn{
  background:#fff;
  border:1px solid rgba(124,58,237,.25);
  color:var(--text);
}

/* Inputs */
input[type="number"], input[type="text"], select{
  padding:8px 10px;
  border:1px solid var(--border);
  border-radius:10px;
  background:#fff;
  transition:border-color .2s ease, box-shadow .2s ease, transform .15s ease;
}
input[type="number"]:focus, input[type="text"]:focus, select:focus{
  border-color:var(--primary-300);
  box-shadow:0 0 0 4px rgba(124,58,237,.12);
  outline:none;
}

/* Sliders */
input[type="range"]{
  -webkit-appearance:none; width:100%; height:4px; border-radius:9999px;
  background:linear-gradient(90deg,var(--primary) 0%, var(--primary-300) 100%);
  outline:none; transition:filter .2s ease;
}
input[type="range"]::-webkit-slider-thumb{
  -webkit-appearance:none; appearance:none; width:18px; height:18px;
  border-radius:50%; background:#fff; border:2px solid var(--primary);
  box-shadow:0 2px 8px rgba(0,0,0,.15);
  transition:transform .12s ease, box-shadow .2s ease;
}
input[type="range"]::-webkit-slider-thumb:active{ transform:scale(1.05) }
input[type="range"]:hover{ filter:brightness(1.02) }

/* Viewport / canvas */
.viewport{
  height:70vh; border:1px solid var(--border); border-radius:16px; overflow:hidden; background:#fff; position:relative;
  box-shadow:var(--shadow-sm);
  animation:fadeIn .25s ease;
}
.inner{ position:absolute; transform-origin:0 0; transition:transform .06s linear }

/* Palette chips */
.palette{ display:flex; flex-wrap:wrap; gap:10px; align-items:center }
.chip{
  width:36px; height:36px; border-radius:9999px; border:1px solid var(--chip-border);
  display:flex; align-items:center; justify-content:center; cursor:pointer;
  transition:transform .1s, box-shadow .15s ease, filter .2s ease;
  box-shadow:0 2px 8px rgba(0,0,0,.06);
}
.chip:hover{ transform:translateY(-1px); box-shadow:0 6px 16px rgba(0,0,0,.12) }
.chip:active{ transform:translateY(0) scale(.96) }
.chip.selected{
  box-shadow:0 0 0 3px #00000012, 0 0 0 2px var(--primary) inset, 0 8px 20px rgba(124,58,237,.25);
  animation:breath 1.6s ease-in-out infinite;
}
.chip .num{ font-size:11px; font-weight:900; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.45) }

/* Zoom bar & badges */
.zoombar{ display:flex; align-items:center; gap:8px; flex-wrap:wrap }
.zoombar .pct{ width:60px; text-align:center; font-size:12px }
.badge{
  min-width:28px; height:28px; padding:0 8px; border-radius:9999px;
  display:inline-flex; align-items:center; justify-content:center;
  background:#0f172a; color:#fff; font-size:12px; font-weight:700; border:1px solid #00000020;
  box-shadow:0 3px 12px rgba(0,0,0,.18);
}

/* Gallery */
.gallery{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px }
.thumb{
  width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid var(--border); border-radius:12px; background:#fff;
  box-shadow:var(--shadow-sm);
}

/* Modals */
.modal{
  position:fixed; inset:0; background:rgba(15,23,42,.35); display:grid; place-items:center; z-index:50;
  animation:fadeIn .2s ease;
}
.modal-card{
  background:#fff; padding:20px; border-radius:16px; max-width:640px; width:92%; text-align:left;
  box-shadow:var(--shadow-lg); animation:scaleIn .2s ease;
}

/* Fullscreen HUD + modal */
.fsHud{
  position:absolute; left:0; right:0; bottom:0; padding:16px;
  background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.98));
  border-top:1px solid var(--border); display:flex; flex-direction:column; gap:8px; z-index:9999;
  animation:fadeUp .25s ease;
}
.hudRow{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:space-between }
.hudScroll{ display:flex; gap:8px; overflow-x:auto; padding-bottom:4px }
.hudScroll::-webkit-scrollbar{ height:8px }
.hudScroll::-webkit-scrollbar-thumb{ background:rgba(0,0,0,.15); border-radius:9999px }

.fsBrushRow{
  display:flex; align-items:center; gap:12px;
  background:rgba(255,255,255,.92); backdrop-filter:blur(8px);
  border:1px solid rgba(124,58,237,.18); border-radius:14px;
  box-shadow:0 8px 28px rgba(124,58,237,.12), 0 2px 6px rgba(0,0,0,.06);
  padding:8px 12px;
}
.fsHud .label{ color:var(--text); font-weight:800 }
.fsHud input[type="range"]{ height:6px; background:linear-gradient(90deg,var(--primary) 0%,var(--primary-300) 100%) }
.fsHud input[type="range"]::-webkit-slider-thumb{ width:18px; height:18px; border:2px solid var(--primary); background:#fff; border-radius:50% }
.fsHud .badge{ background:#0f172a; color:#fff; border:1px solid #00000020; box-shadow:0 3px 12px rgba(0,0,0,.18) }

/* FS HUD text buttons */
.fsBrushRow .btn{ /* inherits .btn; overrides where needed */
  min-width:110px;
}
.fsBrushRow .btn:active{ transform:scale(.97) }
.fsBrushRow .btn.save-btn{
  color:#fff;
  border-color:transparent;
  background:linear-gradient(180deg,var(--primary),var(--primary-600));
  box-shadow:0 6px 18px rgba(124,58,237,.25);
}
.fsBrushRow .btn.exit-btn{
  background:#fff;
  border:1px solid rgba(124,58,237,.25);
  color:var(--text);
}
.fsBrushRow .bombBtn{ margin:0 6px }

/* Bomb */
.bombBtn{
  width:56px; height:56px; border-radius:14px;
  display:inline-flex; align-items:center; justify-content:center;
  border:1px solid rgba(124,58,237,.3);
  background:radial-gradient(120% 120% at 40% 30%,#fff 0%,#f4f3ff 100%);
  box-shadow:0 4px 12px rgba(0,0,0,.12);
  color:#111827; /* ensures icon (currentColor) is dark in light mode */
}
.bombBtn:hover{ box-shadow:0 6px 18px rgba(0,0,0,.18) }
.bombIcon{ width:32px; height:32px; display:block; color:#111827 }
.theme-dark .bombIcon{ color:var(--text) }
.bombGhost{
  position:fixed; pointer-events:none; z-index:9000; will-change:transform;
  filter:drop-shadow(0 6px 12px rgba(0,0,0,.25));
}
.shake{ animation:shake .25s infinite }
@keyframes shake{
  0%{ transform:translate(-50%,-50%) rotate(-6deg) }
  25%{ transform:translate(-50%,-50%) rotate(6deg) }
  50%{ transform:translate(-50%,-50%) rotate(-4deg) }
  75%{ transform:translate(-50%,-50%) rotate(4deg) }
  100%{ transform:translate(-50%,-50%) rotate(-6deg) }
}
.radiusRing{
  position:absolute; border:2px dashed rgba(124,58,237,.6);
  border-radius:50%; pointer-events:none; z-index:8999; background:rgba(124,58,237,.08);
  animation:pulse 1.1s ease-in-out infinite;
}

/* Animations */
@keyframes fadeUp{ from{opacity:0} to{opacity:1} }
@keyframes pop{ from{opacity:0} to{opacity:1} }
@keyframes fadeIn{ from{opacity:0} to{opacity:1} }
@keyframes scaleIn{ from{opacity:0; transform:scale(.98)} to{opacity:1; transform:scale(1)} }
@keyframes pulse{
  0%,100%{ opacity:.65 }
  50%{ opacity:.25 }
}
@keyframes breath{
  0%,100%{ box-shadow:0 0 0 3px #00000012, 0 0 0 2px var(--primary) inset, 0 8px 20px rgba(124,58,237,.15) }
  50%{ box-shadow:0 0 0 5px #00000010, 0 0 0 2px var(--primary) inset, 0 14px 28px rgba(124,58,237,.28) }
}

/* Accessibility */
@media (prefers-reduced-motion:reduce){
  .card, .container, .viewport, .modal, .fsHud, .fsModal, .chip, .btn, .radiusRing{ animation:none !important; transition:none !important }
  .app::before, .app::after{ animation:none !important }
}

/* Animated, mouse-reactive background */
.app::before{
  content:""; position:fixed; inset:0; z-index:-1; pointer-events:none;
  --violet:var(--primary,#7c3aed);
  --violet-300:var(--primary-300,#c4b5fd);
  --blue:#60a5fa;
  --green:var(--accent,#22c55e);
  background:
    radial-gradient(1200px 900px at calc(var(--mx,50)*1%) calc(var(--my,50)*1%), color-mix(in oklab,var(--violet) 45%, white 55%) 0%, transparent 55%),
    radial-gradient(1000px 800px at calc(100% - var(--mx)*1%) calc(var(--my)*1%), color-mix(in oklab,#8b5cf6 40%, white 60%) 0%, transparent 60%),
    radial-gradient(1200px 900px at calc(var(--mx)*1%) calc(100% - var(--my)*1%), color-mix(in oklab,var(--green) 40%, white 60%) 0%, transparent 55%),
    linear-gradient(180deg,#fbfbfe 0%, #f6f8ff 60%, #f4fff9 100%);
  filter:saturate(1.05);
  animation:ppg-gradient-pan 22s ease-in-out infinite alternate;
}
@keyframes ppg-gradient-pan{
  0%{ transform:translate3d(0,0,0) scale(1); filter:saturate(1) brightness(1) }
  50%{ transform:translate3d(0,-1.5%,0) scale(1.01); filter:saturate(1.05) brightness(1.02) }
  100%{ transform:translate3d(0,1.5%,0) scale(1.015); filter:saturate(1.08) brightness(1.02) }
}
.app::after{
  content:""; position:fixed; inset:-10vh; z-index:-1; pointer-events:none;
  background:conic-gradient(from 0deg at 50% 50%, #ffffff00 0 70%, #ffffff08 85%, #ffffff00 100%);
  animation:ppg-sheen 14s linear infinite;
  mix-blend-mode:soft-light;
}
@keyframes ppg-sheen{
  0%{ transform:translateX(-4%) rotate(.0001deg) }
  100%{ transform:translateX(4%) rotate(.0001deg) }
}

/* Footer */
.footer{
  position:fixed; bottom:0; left:0; right:0;
  text-align:center; padding:10px; font-size:13px;
  color:var(--muted); background:transparent;
}

/* ===== Dark theme overrides ===== */
.theme-dark{
  --bg:#0b1220;
  --card:#0f172a;           /* slate-900-ish */
  --text:#e5e7eb;           /* slate-200 */
  --muted:#94a3b8;          /* slate-400 */
  --primary:#8b5cf6;        /* violet-500/600 */
  --primary-600:#7c3aed;
  --primary-300:#a78bfa;
  --accent:#22c55e;
  --danger:#ef4444;
  --border:#1f2937;         /* slate-800 */
  --chip-border:#334155;    /* slate-700 */
}
.theme-dark .header{
  background:rgba(15,23,42,.7);
  border-bottom:1px solid var(--border);
}
.theme-dark .card{ background:var(--card) }
.theme-dark input[type="number"],
.theme-dark input[type="text"],
.theme-dark select{
  background:#0b1220; color:var(--text); border-color:var(--border);
}
.theme-dark .small{ color:var(--muted) }
.theme-dark .btn{
  background:#0b1220; color:var(--text);
  border:1px solid rgba(139,92,246,.25);
}
.theme-dark .btn-primary{
  color:#fff !important;
  background:linear-gradient(180deg,var(--primary),var(--primary-600)) !important;
  border-color:transparent !important;
}
.theme-dark input[type="range"]{
  background:linear-gradient(90deg,var(--primary) 0%, var(--primary-300) 100%);
}
.theme-dark input[type="range"]::-webkit-slider-thumb{
  background:#0b1220; border:2px solid var(--primary);
}
.theme-dark .viewport{ background:#0b1220 }
.theme-dark .modal-card,
.theme-dark .fsModalCard{ background:#0f172a; color:var(--text) }
.theme-dark .fsHud{
  background:linear-gradient(180deg,rgba(15,23,42,0),rgba(15,23,42,.98));
  border-top:1px solid var(--border);
}
.theme-dark .fsBrushRow{
  background:rgba(15,23,42,.92);
  border:1px solid rgba(139,92,246,.18);
}
.theme-dark .chip .num{ color:#fff }
.theme-dark [data-theme-mode] .btn[aria-pressed="true"]{
  box-shadow:0 6px 18px rgba(124,58,237,.25);
}

/* Dark theme background override */
.app.theme-dark::before{
  background:
    radial-gradient(1100px 800px at calc(var(--mx,50)*1%) calc(var(--my,50)*1%), color-mix(in oklab, var(--primary) 40%, black 60%) 0%, transparent 55%),
    radial-gradient(900px 700px at calc(100% - var(--mx,50)*1%) calc(var(--my,50)*1%), color-mix(in oklab, #60a5fa 35%, black 65%) 0%, transparent 60%),
    radial-gradient(1100px 800px at calc(var(--mx,50)*1%) calc(100% - var(--my,50)*1%), color-mix(in oklab, var(--accent) 40%, black 60%) 0%, transparent 55%),
    linear-gradient(180deg,#0b1220 0%, #0f172a 60%, #0b1b16 100%);
  filter:saturate(1);
}
.app.theme-dark::after{
  background:conic-gradient(from 0deg at 50% 50%, #ffffff00 0 70%, #ffffff0a 85%, #ffffff00 100%);
  mix-blend-mode:soft-light;
}

/* Dark-mode readability: guide modal */
.theme-dark .guideTitle{ /* keep gradient title */ }
.theme-dark .guideSub{ color:var(--muted) }
.theme-dark .guideBody{ color:var(--text) }
.theme-dark .guideBody b{ color:#ffffff }
.theme-dark .guideBody h3{ color:#e5e7eb }
.theme-dark .guideBody p{ color:var(--text) }
.theme-dark .guideBody code,
.theme-dark .guideBody kbd{
  background:#0b1220; border:1px solid var(--border); color:#e5e7eb;
}
.theme-dark .guideChip{
  background:#0b1220; border:1px solid rgba(139,92,246,.25); color:var(--text);
}
.theme-dark .guideBody li::before{
  background: radial-gradient(120% 120% at 30% 30%, var(--primary) 0%, var(--primary-300) 70%);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--primary-300) 70%, black 30%) inset,
              0 2px 6px rgba(124,58,237,.35);
}
.theme-dark .badge{ background:#0f172a; color:#fff; border:1px solid #00000040 }
.theme-dark .bombBtn,
.theme-dark .btn.exit-btn{ color:#0f172a }   /* keep white buttons readable on dark */
.theme-dark .zoombar .pct{ color:var(--text) }
.theme-dark .card h2{ color:var(--text) }
.theme-dark input[type="file"]{
  background:#0b1220; color:var(--text); border:1px solid var(--border);
}
.theme-dark .fsBrushRow .btn.exit-btn{
  background:#ffffff; border:1px solid var(--border); color:#0f172a;
}
.theme-dark .guideFooter .btn.exit-btn{
  background:#1e293b; border:1px solid rgba(139,92,246,.35); color:#f1f5f9;
}
.theme-dark .guideFooter .btn.exit-btn:hover{
  background:#334155; filter:brightness(1.05);
}

/* Guide modal polish (light) */
.modal-card.guideCard{
  max-width:900px; width:min(92vw,900px); padding:24px 22px;
  border-radius:18px; border:1px solid rgba(124,58,237,.20);
  box-shadow:0 16px 50px rgba(17,24,39,.18);
  background:
    radial-gradient(120% 120% at 10% -10%, #f5f3ff 0%, transparent 40%),
    radial-gradient(120% 120% at 110% 0%, #eefcf4 0%, transparent 45%),
    #fff;
}
.guideTitle{
  margin:0 0 10px 0; font-size:22px; font-weight:900; letter-spacing:.2px;
  background:linear-gradient(90deg,#7c3aed,#22c55e);
  -webkit-background-clip:text; background-clip:text; color:transparent;
}
.guideSub{ margin:0 0 14px 0; color:var(--muted); font-size:13px }
.guideScroll{ max-height:min(70vh,720px); overflow:auto; padding-right:6px }
.guideScroll::-webkit-scrollbar{ width:8px }
.guideScroll::-webkit-scrollbar-thumb{ background:rgba(17,24,39,.18); border-radius:9999px }
.guideBody{ font-size:14.5px; line-height:1.7; color:var(--text) }
.guideBody h3{ margin:18px 0 8px; font-size:16px; font-weight:800; color:#111827 }
.guideBody p{ margin:8px 0 10px }
.guideBody ul{ margin:8px 0 14px; padding:0; list-style:none }
.guideBody li{ position:relative; padding-left:22px; margin:8px 0 }
.guideBody li::before{
  content:""; position:absolute; left:0; top:.58em;
  width:10px; height:10px; border-radius:50%;
  background:radial-gradient(120% 120% at 30% 30%, #7c3aed 0%, #a78bfa 70%);
  box-shadow:0 0 0 2px #ede9fe inset, 0 2px 6px rgba(124,58,237,.3);
}
.guideBody b{ font-weight:800; color:#0f172a }
.guideBody code, .guideBody kbd{
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
  background:#f3f4f6; border:1px solid #e5e7eb; padding:.1rem .35rem; border-radius:6px; font-size:12.5px
}
.guideChips{ display:flex; gap:8px; flex-wrap:wrap; margin:6px 0 10px }
.guideChip{
  font-size:12px; font-weight:700; color:#111827;
  background:#fff; border:1px solid rgba(124,58,237,.25);
  border-radius:9999px; padding:6px 10px;
  box-shadow:0 2px 6px rgba(0,0,0,.06);
}
.guideFooter{ display:flex; justify-content:flex-end; gap:8px; margin-top:14px }

/* Two-column guide layout on wide screens */
@media (min-width:900px){
  .guideBody{ column-count:2; column-gap:32px }
  .guideBody h3{ break-inside:avoid }
  .guideBody ul, .guideBody p{ break-inside:avoid }
}

/* Logo */
.logoWrap{ display:flex; align-items:center; gap:8px }
.logoImg{ height:42px; width:auto; display:block }

/* File input */
input[type="file"]{ color:var(--text) }

/* === FIX: restore dark mode for the Guide modal === */
.theme-dark .modal-card.guideCard{
  background:
    radial-gradient(120% 120% at 10% -10%, #171331 0%, transparent 40%),
    radial-gradient(120% 120% at 110% 0%, #0d2a22 0%, transparent 45%),
    #0f172a;
  border:1px solid rgba(139,92,246,.25);
  box-shadow:0 16px 50px rgba(0,0,0,.55);
  color:var(--text);
}

/* keep guide text/accents readable in dark */
.theme-dark .guideTitle{ /* gradient already fine */ }
.theme-dark .guideSub{ color:var(--muted) }
.theme-dark .guideBody{ color:var(--text) }
.theme-dark .guideBody h3{ color:#e5e7eb }
.theme-dark .guideBody b{ color:#ffffff }
.theme-dark .guideBody code,
.theme-dark .guideBody kbd{
  background:#0b1220;
  border:1px solid var(--border);
  color:#e5e7eb;
}
.theme-dark .guideBody li::before{
  background: radial-gradient(120% 120% at 30% 30%, var(--primary) 0%, var(--primary-300) 70%);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--primary-300) 70%, black 30%) inset,
              0 2px 6px rgba(124,58,237,.35);
}
.theme-dark .guideChip{
  background:#0b1220;
  border:1px solid rgba(139,92,246,.25);
  color:var(--text);
}
.theme-dark .guideScroll::-webkit-scrollbar-thumb{
  background:rgba(148,163,184,.28);
}
  `;


  // Request persistent storage (best-effort)
  useEffect(()=>{ // @ts-ignore
    if (navigator?.storage?.persist) navigator.storage.persist().catch(()=>{});
  }, []);

  // ===== UI state =====
  const [view, setView] = useState<"home" | "board">("home");
  const [srcURL, setSrcURL] = useState<string | null>(null);
  const [imgMeta, setImgMeta] = useState<{ w: number; h: number } | null>(null);

  const [cellsAcross, setCellsAcross] = useState(69);
  const [paletteSize, setPaletteSize] = useState(12);
  const [iterations, setIterations] = useState(10);
  const [showGrid, setShowGrid] = useState(true);
  const [brush, setBrush] = useState(1);
  const [autosave, setAutosave] = useState(true);
  const dragActiveRef = useRef(false);
  const suppressPrettyDuringDragRef = useRef(true); // toggle if you want grid while dragging

  const [palette, setPalette] = useState<number[][]>([]);
  const [cols, setCols] = useState(0);
  const [rows, setRows] = useState(0);
  const [selected, setSelected] = useState(0);

  // In-memory per-artwork snapshot cache: immutable
  const snapStoreRef = useRef<Record<string, SnapV2>>({});
  const maskRef = useRef<Uint8Array | null>(null);
  const countsRef = useRef<Uint32Array | null>(null);
  const hiddenRef = useRef<Uint8Array | null>(null);
  const kIdxRef = useRef<Uint8Array | null>(null);
  const dragRAFRef = useRef<number | null>(null);
  const lastDragIndexRef = useRef<number | null>(null);

  // Current session/state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const [homeTitle, setHomeTitle] = useState<string>("");
  const [boardTitle, setBoardTitle] = useState<string>("");
  const [gallery, setGallery] = useState<MetaV2[]>([]);
  const [savingFlash, setSavingFlash] = useState<"idle"|"saving"|"saved">("idle");
  const [showCongrats, setShowCongrats] = useState(false);
  const doneRef = useRef(false);

  // Tracks mouse for animated background
  const appRef = useRef<HTMLDivElement | null>(null);

  // Viewport / interaction
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(()=>{ if (!offscreenRef.current) offscreenRef.current = document.createElement("canvas"); }, []);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({x:0,y:0});
  const [isFullscreen, setIsFullscreen] = useState(false);

  const draggingRef = useRef(false);
  const panningRef = useRef(false);
  const panStateRef = useRef({ active:false, startX:0, startY:0, startOffX:0, startOffY:0 });

  const [tick, setTick] = useState(0);
  const [cellPx, setCellPx] = useState(24);
  const rafRef = useRef<number | null>(null);
  const scheduleTick = useCallback(()=>{
    if (rafRef.current!=null) return;
    rafRef.current = requestAnimationFrame(()=>{ rafRef.current = null; setTick(t=>t+1); });
  },[]);

  // Bomb tool state
  const [bombArmed, setBombArmed] = useState(false);
  const [bombDragging, setBombDragging] = useState(false);
  const bombPosRef = useRef<{x:number;y:number}>({x:0,y:0}); // viewport client coords while dragging

  // ===== Migration from v1 (one-time) =====
  useEffect(()=>{ try{ migrateV1ToV2(); }catch(e){ console.warn("migration skipped", e); } setGallery(loadListV2()); }, []);

  const brushOffsetsRef = useRef<Map<number, Array<[number,number]>>>(new Map());

function getBrushOffsets(r:number){
  let map = brushOffsetsRef.current;
  if (map.has(r)) return map.get(r)!;
  const r2 = r*r;
  const arr: [number, number][] = [];;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx*dx + dy*dy <= r2) arr.push([dx,dy]);
    }
  }
  map.set(r, arr);
  return arr;
}



  // ===== File handling =====
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  function handleFile(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if(!f) return;
    const url = URL.createObjectURL(f);
    setSrcURL(prev=>{ if(prev) URL.revokeObjectURL(prev); return url; });
    const img = new Image();
    img.onload = ()=>{ setImgMeta({ w: img.naturalWidth, h: img.naturalHeight }); setCellsAcross(69); };
    img.src = url;
  }

  function exportPixelatedUpload(){
    if (!srcURL || !imgMeta) return;
    const across = Math.max(1, Math.min(cellsAcross || 69, imgMeta.w));
    const down = Math.max(1, Math.round((imgMeta.h / imgMeta.w) * across));
    const base = document.createElement('canvas'); base.width = across; base.height = down;
    const bctx = base.getContext('2d') as CanvasRenderingContext2D | null;
    if (!bctx) return;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = ()=>{
      bctx.imageSmoothingEnabled = true;
      bctx.clearRect(0,0,across,down);
      bctx.drawImage(img, 0, 0, across, down);
      const cell = 24;
      const out = document.createElement('canvas'); out.width = across*cell; out.height = down*cell;
      const octx = out.getContext('2d') as CanvasRenderingContext2D;
      octx.imageSmoothingEnabled = false;
      octx.drawImage(base, 0,0, out.width, out.height);
      triggerDownload((homeTitle?.trim() || 'pixelated') + '.png', out.toDataURL('image/png'));
    };
    img.src = srcURL;
  }

  // ===== Build board (create NEW artwork & persist snapshot immediately) =====
  async function buildBoard(){
    if (!srcURL || !imgMeta || !offscreenRef.current){ setShowNoImage(true); return; }

    // Save previous session progress
    finalizeSave("switch-new");

    // Downsample and quantize
    const w = imgMeta.w, h = imgMeta.h;
    const across = Math.max(1, Math.min(cellsAcross, w));
    const down = Math.max(1, Math.round((h / w) * across));
    const total = across * down;

    const cvs = offscreenRef.current; const ctx = cvs.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null; if(!ctx) return;
    cvs.width = across; cvs.height = down;
    const img = await loadImage(srcURL);
    ctx.clearRect(0,0,across,down); (ctx as any).imageSmoothingEnabled = true; ctx.drawImage(img,0,0,across,down);
    const data = ctx.getImageData(0,0,across,down).data;

    const K = clamp(paletteSize, 2, 48);
    const points: number[][] = new Array(total);
    for (let i=0;i<total;i++) points[i] = [data[4*i], data[4*i+1], data[4*i+2]];
    const { centers, labels } = kmeans(points, K, clamp(iterations,3,30));

    // Sort palette by luminance and remap labels
    const withIdx = centers.map((c,idx)=>({idx,c,lum:0.2126*c[0]+0.7152*c[1]+0.0722*c[2]})).sort((a,b)=>a.lum-b.lum);
    const remap: Record<number,number> = {}; withIdx.forEach((w,i)=>remap[w.idx]=i);
    const sortedPalette = withIdx.map(w=>w.c.map(x=>Math.round(x)));
    const kIdx = new Uint8Array(total);
    kIdxRef.current = kIdx; // cache decoded labels
    for (let i=0;i<total;i++) kIdx[i] = remap[labels[i]];

    // Create new item in V2 storage with zero mask
    const zeroMask = new Uint8Array(total);
    const counts = new Uint32Array(sortedPalette.length);
    for(let i=0;i<total;i++) counts[kIdx[i]]++;

    const id = genId();
    const finalTitle = (homeTitle && homeTitle.trim()) ? homeTitle.trim() : genTitle();
    const snap: SnapV2 = { cols: across, rows: down, palette: sortedPalette as number[][], kIdx_b64: toB64(kIdx) };
    const prog: ProgV2 = { mask_b64: toB64(zeroMask), counts: Array.from(counts), hidden: Array(sortedPalette.length).fill(0) };
    const thumb = renderThumbFromData(across, down, sortedPalette as number[][], kIdx, zeroMask, 256);
    const meta: MetaV2 = { id, title: finalTitle, createdAt: Date.now(), updatedAt: Date.now(), cols: across, rows: down, progress: 0, thumb };
    saveNewItemV2(meta, snap, prog);

    // Prepare session (immutable snap stored, separate progress refs)
    snapStoreRef.current[id] = snap;
    maskRef.current = zeroMask.slice(); // own copy
    countsRef.current = counts.slice();
    hiddenRef.current = new Uint8Array(sortedPalette.length);

    setPalette(sortedPalette as number[][]);
    setCols(across); setRows(down);
    // dynamic cell size to keep canvas memory reasonable
    {
      const maxDim = 6000; const px = Math.max(8, Math.min(24, Math.floor(maxDim / Math.max(across, down))));
      setCellPx(px);
    }
    setSelected(0);
    setBoardTitle(finalTitle);
    doneRef.current = false;

    setSessionId(id);
    setView("board");
    setZoom(1); setOffset({x:0,y:0});

    // Clear configurator for next creation
    resetConfigurator();
  }

  // ===== Open saved artwork =====
  function openSaved(id: string){
    finalizeSave("switch-open");
    const snap = loadSnapV2(id); const prog = loadProgV2(id);
    if(!snap || !prog) return;

    // Cache immutable snapshot
    snapStoreRef.current[id] = snap;
    kIdxRef.current = fromB64(snap.kIdx_b64);

    setPalette(snap.palette as number[][]);
    setCols(snap.cols); setRows(snap.rows);
    {
      const maxDim = 6000; const px = Math.max(8, Math.min(24, Math.floor(maxDim / Math.max(snap.cols, snap.rows))));
      setCellPx(px);
    }
    maskRef.current = fromB64(prog.mask_b64);
    countsRef.current = Uint32Array.from(prog.counts);
    hiddenRef.current = Uint8Array.from(prog.hidden || []);
    setSelected(0);
    doneRef.current = maskRef.current.every(v=>v===1);

    setSessionId(id);
    const m = loadListV2().find(x=>x.id===id);
    setBoardTitle(m?.title || "");

    setView("board"); setZoom(1); setOffset({x:0,y:0});
  }

  // ===== Rendering =====
  function resizeCanvases(){
    const base = baseCanvasRef.current; const over = overlayCanvasRef.current; if(!base||!over) return;
    base.width = cols*cellPx; base.height = rows*cellPx;
    over.width = base.width; over.height = base.height;
  }
  function drawGrid(ctx: CanvasRenderingContext2D){
    if(!showGrid) return;
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.beginPath();
    for(let x=0;x<=cols;x++){ ctx.moveTo(x*cellPx+0.5,0); ctx.lineTo(x*cellPx+0.5, rows*cellPx); }
    for(let y=0;y<=rows;y++){ ctx.moveTo(0,y*cellPx+0.5); ctx.lineTo(cols*cellPx, y*cellPx+0.5); }
    ctx.stroke();
  }
  function renderFullBase(){
    const base = baseCanvasRef.current; const ctx = (base?.getContext("2d") as CanvasRenderingContext2D | null); if(!base||!ctx) return;
    ctx.clearRect(0,0,base.width,base.height);
    const mask = maskRef.current; const sid = sessionId; if(!mask||!sid) return;
    const snap = snapStoreRef.current[sid]; if(!snap) return;
    const pal = snap.palette; const kIdx = kIdxRef.current!;
    for(let y=0;y<rows;y++){
      for(let x=0;x<cols;x++){
        const i = y*cols+x;
        if(mask[i]){ ctx.fillStyle = rgbStr(pal[kIdx[i]]); ctx.fillRect(x*cellPx,y*cellPx,cellPx,cellPx); }
        else {
          ctx.fillStyle = "#fff"; ctx.fillRect(x*cellPx,y*cellPx,cellPx,cellPx);
          ctx.fillStyle = "#1f2937"; ctx.font = "bold 12px ui-sans-serif, system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(String(kIdx[i]+1), x*cellPx + cellPx/2, y*cellPx + cellPx/2 + 0.5);
        }
      }
    }
    drawGrid(ctx);
  }
  function renderHighlights(){
    const over = overlayCanvasRef.current; const ctx = (over?.getContext("2d") as CanvasRenderingContext2D | null); if(!over||!ctx) return;
    ctx.clearRect(0,0,over.width,over.height);
    const mask = maskRef.current; const sid = sessionId; if(!mask||!sid) return;
    const snap = snapStoreRef.current[sid]; if(!snap) return;
    const kIdx = kIdxRef.current!;
    if (hiddenRef.current && hiddenRef.current[selected]) return;
    ctx.fillStyle = "rgba(108,92,231,0.18)";
    for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){ const i=y*cols+x; if(mask[i]) continue; if(kIdx[i]===selected){ ctx.fillRect(x*cellPx,y*cellPx,cellPx,cellPx); } }
  }
  function drawCellFilled(i:number){
    const base = baseCanvasRef.current; const ctx = (base?.getContext("2d") as CanvasRenderingContext2D | null); if(!base||!ctx) return;
    const sid = sessionId; if(!sid) return;
    const snap = snapStoreRef.current[sid]; if(!snap) return;
    const kIdx = kIdxRef.current!;
    const x = (i%cols)*cellPx; const y = Math.floor(i/cols)*cellPx;
    ctx.fillStyle = rgbStr(snap.palette[kIdx[i]]); ctx.fillRect(x,y,cellPx,cellPx);
    if(showGrid && !dragActiveRef.current){
      ctx.strokeStyle="#000"; ctx.lineWidth=1; ctx.strokeRect(x+0.5,y+0.5,cellPx-1,cellPx-1);
    }
  }

  // ===== Interaction =====
  function getCellIndexFromEvent(e: React.MouseEvent): number | null {
    const vp = viewportRef.current; const base = baseCanvasRef.current; if(!vp||!base) return null;
    const rect = vp.getBoundingClientRect();
    const cx = (e.clientX - rect.left - offset.x) / zoom;
    const cy = (e.clientY - rect.top  - offset.y) / zoom;
    if(cx<0||cy<0||cx>=base.width||cy>=base.height) return null;
    const x = Math.floor(cx / cellPx); const y = Math.floor(cy / cellPx);
    return y*cols + x;
  }
  function paintAt(index:number){
    const mask = maskRef.current; const sid = sessionId; if(!mask||!sid) return;
    const snap = snapStoreRef.current[sid]; if(!snap) return;
    const kIdx = kIdxRef.current!;
    if (index<0 || index>=mask.length) return;
    if (mask[index]) return;
    if (kIdx[index] !== selected) return;
    mask[index] = 1;
    drawCellFilled(index);
    // clear highlight for this cell only

    if (!dragActiveRef.current) {
      const over = overlayCanvasRef.current;
      const octx = (over?.getContext("2d") as CanvasRenderingContext2D | null);
      if (octx){ const x=(index%cols)*cellPx, y=Math.floor(index/cols)*cellPx; octx.clearRect(x,y,cellPx,cellPx); }
    }
    
    
    if (countsRef.current){ const c = --countsRef.current[kIdx[index]]; if (c === 0){ if (hiddenRef.current) hiddenRef.current[kIdx[index]] = 1; if (selected === kIdx[index]){ const next = findNextAvailableColour(kIdx[index], snap.palette.length); setSelected(next); } } }
  }
  function paintAtIgnoreSelection(index:number){
  const mask = maskRef.current; const sid = sessionId; if(!mask||!sid) return;
  const snap = snapStoreRef.current[sid]; if(!snap) return;
  const kIdx = kIdxRef.current!;
  if (index<0 || index>=mask.length) return;
  if (mask[index]) return; // already filled

  // Mark filled and draw immediately
  mask[index] = 1;
  drawCellFilled(index);

  // clear highlight for this cell only
  const over = overlayCanvasRef.current; 
  const octx = (over?.getContext("2d") as CanvasRenderingContext2D | null);
  if(octx){ const x=(index%cols)*cellPx, y=Math.floor(index/cols)*cellPx; octx.clearRect(x,y,cellPx,cellPx); }

  // update counts / auto-advance only if we just exhausted the CURRENT selection
  if (countsRef.current){
    const colour = kIdx[index];
    const c = --countsRef.current[colour];
    if (c === 0){
      if (hiddenRef.current) hiddenRef.current[colour] = 1;
      if (colour === selected){
        const next = findNextAvailableColour(colour, snap.palette.length);
        setSelected(next);
      }
    }
  }
}
  function paintBrush(centerIndex:number){
    const cx = centerIndex % cols; const cy = Math.floor(centerIndex/cols);
    const r = Math.max(0, brush - 1);
    const offs = getBrushOffsets(r);
    const mask = maskRef.current!;
    const kIdx = kIdxRef.current!;
    const want = selected;            // color index we’re allowed to paint
    const sid = sessionId!; const snap = snapStoreRef.current[sid]; const pal = snap.palette;
    const ctx = baseCanvasRef.current?.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return;
    const fill = rgbStr(pal[want]);
    ctx.fillStyle = fill;

    for (let k=0; k<offs.length; k++){
      const dx = offs[k][0], dy = offs[k][1];
      const x = cx + dx, y = cy + dy;
      if (x<0 || x>=cols || y<0 || y>=rows) continue;
      const i = y*cols + x;
     if (!mask[i] && kIdx[i] === want){
    mask[i] = 1;     // Direct draw without extra lookups:
    ctx.fillRect(x*cellPx, y*cellPx, cellPx, cellPx);
    if (!dragActiveRef.current && showGrid) {
      ctx.strokeStyle="#000"; ctx.lineWidth=1; ctx.strokeRect(x*cellPx+0.5, y*cellPx+0.5, cellPx-1, cellPx-1);
    }
    // counts/auto-advance bookkeeping
    if (countsRef.current){
      const c = --countsRef.current[want];
      if (c===0){
        if (hiddenRef.current) hiddenRef.current[want] = 1;
        if (selected === want){
          const next = findNextAvailableColour(want, pal.length);
          setSelected(next);
        }
      }
    }
  }
    }
    scheduleTick();
  }
  function findNextAvailableColour(start:number, K:number){
    const hidden = hiddenRef.current; if(!hidden) return start;
    for(let step=1; step<=K; step++){ const i = (start+step)%K; if(!hidden[i]) return i; }
    return start;
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2 || e.button === 1) {
      panningRef.current = true;
      panStateRef.current = { active:true, startX:e.clientX, startY:e.clientY, startOffX:offset.x, startOffY:offset.y };
      return;
    }
    const idx = getCellIndexFromEvent(e); if(idx==null) return; draggingRef.current = true; dragActiveRef.current = true;
    lastDragIndexRef.current = idx;
    if (dragRAFRef.current == null) {
        dragRAFRef.current = requestAnimationFrame(() => {
          dragRAFRef.current = null;
          const i = lastDragIndexRef.current;
          if (i != null) paintBrush(i);
        });
      }

  };
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (panningRef.current && panStateRef.current.active){
      const dx=e.clientX-panStateRef.current.startX, dy=e.clientY-panStateRef.current.startY;
      setOffset({x:panStateRef.current.startOffX+dx, y:panStateRef.current.startOffY+dy}); return;
    }
    if (!draggingRef.current) return; const idx = getCellIndexFromEvent(e); if(idx==null) return;
    lastDragIndexRef.current = idx;
    if (dragRAFRef.current == null) {
        dragRAFRef.current = requestAnimationFrame(() => {
          dragRAFRef.current = null;
          const i = lastDragIndexRef.current;
          if (i != null) paintBrush(i);
        });
      }
  };
  const handleCanvasMouseUp = () => { draggingRef.current = false; panningRef.current = false; panStateRef.current.active = false;
    if (dragActiveRef.current) {
      dragActiveRef.current = false;
      // One-shot redraw of highlights & grid when stroke ends
      renderHighlights();
      if (showGrid) {
        const base = baseCanvasRef.current;
        const ctx = base?.getContext("2d") as CanvasRenderingContext2D | null;
        if (ctx) drawGrid(ctx);
      }
    }

    if (dragRAFRef.current != null) { cancelAnimationFrame(dragRAFRef.current); dragRAFRef.current = null; }
  };
  const handleContextMenu = (e: React.MouseEvent) => { e.preventDefault(); };
  const handleAppMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 2 || e.button === 1) {
      panningRef.current = true;
      panStateRef.current = { active:true, startX:e.clientX, startY:e.clientY, startOffX:offset.x, startOffY:offset.y };
    }
  };
  useEffect(()=>{
    const onMove = (e: MouseEvent) => {
      if (panningRef.current && panStateRef.current.active) {
        const dx = e.clientX - panStateRef.current.startX;
        const dy = e.clientY - panStateRef.current.startY;
        setOffset({ x: panStateRef.current.startOffX + dx, y: panStateRef.current.startOffY + dy });
      }
      if (bombDragging) {
        bombPosRef.current = { x: e.clientX, y: e.clientY };
        scheduleTick();
      }
    };
    const onUp = (e: MouseEvent) => {
      // Drop bomb if dragging
      if (bombDragging) {
        dropBombAtClient(e.clientX, e.clientY);
      }
      panningRef.current = false; panStateRef.current.active = false;
      setBombDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [bombDragging]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const vp = viewportRef.current; const base = baseCanvasRef.current; if(!vp||!base) return;
    const rect = vp.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - offset.x) / zoom;
    const worldY = (mouseY - offset.y) / zoom;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = clamp(zoom * factor, 0.2, 8);
    setZoom(newZoom);
    setOffset({ x: mouseX - worldX * newZoom, y: mouseY - worldY * newZoom });
  };

  // re-render highlights on selection / paint
  useEffect(()=>{ renderHighlights(); }, [selected]);
  useEffect(()=>{ if(cols>0 && rows>0){ resizeCanvases(); renderFullBase(); renderHighlights(); } }, [cols, rows, cellPx, showGrid]);

  // Fit to frame
  function fitToFrame(c=cols, r=rows){
    const vp = viewportRef.current; const base = baseCanvasRef.current; if(!vp||!base) return;
    const availW = vp.clientWidth - 16; const availH = vp.clientHeight - 16;
    const scale = Math.max(0.1, Math.min(availW / base.width, availH / base.height));
    setZoom(scale); setOffset({ x: (availW - base.width*scale)/2, y: (availH - base.height*scale)/2 });
  }

  // Progress
  const progress = useMemo(()=>{
    const m = maskRef.current; if(!m) return 0; let f=0; for(let i=0;i<m.length;i++) f+=m[i]; return Math.round((f/m.length)*100);
  }, [tick]);

  // Congrats
  useEffect(()=>{
    const m = maskRef.current; if (!m) return; const isDone = m.every(v=>v===1);
    if (isDone && !doneRef.current){ doneRef.current = true; setShowCongrats(true); if (autosave && sessionId) saveCurrent("completed"); }
    else if (!isDone && doneRef.current){ doneRef.current = false; }
  }, [tick, autosave, sessionId]);

  // Autosave debounced and session-guarded
  const autosaveTimer = useRef<number | null>(null);
  const autosaveBlockUntilRef = useRef<number>(0);
  useEffect(()=>{
    if (!autosave) return; if (!sessionId) return; if (!maskRef.current) return;
    if (Date.now() < autosaveBlockUntilRef.current) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    const current = sessionId;
    autosaveTimer.current = window.setTimeout(()=>{ if (current !== sessionId) return; saveNowV2(current, "autosave"); }, 400);
    return ()=>{ if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current); };
  }, [tick, autosave, sessionId]);

  // Before unload: best-effort save
  useEffect(()=>{
    const onBefore = () => { try{ if (sessionId) saveNowV2(sessionId, "unload"); }catch{} };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [sessionId, boardTitle]);
  
  //Background animation
  useEffect(() => {
  const el = appRef.current; if (!el) return;
  const onMove = (e: MouseEvent) => {
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty('--mx', x.toFixed(2));
    el.style.setProperty('--my', y.toFixed(2));
  };
  window.addEventListener('mousemove', onMove);
  return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Fullscreen
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  function toggleFullscreen(){
    const el = viewportRef.current; if (!el) return;
    if (!document.fullscreenElement) (el as any).requestFullscreen?.();
    else (document as any).exitFullscreen?.();
  }

  // Save helpers (V2)
  function saveNowV2(id:string, reason:string){
    try{
      const snap = snapStoreRef.current[id]; if (!snap) return;
      if (!maskRef.current || !countsRef.current || !hiddenRef.current) return;
      setSavingFlash("saving");
      const prog: ProgV2 = {
        mask_b64: toB64(maskRef.current),
        counts: Array.from(countsRef.current),
        hidden: Array.from(hiddenRef.current)
      };
      // Update meta progress & updatedAt; only recompute thumb occasionally (here on completed)
      const pct = Math.round((Array.from(maskRef.current).reduce((a,b)=>a+b,0) / (snap.cols*snap.rows))*100);
      const meta = loadListV2();
      const idx = meta.findIndex(m=>m.id===id);
      if (idx>=0){
        meta[idx] = { ...meta[idx], title: boardTitle, progress: pct, updatedAt: Date.now(), thumb: (pct===100? renderThumbFromData(snap.cols, snap.rows, snap.palette, fromB64(snap.kIdx_b64), maskRef.current, 256) : meta[idx].thumb) };
      }
      saveProgV2(id, prog);
      saveListV2(dedupeById(meta));
      setGallery(loadListV2());
      setSavingFlash("saved");
      setTimeout(()=>setSavingFlash("idle"), 700);
    }catch(e){ console.warn("save failed", e); setSavingFlash("idle"); }
  }
  function saveCurrent(reason:string){ if (!sessionId) return; saveNowV2(sessionId, reason); }
  function finalizeSave(reason:string){
    try{
      if (!sessionId) return;
      // block autosave briefly across session switch
      autosaveBlockUntilRef.current = Date.now() + 1000;
      saveNowV2(sessionId, reason);
      if (autosaveTimer.current) { window.clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
    }catch{}
  }

  // ===== UI guards =====
  function resetConfigurator(){
    try{
      if (srcURL) { try{ URL.revokeObjectURL(srcURL); }catch{} }
    }catch{}
    setSrcURL(null);
    setImgMeta(null);
    setHomeTitle("");
    setCellsAcross(69);
    setPaletteSize(12);
    setIterations(10);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  const hasSession = !!sessionId && !!snapStoreRef.current[sessionId];
  useEffect(()=>{ if (view==="board" && !hasSession) setView("home"); }, [view, hasSession]);

  // ===== PNG export (current board render) =====
  function downloadPNGCurrent(){
    if (!sessionId) return;
    const snap = snapStoreRef.current[sessionId]; if (!snap) return;
    if (!maskRef.current) return;
    const dataUrl = renderPNGFromData(snap.cols, snap.rows, snap.palette, fromB64(snap.kIdx_b64), maskRef.current, 24, showGrid);
    const name = (boardTitle && boardTitle.trim() ? boardTitle.trim() : "artwork") + ".png";
    triggerDownload(name, dataUrl);
  }
  function exportPNG(id:string){
    const snap = loadSnapV2(id); const prog = loadProgV2(id); if(!snap||!prog) return;
    const dataUrl = renderPNGFromData(snap.cols, snap.rows, snap.palette, fromB64(snap.kIdx_b64), fromB64(prog.mask_b64), 24, true);
    const meta = loadListV2().find(m=>m.id===id);
    const name = (meta?.title && meta.title.trim() ? meta.title.trim() : "artwork") + ".png";
    triggerDownload(name, dataUrl);
  }

  // Delete artwork and clear all related state (inside component scope so refs are visible)
  const deleteArtworkEverywhere = useCallback((id:string)=>{
    deleteItemV2(id);
    try{ delete (snapStoreRef.current as any)[id]; }catch{}
    if (sessionId === id){
      maskRef.current = null;
      countsRef.current = null;
      hiddenRef.current = null;
      setSessionId(null);
      setCols(0); setRows(0);
      setPalette([]); setSelected(0);
      setShowCongrats(false);
      setView("home");
    }
    setGallery(loadListV2());
  }, [sessionId]);

  // Ensure correct artwork renders on first open after mount/route change
  useLayoutEffect(()=>{
    if (view !== "board") return;
    const sid = (currentIdRef.current ?? sessionId);
    if (!sid) return;
    if (cols <= 0 || rows <= 0) return;
    resizeCanvases();
    renderFullBase();
    renderHighlights();
    fitToFrame(cols, rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, sessionId, cols, rows]);

  // ===== Bomb logic =====
  function armBomb() {
    setBombArmed(true);
    setBombDragging(true);
  }
  function bombRadiusCells(): number {
    return Math.max(1, Math.floor((cols || cellsAcross || 69) / 20));
  }
  function clientToCellCoords(clientX:number, clientY:number): {cx:number; cy:number} | null {
    const vp = viewportRef.current; const base = baseCanvasRef.current; if(!vp||!base) return null;
    const rect = vp.getBoundingClientRect();
    const xIn = (clientX - rect.left - offset.x) / zoom;
    const yIn = (clientY - rect.top  - offset.y) / zoom;
    if (xIn < 0 || yIn < 0 || xIn >= base.width || yIn >= base.height) return null;
    return { cx: Math.floor(xIn / cellPx), cy: Math.floor(yIn / cellPx) };
  }
  function dropBombAtClient(clientX:number, clientY:number){
    setBombDragging(false);
    if (!bombArmed) return;
    setBombArmed(false);
    const grid = clientToCellCoords(clientX, clientY);
    if (!grid) return;
    const { cx, cy } = grid;
    const r = bombRadiusCells();
    const r2 = r*r;
    const sid = sessionId; if (!sid) return;
    const snap = snapStoreRef.current[sid]; if (!snap) return;
    const kIdx = fromB64(snap.kIdx_b64);
    for(let dy=-r; dy<=r; dy++){
      const y = cy + dy; if (y<0 || y>=rows) continue;
      for(let dx=-r; dx<=r; dx++){
        const x = cx + dx; if (x<0 || x>=cols) continue;
        if (dx*dx + dy*dy > r2) continue;
        const i = y*cols + x;
        // Bomb fills only currently selected colour (game rule)
        if (maskRef.current && !maskRef.current[i]) {
          paintAtIgnoreSelection(i);
        }
      }
    }
    scheduleTick();;
  }

  // ===== UI =====
  const [showGuide, setShowGuide] = useState(false);
  const [showNoImage, setShowNoImage] = useState(false);

  // Keyboard shortcuts for brush
  useEffect(()=>{
    const onKey = (e: KeyboardEvent)=>{
      if (e.key === '[') setBrush(b=>Math.max(1,b-1));
      if (e.key === ']') setBrush(b=>Math.min(20,b+1));
    };
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
  ref={appRef}
  className={`app ${resolvedTheme === "dark" ? "theme-dark" : ""}`}
  data-theme-mode={themeMode}
  onMouseDown={handleAppMouseDown}
  onMouseUp={handleCanvasMouseUp}
  onMouseLeave={handleCanvasMouseUp}
  onContextMenu={handleContextMenu}
>
      <style>{styles}</style>

      <header className="header">
        <div className="header-inner">
          <div className="logoWrap">

            <img src={logo} alt="PixelPaint Logo" className="logoImg" />

          </div>
          <div className="row">
            <div className="row" style={{ gap: 6 }}>
  <button
    className="btn"
    title={resolvedTheme === "dark" ? "Switch to light" : "Switch to dark"}
    onClick={() => setThemeMode((m) => (m === "dark" ? "light" : "dark"))}
    aria-pressed={resolvedTheme === "dark"}
  >
    {resolvedTheme === "dark" ? "🌙 Dark" : "☀️ Light"}
  </button>

  <select
    className="small"
    value={themeMode}
    onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
    title="Theme mode"
    style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 8 }}
  >
    <option value="light">Light</option>
    <option value="dark">Dark</option>
    <option value="system">System</option>
  </select>
</div>
            <button className="btn" onClick={()=>setShowGuide(true)}>{t("guide")}</button>
            <label className="small" style={{display:"inline-flex",alignItems:"center",gap:6}}>
              {t("language")}
              <select value={lang} onChange={(e)=>setLanguage(e.target.value as Lang)} style={{padding:6,border:"1px solid var(--border)",borderRadius:8}}>
                <option value="en">{t("english")}</option>
                <option value="zh">{t("chinese")}</option>
              </select>
            </label>
            <button className="btn" onClick={()=>setView("home")}>{t("home")}</button>
            <button className="btn" disabled={!hasSession} onClick={()=> hasSession && setView("board")}>{t("board")}</button>
          </div>
        </div>
      </header>

      {view === "home" && (
        <main className="container">
          <div className="grid2">
            <section className="card">
              <h2 style={{fontWeight:700,marginBottom:12}}>{t("upload_config")}</h2>

              <div className="row">
                <label className="label">{t("title_label")}</label>
                <input value={homeTitle} onChange={(e)=>setHomeTitle(e.target.value)} placeholder=""
                  style={{padding:8,border:"1px solid var(--border)",borderRadius:8,width:260}}/>
              </div>

              <label className="label" style={{display:"block",marginTop:12}}>{t("upload_image")}</label>
              <div className="row" style={{marginTop:6}}>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile}/>
                <button className="btn" onClick={()=>{ if(srcURL){ try{ URL.revokeObjectURL(srcURL); }catch{} } setSrcURL(null); setImgMeta(null); if(fileInputRef.current) fileInputRef.current.value=""; }}>{t("remove_image")}</button>
                <button className="btn btn-primary" onClick={exportPixelatedUpload}>{t("export_pixelated")}</button>
              </div>

              <div className="controls" style={{marginTop:16}}>
                <div>
                  <div className="label">{t("cells_across")}</div>
                  <input type="range" min={0} max={420} step={1} value={cellsAcross} onChange={(e)=>setCellsAcross(parseInt(e.target.value))} style={{width:"100%"}}/>
                  <input type="number" min={0} max={420} value={cellsAcross} onChange={(e)=>setCellsAcross(Number(e.target.value))} className="small" style={{width:"100%",padding:6,border:"1px solid var(--border)",borderRadius:8,marginTop:6}}/>
                  <div className="small" style={{marginTop:6}}>
                    {cellsAcross === 69 ? "This is a nice number" : (cellsAcross === 420 ? "if you know, you know" : (cellsAcross === 690 ? "69 (nice) * 10" : cellsAcross))}
                  </div>
                </div>
                <div>
                  <div className="label">{t("palette_size")}</div>
                  <input type="range" min={2} max={48} step={1} value={paletteSize} onChange={(e)=>setPaletteSize(parseInt(e.target.value))} style={{width:"100%"}}/>
                  <div className="small">{paletteSize}</div>
                </div>
                <div>
                  <div className="label">{t("quality")}</div>
                  <input type="range" min={3} max={30} step={1} value={iterations} onChange={(e)=>setIterations(parseInt(e.target.value))} style={{width:"100%"}}/>
                  <div className="small">{iterations}</div>
                </div>
                <div>
                  <div className="label">{t("autosave")}</div>
                  <label className="small" style={{display:"inline-flex",alignItems:"center",gap:8}}>
                    <input type="checkbox" checked={autosave} onChange={(e)=>setAutosave(e.target.checked)}/> {t("enabled")}
                  </label>
                </div>
              </div>

              <div style={{marginTop:16}} className="row">
                <button className="btn btn-primary" onClick={buildBoard}>{t("generate_open_board")}</button>
                <label className="small" style={{display:"inline-flex",alignItems:"center",gap:8}}>
                  <input type="checkbox" checked={showGrid} onChange={(e)=>{setShowGrid(e.target.checked); setTimeout(()=>renderFullBase(),0);}}/> {t("show_grid")}
                </label>
                <div className="small">{t("tip")}</div>
              </div>
            </section>

            <section className="card">
              <h2 style={{fontWeight:700,marginBottom:12}}>{t("gallery")}</h2>
              {gallery.length===0 ? (
                <div className="small">{t("no_saved")}</div>
              ) : (
                <div className="gallery">
                  {gallery.map((g)=> (
                    <div key={g.id} className="card" style={{padding:10}}>
                      {g.thumb ? <img className="thumb" src={g.thumb} alt={g.title}/> : <div className="thumb"/>}
                      <div style={{marginTop:8,fontWeight:700}}>{g.title}</div>
                      <div className="small">{g.cols}×{g.rows} • {g.progress}%</div>
                      <div className="row" style={{marginTop:8}}>
                        <button className="btn" onClick={()=>openSaved(g.id)}>{t("open")}</button>
                        <button className="btn" onClick={()=>exportPNG(g.id)}>{t("export_png")}</button>
                        <button className="btn" onClick={()=>deleteArtworkEverywhere(g.id)}>{t("delete")}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      )}

      {view === "board" && hasSession && (
        <main className="container">
          <div className="card">
            <div className="row" style={{justifyContent:"space-between"}}>
              <div className="row">
                <button className="btn" onClick={()=>setView("home")}>{t("back")}</button>
                <div className="small">{t("title_label")}:</div>
                <input value={boardTitle} onChange={(e)=>setBoardTitle(e.target.value)} style={{padding:6,border:"1px solid var(--border)",borderRadius:8,width:220}}/>
                <div className="small">{t("progress")}: <b>{progress}%</b></div>
                <button className="btn" onClick={()=>{ const m=maskRef.current; if(!m) return; m.fill(0); if(countsRef.current){ countsRef.current.fill(0); const sid=sessionId; if(sid){ const kIdx = kIdxRef.current!; for(let i=0;i<kIdx.length;i++) countsRef.current[kIdx[i]]++; } } if(hiddenRef.current){ hiddenRef.current.fill(0); } renderFullBase(); renderHighlights(); scheduleTick(); doneRef.current=false; }}>{t("reset_fills")}</button>
                <button className="btn" onClick={()=>saveCurrent("manual")}>{t("save")}</button>
                <button className="btn" onClick={()=>downloadPNGCurrent()}>{t("export_png")}</button>
                {/* Bomb button (icon only) */}
                <button className="btn bombBtn" title="Bomb" onMouseDown={(e)=>{ e.preventDefault(); armBomb(); bombPosRef.current={x:e.clientX,y:e.clientY}; }}>
                  <svg viewBox="0 0 24 24" className="bombIcon" aria-hidden="true">
  <path d="M15 9a6 6 0 1 1-8.485 8.485A6 6 0 0 1 15 9Z" fill="currentColor"/>
  <path d="M15 9l2.5-2.5m0 0-.5-2 2 .5 1.5-1.5 1 1-1.5 1.5.5 2-2-.5L17.5 6.5Z" stroke="#ef4444" strokeWidth="1.5" fill="none"/>
  <circle cx="9" cy="15" r="1" fill="#fff"/>
  </svg>
                </button>
                <button className="btn" onClick={toggleFullscreen}>{isFullscreen ? t("exit_fullscreen") : t("fullscreen")}</button>
              </div>
              <div className="zoombar">
                <div className="row">
                  <div className="label">{t("brush")}</div>
                  <input type="range" min={1} max={20} step={1} value={brush} onChange={(e)=>setBrush(parseInt(e.target.value))}/>
                  <div className="small" style={{minWidth:24,textAlign:"center"}}>{brush}</div>
                </div>
                <button className="btn" onClick={()=>setZoom(z=>Math.max(0.2, +(z-0.2).toFixed(2)))}>−</button>
                <div className="pct">{(zoom*100).toFixed(0)}%</div>
                <button className="btn" onClick={()=>setZoom(z=>Math.min(8, +(z+0.2).toFixed(2)))}>+</button>
                <button className="btn" onClick={()=>{setZoom(1); setOffset({x:0,y:0});}}>{t("reset_view")}</button>
                <button className="btn" onClick={()=>fitToFrame()}>{t("fit_to_frame")}</button>
                {savingFlash !== "idle" && <span className="small" style={{marginLeft:6}}>• {savingFlash==="saving" ? t("saving") : t("saved")}</span>}
              </div>
            </div>

            <div
              ref={viewportRef}
              className="viewport"
              onWheel={handleWheel}
              onMouseDown={(e)=>{ if (bombDragging){ e.stopPropagation(); } }}
            >
              <div className="inner" style={{ transform:`translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
                <canvas id="baseCanvas" ref={baseCanvasRef} width={cols*cellPx} height={rows*cellPx} onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp}></canvas>
                <canvas ref={overlayCanvasRef} width={cols*cellPx} height={rows*cellPx} style={{position:"absolute",left:0,top:0,pointerEvents:"none"}}></canvas>
              </div>

              {/* Bomb drag visuals (ghost + radius), ensure visible in fullscreen */}
              {bombDragging && (
                <>
                  <div
                    className={"bombGhost shake"}
                    style={{
                      left: bombPosRef.current.x,
                      top: bombPosRef.current.y,
                      position: "fixed",
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="bombIcon" style={{width:28,height:28}} aria-hidden="true">
                      <path d="M15 9a6 6 0 1 1-8.485 8.485A6 6 0 0 1 15 9Z" fill="#111827"/>
                      <path d="M15 9l2.5-2.5m0 0-.5-2 2 .5 1.5-1.5 1 1-1.5 1.5.5 2-2-.5L17.5 6.5Z" stroke="#ef4444" strokeWidth="1.5" fill="none"/>
                      <circle cx="9" cy="15" r="1" fill="#fff"/>
                    </svg>
                  </div>
                  {/* radius ring in viewport coords */}
                  {(() => {
                    const vp = viewportRef.current;
                    const base = baseCanvasRef.current;
                    if (!vp || !base) return null;
                    const rect = vp.getBoundingClientRect();
                    // convert client to canvas pixel coords
                    const worldX = (bombPosRef.current.x - rect.left - offset.x) / zoom;
                    const worldY = (bombPosRef.current.y - rect.top  - offset.y) / zoom;
                    const radiusPx = bombRadiusCells() * cellPx * zoom;
                    const cx = rect.left + offset.x + worldX * zoom;
                    const cy = rect.top  + offset.y + worldY * zoom;
                    return (
                      <div className="radiusRing" style={{
                        position:"fixed",
                        left: cx - radiusPx,
                        top: cy - radiusPx,
                        width: radiusPx * 2,
                        height: radiusPx * 2,
                      }}/>
                    );
                  })()}
                </>
              )}

              {isFullscreen && (
                <div className="fsHud" onMouseDown={(e)=>e.stopPropagation()} onMouseUp={(e)=>e.stopPropagation()} onContextMenu={(e)=>e.stopPropagation()}>
                  <div className="hudRow">
                    <div className="row">
                      <div className="label" style={{fontWeight:700}}>{t("hud_palette")}:</div>
                      <div className="hudScroll">
                        {palette.map((rgb,i)=> {
                          const hidden = !!hiddenRef.current && !!hiddenRef.current[i];
                          if (hidden) return null;
                          return (
                            <button key={i} className={"chip"+(selected===i?" selected":"")} style={{background:rgbStr(rgb)}} onClick={()=>{setSelected(i);}} title={`Color #${i+1}`}>
                              <span className="num">{i+1}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="fsBrushRow">
                      <div className="label">{t("brush")}</div>
                      <input type="range" min={1} max={20} step={1} value={brush} onChange={(e)=>setBrush(parseInt(e.target.value))}/>
                      <div className="badge" aria-label="brush-size">{brush}</div>
                      {/* FS Bomb */}
                      <button className="btn bombBtn" title="Bomb" onMouseDown={(e)=>{ e.preventDefault(); armBomb(); bombPosRef.current={x:e.clientX,y:e.clientY}; }}>
                        <svg viewBox="0 0 24 24" className="bombIcon" aria-hidden="true">
  <path d="M15 9a6 6 0 1 1-8.485 8.485A6 6 0 0 1 15 9Z" fill="currentColor"/>
  <path d="M15 9l2.5-2.5m0 0-.5-2 2 .5 1.5-1.5 1 1-1.5 1.5.5 2-2-.5L17.5 6.5Z" stroke="#ef4444" strokeWidth="1.5" fill="none"/>
  <circle cx="9" cy="15" r="1" fill="#fff"/>
  </svg>
                      </button>
                      <button className="btn save-btn" onClick={()=>saveCurrent("hud")}>{t("save")}</button>
                      <button className="btn exit-btn" onClick={toggleFullscreen}>{t("exit_fullscreen")}</button>
                    </div>
                  </div>
                </div>
              )}

              {isFullscreen && showCongrats && (
                <div className="fsModal" onClick={()=>setShowCongrats(false)}>
                  <div className="fsModalCard" onClick={(e)=>e.stopPropagation()}>
                    <h2 style={{marginTop:0}}>{t("completed_title")}</h2>
                    <p>{t("completed_desc")}</p>
                    <div className="row" style={{justifyContent:"center",marginTop:10}}>
                      <button className="btn btn-success" onClick={()=>{setShowCongrats(false); saveCurrent("completed");}}>{t("save_to_gallery")}</button>
                      <button className="btn" onClick={()=>{setShowCongrats(false); downloadPNGCurrent();}}>{t("export_png")}</button>
                      <button className="btn" onClick={()=>setShowCongrats(false)}>{t("close")}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="label" style={{ fontWeight: 700, marginBottom: 6 }}>{t("palette_label")}</div>
              <div className="palette">
                {palette.map((rgb,i)=> {
                  const hidden = !!hiddenRef.current && !!hiddenRef.current[i];
                  if (hidden) return null;
                  return (
                    <button key={i} className={"chip"+(selected===i?" selected":"")} style={{background:rgbStr(rgb)}} onClick={()=>{setSelected(i);}} title={`Color #${i+1}`}>
                      <span className="num">{i+1}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      )}

      {!isFullscreen && showCongrats && (
        <div className="modal" onClick={()=>setShowCongrats(false)}>
          <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
            <h2 style={{marginTop:0}}>{t("completed_title")}</h2>
            <p>{t("completed_desc")}</p>
            <div className="row" style={{justifyContent:"center",marginTop:10}}>
              <button className="btn btn-success" onClick={()=>{setShowCongrats(false); saveCurrent("completed");}}>{t("save_to_gallery")}</button>
              <button className="btn" onClick={()=>{setShowCongrats(false); downloadPNGCurrent();}}>{t("export_png")}</button>
              <button className="btn" onClick={()=>setShowCongrats(false)}>{t("close")}</button>
            </div>
          </div>
        </div>
      )}

      {showNoImage && (
        <div className="modal" onClick={()=>setShowNoImage(false)}>
          <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
            <h2 style={{marginTop:0}}>Upload an image</h2>
            <p>Please upload a picture first before generating the board.</p>
            <div className="row" style={{justifyContent:"flex-end",marginTop:12}}>
              <button className="btn btn-primary" onClick={()=>setShowNoImage(false)}>{t("ok")}</button>
            </div>
          </div>
        </div>
      )}

      {showGuide && (
  <div className="modal" onClick={()=>setShowGuide(false)}>
    <div className="modal-card guideCard" onClick={(e)=>e.stopPropagation()}>
      <h2 className="guideTitle">{t("guide_title")}</h2>
      <p className="guideSub">Charlie Liu • {t("title")}</p>

      <div className="guideScroll">
        <div className="guideBody small" dangerouslySetInnerHTML={{__html: t("guide_body")}} />
      </div>

      <div className="guideFooter">
        <button className="btn exit-btn" onClick={()=>setShowGuide(false)}>{t("close")}</button>
      </div>
    </div>
  </div>
)}
<footer className="footer">
  <p>Made by Qiuchen (Charlie) Liu</p>
</footer>
    </div>
  );
}

// ===== Utilities & persistence (V2) =====
function genTitle(){
  const adjectives = ["Vivid","Retro","Dreamy","Neon","Cosmic","Pixel","Sunny","Velvet","Arcade","Prismatic","Zen","Turbo","Mint","Ivory","Crimson","Azure","Blossom","Nimbus","Quantum","Amber"];
  const nouns = ["Meadow","Orbit","Lagoon","Nova","Canvas","Bloom","Valley","Galaxy","Temple","Harbor","Forest","Mirage","Mosaic","Meteor","Chai","Nimbus","Drift","Aurora","Cascade","Vertex"];
  const a = adjectives[Math.floor(Math.random()*adjectives.length)];
  const n = nouns[Math.floor(Math.random()*nouns.length)];
  const tail = Math.random().toString(36).slice(2,6).toUpperCase();
  return `${a} ${n} #${tail}`;
}

function clamp(v:number,min:number,max:number){ return Math.max(min, Math.min(max, v)); }
function rgbStr(rgb:number[]){ return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`; }
function loadImage(src: string){
  return new Promise<HTMLImageElement>((resolve,reject)=>{ const img=new Image(); img.crossOrigin="anonymous"; img.onload=()=>resolve(img); img.onerror=reject; img.src=src; });
}
function kmeans(points:number[][], K:number, maxIters:number){
  let centers = kmeansPlusPlus(points,K); const labels = new Array(points.length).fill(0);
  for(let iter=0; iter<maxIters; iter++){
    for(let i=0;i<points.length;i++){ let best=0,bestD=Infinity; const p=points[i]; for(let c=0;c<centers.length;c++){ const d=dist2(p,centers[c]); if(d<bestD){bestD=d; best=c;} } labels[i]=best; }
    const sums = Array.from({length:K},()=>[0,0,0,0]);
    for(let i=0;i<points.length;i++){ const lab=labels[i], p=points[i]; sums[lab][0]+=p[0]; sums[lab][1]+=p[1]; sums[lab][2]+=p[2]; sums[lab][3]+=1; }
    for(let c=0;c<K;c++){ if(sums[c][3]>0) centers[c]=[sums[c][0]/sums[c][3],sums[c][1]/sums[c][3],sums[c][2]/sums[c][3]]; }
  }
  return { centers, labels };
}
function kmeansPlusPlus(points:number[][], K:number){
  const centers:number[][]=[]; centers.push(points[Math.floor(Math.random()*points.length)].slice());
  while(centers.length<K){
    const d=points.map(p=>{let m=Infinity; for(let c=0;c<centers.length;c++) m=Math.min(m,dist2(p,centers[c])); return m;});
    const sum=d.reduce((a,b)=>a+b,0); if(sum===0){ centers.push(points[Math.floor(Math.random()*points.length)].slice()); }
    else { let r=Math.random()*sum; let idx=0; while(r>0&&idx<d.length) r-=d[idx++]; centers.push(points[Math.max(0,Math.min(points.length-1,idx-1))].slice()); }
  }
  return centers;
}
function dist2(a:number[],b:number[]){ const dr=a[0]-b[0], dg=a[1]-b[1], db=a[2]-b[2]; return dr*dr+dg*dg+db*db; }

const V1_LIST = 'ppg:gallery';
const v2MigratedFlag = 'ppg:v2:migrated';

function genId(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function toB64(arr: Uint8Array){ let s=''; const chunk=0x8000; for(let i=0;i<arr.length;i+=chunk){ s += String.fromCharCode.apply(null, Array.from(arr.subarray(i,i+chunk)) as any); } return btoa(s); }
function fromB64(b64:string){ const s = atob(b64); const out = new Uint8Array(s.length); for(let i=0;i<s.length;i++) out[i]=s.charCodeAt(i); return out; }

function dedupeById(list: MetaV2[]){
  const seen = new Set<string>(); const out: MetaV2[] = [];
  for(const m of list){ if(!seen.has(m.id)){ seen.add(m.id); out.push(m); } }
  return out;
}

// V2 IO
function loadListV2(): MetaV2[]{ try{ const txt = localStorage.getItem(LIST_KEY); if(!txt) return []; const list = JSON.parse(txt) as MetaV2[]; return dedupeById(list); }catch{ return []; } }
function saveListV2(list: MetaV2[]){ localStorage.setItem(LIST_KEY, JSON.stringify(dedupeById(list))); }
function loadSnapV2(id:string): SnapV2 | null { try{ const txt = localStorage.getItem(snapKey(id)); if(!txt) return null; return JSON.parse(txt) as SnapV2; }catch{ return null; } }
function loadProgV2(id:string): ProgV2 | null { try{ const txt = localStorage.getItem(progKey(id)); if(!txt) return null; return JSON.parse(txt) as ProgV2; }catch{ return null; } }
function saveSnapV2(id:string, snap:SnapV2){ localStorage.setItem(snapKey(id), JSON.stringify(snap)); }
function saveProgV2(id:string, prog:ProgV2){ localStorage.setItem(progKey(id), JSON.stringify(prog)); }

function saveNewItemV2(meta: MetaV2, snap: SnapV2, prog: ProgV2){
  saveSnapV2(meta.id, snap);
  saveProgV2(meta.id, prog);
  const list = loadListV2();
  list.unshift(meta);
  saveListV2(list);
}

function deleteItemV2(id:string){
  localStorage.removeItem(snapKey(id));
  localStorage.removeItem(progKey(id));
  const list = loadListV2().filter(m=>m.id!==id);
  saveListV2(list);
}

// Migration (best-effort, non-destructive)
function migrateV1ToV2(){
  const migrated = localStorage.getItem(v2MigratedFlag);
  const v1ListTxt = localStorage.getItem(V1_LIST);
  if (migrated || !v1ListTxt) return;
  try {
    const v1List = JSON.parse(v1ListTxt);
    if (!Array.isArray(v1List)) return;
    const v2List = loadListV2();
    for (const m of v1List){
      const id = m.id;
      if (v2List.find(x=>x.id===id)) continue;
      const v1ItemTxt = localStorage.getItem(`ppg:item:${id}`);
      if (!v1ItemTxt) continue;
      const v1Item = JSON.parse(v1ItemTxt);
      const snap: SnapV2 = { cols: v1Item.cols, rows: v1Item.rows, palette: v1Item.palette, kIdx_b64: v1Item.kIdx };
      const prog: ProgV2 = { mask_b64: v1Item.mask, counts: v1Item.counts || [], hidden: v1Item.hidden || [] };
      const meta: MetaV2 = { id, title: v1Item.title || m.title || "", createdAt: m.createdAt || Date.now(), updatedAt: m.updatedAt || Date.now(), cols: v1Item.cols, rows: v1Item.rows, progress: m.progress || 0, thumb: m.thumb };
      saveNewItemV2(meta, snap, prog);
    }
  } finally {
    localStorage.setItem(v2MigratedFlag, "1");
  }
}

// Thumbnails & PNG
function renderThumbFromData(cols:number, rows:number, palette:number[][], kIdx:Uint8Array, mask:Uint8Array, targetW:number){
  const base = document.createElement('canvas'); base.width = cols; base.height = rows; const bctx = base.getContext('2d') as CanvasRenderingContext2D;
  const cellImg = bctx.createImageData(cols, rows);
  const data = cellImg.data;
  for (let i=0;i<cols*rows;i++){
    const filled = mask[i] === 1;
    const rgb = filled ? palette[kIdx[i]] : [255,255,255];
    const off = i*4; data[off] = rgb[0]; data[off+1] = rgb[1]; data[off+2] = rgb[2]; data[off+3] = 255;
  }
  bctx.putImageData(cellImg, 0, 0);
  const scale = targetW / cols;
  const w = Math.max(1, Math.round(cols*scale)), h = Math.max(1, Math.round(rows*scale));
  const cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h; const ctx = cvs.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(base, 0, 0, w, h);
  return cvs.toDataURL('image/png');
}
function renderPNGFromData(cols:number, rows:number, palette:number[][], kIdx:Uint8Array, mask:Uint8Array, cell:number, drawGrid:boolean){
  const w = cols*cell, h = rows*cell;
  const cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h; const ctx = cvs.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = false;
  for (let y=0;y<rows;y++){
    for (let x=0;x<cols;x++){
      const i = y*cols + x;
      const filled = mask[i] === 1;
      const rgb = filled ? palette[kIdx[i]] : [255,255,255];
      ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      ctx.fillRect(x*cell, y*cell, cell, cell);
      if (!filled){
        ctx.fillStyle = "#1f2937";
        ctx.font = "bold 12px ui-sans-serif, system-ui";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(kIdx[i]+1), x*cell + cell/2, y*cell + cell/2 + 0.5);
      }
    }
  }
  if (drawGrid){
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x=0;x<=cols;x++){ ctx.moveTo(x*cell+0.5, 0); ctx.lineTo(x*cell+0.5, rows*cell); }
    for (let y=0;y<=rows;y++){ ctx.moveTo(0, y*cell+0.5); ctx.lineTo(cols*cell, y*cell+0.5); }
    ctx.stroke();
  }
  return cvs.toDataURL('image/png');
}
function triggerDownload(filename:string, dataUrl:string){
  const a = document.createElement('a'); a.href = dataUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}