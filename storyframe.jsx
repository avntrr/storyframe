import { useState, useRef, useCallback, useEffect } from "react";
import { Download, ChevronDown, ChevronUp, RotateCcw, Trash2 } from "lucide-react";

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const FRAMES = [
  { id: "polaroid",  label: "Polaroid",   icon: (active) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active?"#a78bfa":"#666"} strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="1"/><rect x="5" y="5" width="14" height="11" rx="0.5"/><line x1="9" y1="19" x2="15" y2="19"/></svg> },
  { id: "rounded",   label: "Rounded",    icon: (active) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active?"#a78bfa":"#666"} strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/></svg> },
  { id: "filmstrip", label: "Film Strip", icon: (active) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active?"#a78bfa":"#666"} strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="1"/><rect x="5" y="7" width="14" height="10"/><circle cx="2.5" cy="7" r="0.8" fill={active?"#a78bfa":"#666"}/><circle cx="2.5" cy="12" r="0.8" fill={active?"#a78bfa":"#666"}/><circle cx="2.5" cy="17" r="0.8" fill={active?"#a78bfa":"#666"}/><circle cx="21.5" cy="7" r="0.8" fill={active?"#a78bfa":"#666"}/><circle cx="21.5" cy="12" r="0.8" fill={active?"#a78bfa":"#666"}/><circle cx="21.5" cy="17" r="0.8" fill={active?"#a78bfa":"#666"}/></svg> },
  { id: "none",      label: "No Frame",   icon: (active) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active?"#a78bfa":"#666"} strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="1" strokeDasharray="3 2"/></svg> },
];

const SLIDER_CSS = `
  input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;background:rgba(255,255,255,0.1);outline:none;cursor:pointer;}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:50%;background:#8b5cf6;cursor:grab;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);}
  input[type=range]::-webkit-slider-thumb:active{cursor:grabbing;background:#a78bfa;transform:scale(1.2);}
  input[type=range]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#8b5cf6;cursor:grab;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);}
  input[type=range]::-moz-range-thumb:active{cursor:grabbing;background:#a78bfa;}
  input[type=range]::-moz-range-track{height:6px;border-radius:3px;background:rgba(255,255,255,0.1);}
`;

function fileToDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
function loadImage(src) {
  return new Promise((res, rej) => { const img = new window.Image(); img.crossOrigin = "anonymous"; img.onload = () => res(img); img.onerror = rej; img.src = src; });
}
function readExifBasic(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const v = new DataView(e.target.result);
        if (v.getUint16(0) !== 0xffd8) return resolve(null);
        let off = 2;
        while (off < v.byteLength - 2) {
          if (v.getUint16(off) === 0xffe1) return resolve(parseExif(v, off + 4));
          off += 2 + v.getUint16(off + 2);
        }
        resolve(null);
      } catch { resolve(null); }
    };
    r.readAsArrayBuffer(file.slice(0, 128 * 1024));
  });
}
function parseExif(v, start) {
  const magic = [0x45,0x78,0x69,0x66];
  for (let i=0;i<4;i++) if (v.getUint8(start+i)!==magic[i]) return null;
  const ts=start+6, le=v.getUint16(ts)===0x4949;
  const g16=(o)=>v.getUint16(o,le), g32=(o)=>v.getUint32(o,le);
  const res={};
  const str=(o,l)=>{let s="";for(let i=0;i<l-1;i++){const c=v.getUint8(o+i);if(!c)break;s+=String.fromCharCode(c);}return s.trim();};
  try {
    const base=ts+g32(ts+4), cnt=g16(base);
    for(let i=0;i<cnt;i++){
      const e=base+2+i*12, tag=g16(e);
      if(tag===0x010f) res.make=str(ts+g32(e+8),g32(e+4));
      if(tag===0x0110) res.model=str(ts+g32(e+8),g32(e+4));
      if(tag===0x8769){
        const eo=g32(e+8),ec=g16(ts+eo);
        for(let j=0;j<ec;j++){
          const ee=ts+eo+2+j*12,et=g16(ee),ety=g16(ee+2);
          if(et===0x829d&&ety===5){const vo=ts+g32(ee+8);res.fNumber=g32(vo)/g32(vo+4);}
          if(et===0x8827) res.iso=g16(ee+8)||g32(ee+8);
          if(et===0x920a&&ety===5){const vo=ts+g32(ee+8);res.focalLength=g32(vo)/g32(vo+4);}
        }
      }
    }
  } catch {}
  return Object.keys(res).length ? res : null;
}
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}

// ── Stable sub-components (outside main) ──
const Label = ({ children, right }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "#777", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <span>{children}</span>
    {right && <span style={{ color: "#555", fontWeight: 600, fontSize: 12 }}>{right}</span>}
  </div>
);

const Slider = ({ label, value, min, max, onChange }) => (
  <div>
    <Label right={`${value}%`}>{label}</Label>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </div>
);

// ── Main ──
export default function StoryFrame() {
  const [bgDataUrl,  setBgDataUrl]  = useState(null);
  const [mainDataUrl,setMainDataUrl]= useState(null);
  const [mainNat,    setMainNat]    = useState({ w:1, h:1 });
  const [blur,       setBlur]       = useState(50);
  const [bgBnw,      setBgBnw]      = useState(false);
  const [frame,      setFrame]      = useState("polaroid");
  const [scale,      setScale]      = useState(60);
  const [shadow,     setShadow]     = useState(30);
  const [exif,       setExif]       = useState({ model:"", focalLength:"", fNumber:"", iso:"" });
  const [exporting,  setExporting]  = useState(false);
  const [resultUrl,  setResultUrl]  = useState(null);
  const [mobileTab,  setMobileTab]  = useState(null); // null | 'bg' | 'photo' | 'frame' | 'meta'
  const [photoPos,   setPhotoPos]   = useState({ x:0, y:0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showMeta,   setShowMeta]   = useState(true);
  const stateRef = useRef({});

  const bgRef        = useRef(null);
  const mainRef      = useRef(null);
  const photoPosRef  = useRef({ x:0, y:0 });
  const dragging     = useRef(false);
  const dragStart    = useRef({ mx:0, my:0, px:0, py:0 });
  const pinchRef     = useRef({ startDist:0, startScale:60 });

  const getPinchDist = (t) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  };

  const onBg = useCallback(async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBgDataUrl(await fileToDataURL(f));
  }, []);

  const onMain = useCallback(async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const url = await fileToDataURL(f);
    setMainDataUrl(url);
    // reset position on new photo
    photoPosRef.current = { x:0, y:0 };
    setPhotoPos({ x:0, y:0 });
    const img = await loadImage(url);
    setMainNat({ w: img.naturalWidth||img.width, h: img.naturalHeight||img.height });
    const d = await readExifBasic(f);
    if (d) setExif({ model: d.model||d.make||"", focalLength: d.focalLength?Math.round(d.focalLength).toString():"", fNumber: d.fNumber?d.fNumber.toFixed(1):"", iso: d.iso?d.iso.toString():"" });
  }, []);

  // ── Drag + Pinch handlers ──
  const handleDragStart = useCallback((e) => {
    if (e.touches && e.touches.length === 2) return; // let touchstart handle pinch
    e.preventDefault();
    dragging.current = true;
    setIsDragging(true);
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    dragStart.current = { mx: cx, my: cy, px: photoPosRef.current.x, py: photoPosRef.current.y };
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      dragging.current = false;
      setIsDragging(false);
      pinchRef.current = { startDist: getPinchDist(e.touches), startScale: scale };
    } else {
      handleDragStart(e);
    }
  }, [scale, handleDragStart]);

  const handleDragMove = useCallback((e) => {
    if (!dragging.current) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    let nx = dragStart.current.px + (cx - dragStart.current.mx);
    let ny = dragStart.current.py + (cy - dragStart.current.my);
    const SNAP = 8;
    if (Math.abs(nx) < SNAP) nx = 0;
    if (Math.abs(ny) < SNAP) ny = 0;
    photoPosRef.current = { x: nx, y: ny };
    setPhotoPos({ x: nx, y: ny });
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      const ratio = getPinchDist(e.touches) / pinchRef.current.startDist;
      const newScale = Math.min(95, Math.max(20, pinchRef.current.startScale * ratio));
      setScale(Math.round(newScale));
    } else {
      handleDragMove(e);
    }
  }, [handleDragMove]);

  const handleDragEnd = useCallback(() => {
    dragging.current = false;
    setIsDragging(false);
  }, []);

  // Sync all export-relevant state into a ref so doExport never has stale values
  useEffect(() => {
    stateRef.current = { bgDataUrl, mainDataUrl, blur, bgBnw, frame, scale, exif, shadow, showMeta };
  }, [bgDataUrl, mainDataUrl, blur, bgBnw, frame, scale, exif, shadow, showMeta]);

  const doExport = useCallback(async () => {
    const s = stateRef.current;
    setExporting(true);
    try {
      const c = document.createElement("canvas"); c.width=CANVAS_W; c.height=CANVAS_H;
      const ctx = c.getContext("2d");
      if (s.bgDataUrl) {
        const bi = await loadImage(s.bgDataUrl);
        // Downsample for filter processing — blur hides pixelation and halving size
        // greatly reduces memory pressure on mobile (especially iOS)
        const SF = 2;
        const bw = CANVAS_W / SF, bh = CANVAS_H / SF;
        const tmp = document.createElement("canvas"); tmp.width=bw; tmp.height=bh;
        const tc = tmp.getContext("2d");
        const sc = Math.max(bw/bi.width, bh/bi.height);
        tc.drawImage(bi,(bw-bi.width*sc)/2,(bh-bi.height*sc)/2,bi.width*sc,bi.height*sc);
        const blurPx = (s.blur * 0.4) / SF;
        if (blurPx > 0 || s.bgBnw) {
          // SVG filters work on all iOS versions, unlike ctx.filter (requires iOS 18+)
          const base64 = tmp.toDataURL("image/jpeg", 0.85);
          const filterSteps = [
            blurPx > 0 ? `<feGaussianBlur stdDeviation="${blurPx.toFixed(2)}"/>` : "",
            s.bgBnw ? `<feColorMatrix type="saturate" values="0"/>` : ""
          ].filter(Boolean).join("");
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh}"><defs><filter id="f" x="-10%" y="-10%" width="120%" height="120%">${filterSteps}</filter></defs><image href="${base64}" width="${bw}" height="${bh}" filter="url(#f)"/></svg>`;
          const filtered = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
          ctx.drawImage(filtered, -20, -20, CANVAS_W+40, CANVAS_H+40);
        } else {
          ctx.drawImage(tmp, -20, -20, CANVAS_W+40, CANVAS_H+40);
        }
      } else { ctx.fillStyle="#1a1a2e"; ctx.fillRect(0,0,CANVAS_W,CANVAS_H); }

      if (s.mainDataUrl) {
        const mi = await loadImage(s.mainDataUrl);
        const asp = mi.width/mi.height;
        let pw=CANVAS_W*(s.scale/100), ph=pw/asp;
        if (ph>CANVAS_H*0.6){ph=CANVAS_H*0.6;pw=ph*asp;}
        const pad = s.frame==="polaroid"?{t:24,s:24,b:90}:s.frame==="rounded"?{t:16,s:16,b:16}:s.frame==="filmstrip"?{t:60,s:24,b:60}:{t:0,s:0,b:0};
        const tw=pw+pad.s*2, th=ph+pad.t+pad.b;
        const scaleX=CANVAS_W/320, scaleY=CANVAS_H/568;
        const fx=(CANVAS_W-tw)/2 + photoPosRef.current.x*scaleX;
        const fy=(CANVAS_H-th)/2-40 + photoPosRef.current.y*scaleY;
        ctx.save(); ctx.shadowColor=`rgba(0,0,0,${s.shadow/100})`; ctx.shadowBlur=64; ctx.shadowOffsetY=16;
        if(s.frame==="rounded"){rrect(ctx,fx,fy,tw,th,24);ctx.fillStyle="#fff";ctx.fill();}
        else if(s.frame!=="none"){ctx.fillStyle="#fff";ctx.fillRect(fx,fy,tw,th);}
        ctx.restore();
        if(s.frame==="filmstrip"){ctx.fillStyle="#1a1a1a";for(let x=fx+20;x<fx+tw-20;x+=40){rrect(ctx,x,fy+12,18,13,4);ctx.fill();rrect(ctx,x,fy+th-25,18,13,4);ctx.fill();}}
        const px=fx+pad.s, py=fy+pad.t;
        ctx.save(); if(s.frame==="rounded"){rrect(ctx,px,py,pw,ph,16);ctx.clip();}
        ctx.drawImage(mi,px,py,pw,ph); ctx.restore();
        if(s.frame==="polaroid" && s.showMeta){
          const hasModel=!!s.exif.model;
          const specParts=[s.exif.focalLength&&`${s.exif.focalLength}mm`,s.exif.fNumber&&`f/${s.exif.fNumber}`,s.exif.iso&&`ISO${s.exif.iso}`].filter(Boolean);
          let metaY=py+ph+32;
          if(hasModel){
            const label="Shot on ";
            ctx.font='18px "Space Mono",monospace'; const lw=ctx.measureText(label).width;
            ctx.font='bold 18px "Space Mono",monospace';
            const sx=(CANVAS_W-(lw+ctx.measureText(s.exif.model).width))/2;
            ctx.font='18px "Space Mono",monospace'; ctx.fillStyle="#888"; ctx.textAlign="left"; ctx.fillText(label,sx,metaY);
            ctx.font='bold 18px "Space Mono",monospace'; ctx.fillStyle="#555"; ctx.fillText(s.exif.model,sx+lw,metaY);
            metaY+=26;
          }
          if(specParts.length){ctx.font='16px "Space Mono",monospace';ctx.fillStyle="#999";ctx.textAlign="center";ctx.fillText(specParts.join("  "),CANVAS_W/2,metaY);}
        }
      }
      ctx.font="16px Arial"; ctx.fillStyle="rgba(255,255,255,0.3)"; ctx.textAlign="right"; ctx.fillText("StoryFrame",CANVAS_W-30,CANVAS_H-24);
      const dataUrl = c.toDataURL("image/png");
      setResultUrl(dataUrl);
    } finally { setExporting(false); }
  }, []);

  // Save handler: Web Share API on mobile (→ Photos), fallback download on desktop
  const handleSave = useCallback(async (dataUrl) => {
    const filename = `storyframe-${Date.now()}.png`;
    if (navigator.share) {
      try {
        const blob = await fetch(dataUrl).then(r => r.blob());
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "StoryFrame" });
          return;
        }
      } catch (e) { /* user cancelled or unsupported — fall through */ }
    }
    // Desktop fallback: trigger download
    const a = document.createElement("a");
    a.href = dataUrl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, []);

  const reset = () => {
    setBgDataUrl(null);setMainDataUrl(null);setMainNat({w:1,h:1});setBlur(50);setBgBnw(false);
    setFrame("polaroid");setScale(60);setShadow(30);setExif({model:"",focalLength:"",fNumber:"",iso:""});
    photoPosRef.current={x:0,y:0}; setPhotoPos({x:0,y:0});
    if(bgRef.current) bgRef.current.value="";
    if(mainRef.current) mainRef.current.value="";
  };

  const metaLine2 = [exif.focalLength&&`${exif.focalLength}mm`,exif.fNumber&&`f/${exif.fNumber}`,exif.iso&&`ISO${exif.iso}`].filter(Boolean).join("  ");
  const hasMeta = !!(exif.model||metaLine2);

  // With absolute positioning, width (not maxWidth) must be set explicitly
  const fso = (() => {
    const b = { width:`${scale}%`, boxShadow:`0 12px 48px rgba(0,0,0,${shadow/100})` };
    // colorScheme:"light" prevents Android/Samsung dark mode from inverting the white frame background
    if(frame==="polaroid")  return {...b, background:"#fff", colorScheme:"light", padding:"3% 3% 4% 3%",  borderRadius:3};
    if(frame==="rounded")   return {...b, background:"#fff", colorScheme:"light", padding:"2%",            borderRadius:16};
    if(frame==="filmstrip") return {...b, background:"#fff", colorScheme:"light", padding:"7% 3% 7% 3%",  borderRadius:0};
    return {...b, background:"transparent", padding:0};
  })();

  const inp = { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"7px 10px", fontSize:12, color:"#d3d3d3", outline:"none", boxSizing:"border-box" };
  const canDownload = !exporting && (!!bgDataUrl || !!mainDataUrl);

  // ── Inlined controls JSX ──
  const controlsJSX = (
    <div style={{ display:"flex", flexDirection:"column", gap:20, padding:"4px 2px" }}>

      {/* Step 1 — Background */}
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
          <div style={{ width:20, height:20, borderRadius:"50%", background: bgDataUrl?"#22c55e":"#8b5cf6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#d3d3d3", flexShrink:0 }}>{bgDataUrl?"✓":"1"}</div>
          <span style={{ fontSize:12, fontWeight:700, color: bgDataUrl?"#86efac":"#ccc" }}>Background Photo</span>
          {bgDataUrl && (
            <button onClick={()=>{ setBgDataUrl(null); if(bgRef.current) bgRef.current.value=''; }} title="Remove background" style={{ marginLeft:"auto", display:"flex", alignItems:"center", justifyContent:"center", width:26, height:26, borderRadius:6, background:"transparent", border:"none", cursor:"pointer", color:"#d3d3d3", flexShrink:0, opacity:0.6, transition:"opacity 0.15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.opacity="1"; }}
              onMouseLeave={e=>{ e.currentTarget.style.opacity="0.6"; }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, background:"rgba(255,255,255,0.04)", border: bgDataUrl?"1px solid rgba(34,197,94,0.3)":"1px dashed rgba(255,255,255,0.15)", borderRadius:12, padding:"12px 0", fontSize:13, color: bgDataUrl?"#86efac":"#999", cursor:"pointer", transition:"all 0.15s" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          {bgDataUrl ? "Background loaded — click to replace" : "Click to upload background"}
          <input ref={bgRef} type="file" accept="image/*" style={{display:"none"}} onChange={onBg} />
        </label>
      </div>

      {/* Step 2 — Main Photo */}
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
          <div style={{ width:20, height:20, borderRadius:"50%", background: mainDataUrl?"#22c55e":"#8b5cf6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#d3d3d3", flexShrink:0 }}>{mainDataUrl?"✓":"2"}</div>
          <span style={{ fontSize:12, fontWeight:700, color: mainDataUrl?"#86efac":"#ccc" }}>Main Photo {mainDataUrl?`(${mainNat.w}×${mainNat.h})`:""}</span>
          {mainDataUrl && (
            <button onClick={()=>{ setMainDataUrl(null); setPhotoPos({x:0,y:0}); if(mainRef.current) mainRef.current.value=''; }} title="Remove photo" style={{ marginLeft:"auto", display:"flex", alignItems:"center", justifyContent:"center", width:26, height:26, borderRadius:6, background:"transparent", border:"none", cursor:"pointer", color:"#d3d3d3", flexShrink:0, opacity:0.6, transition:"opacity 0.15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.opacity="1"; }}
              onMouseLeave={e=>{ e.currentTarget.style.opacity="0.6"; }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, background:"rgba(255,255,255,0.04)", border: mainDataUrl?"1px solid rgba(34,197,94,0.3)":"1px dashed rgba(255,255,255,0.15)", borderRadius:12, padding:"12px 0", fontSize:13, color: mainDataUrl?"#86efac":"#999", cursor:"pointer", transition:"all 0.15s" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          {mainDataUrl ? "Photo loaded — click to replace" : "Click to upload main photo"}
          <input ref={mainRef} type="file" accept="image/*" style={{display:"none"}} onChange={onMain} />
        </label>
      </div>

      {/* Privacy badge */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", background:"rgba(34,197,94,0.07)", borderRadius:8, border:"1px solid rgba(34,197,94,0.12)" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span style={{ fontSize:10, color:"#4ade80", opacity:0.8 }}>Photos never leave your device — 100% client-side</span>
      </div>

      <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)" }} />

      {/* Background controls — blur + B&W in one card */}
      <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:12, padding:"12px 14px", border:"1px solid rgba(255,255,255,0.07)" }}>
        <Label>Background</Label>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:"#555", marginBottom:5 }}>Blur — {blur}%</div>
            <input type="range" min={0} max={100} value={blur} onChange={(e)=>setBlur(Number(e.target.value))} />
          </div>
          <button onClick={()=>setBgBnw(v=>!v)} style={{ flexShrink:0, display:"flex", alignItems:"center", gap:5, padding:"7px 11px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", border: bgBnw?"1px solid #a78bfa":"1px solid rgba(255,255,255,0.1)", background: bgBnw?"rgba(139,92,246,0.2)":"rgba(255,255,255,0.04)", color: bgBnw?"#c4b5fd":"#666", transition:"all 0.15s" }}>
            <span style={{ width:10, height:10, borderRadius:"50%", background:"linear-gradient(135deg,#fff 50%,#000 50%)", display:"inline-block", flexShrink:0, border:"1px solid rgba(255,255,255,0.2)" }}/>
            B&amp;W
          </button>
        </div>
      </div>

      {/* Frame Style */}
      <div>
        <Label>Frame Style</Label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6 }}>
          {FRAMES.map((f) => {
            const active = frame===f.id;
            return (
              <button key={f.id} onClick={()=>setFrame(f.id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"10px 4px", borderRadius:10, fontSize:10, fontWeight:600, cursor:"pointer", border: active?"1px solid #8b5cf6":"1px solid rgba(255,255,255,0.08)", background: active?"rgba(139,92,246,0.2)":"rgba(255,255,255,0.04)", color: active?"#c4b5fd":"#666", transition:"all 0.15s" }}>
                {f.icon(active)}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <Slider label="Shadow" value={shadow} min={0} max={100} onChange={setShadow} />

      {/* Camera Metadata (Polaroid only) */}
      {frame==="polaroid" && (
        <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:12, padding:"12px 14px", border:"1px solid rgba(255,255,255,0.07)" }}>
          <Label>Camera Metadata</Label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            <input type="text" value={exif.model}       onChange={(e)=>setExif(p=>({...p,model:e.target.value}))}       placeholder="Device model"  style={inp} />
            <input type="text" value={exif.focalLength} onChange={(e)=>setExif(p=>({...p,focalLength:e.target.value}))} placeholder="Focal (mm)"    style={inp} />
            <input type="text" value={exif.fNumber}     onChange={(e)=>setExif(p=>({...p,fNumber:e.target.value}))}     placeholder="Aperture (f/)" style={inp} />
            <input type="text" value={exif.iso}         onChange={(e)=>setExif(p=>({...p,iso:e.target.value}))}         placeholder="ISO"           style={inp} />
          </div>
          {hasMeta && (
            <div style={{ marginTop:10, padding:"7px 10px", background:"rgba(0,0,0,0.2)", borderRadius:7 }}>
              <div style={{ fontSize:9, color:"#555", marginBottom:3, textTransform:"uppercase", letterSpacing:1 }}>Preview</div>
              {exif.model && <div style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#888" }}>Shot on <span style={{fontWeight:700,color:"#aaa"}}>{exif.model}</span></div>}
              {metaLine2  && <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9.5, color:"#666", marginTop:2 }}>{metaLine2}</div>}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display:"flex", gap:8, paddingTop:4 }}>
        <button onClick={reset} style={{ display:"flex", alignItems:"center", gap:6, padding:"11px 16px", borderRadius:12, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#666", fontSize:13, cursor:"pointer" }}>
          <RotateCcw size={14} /> Reset
        </button>
        <button onClick={doExport} disabled={!canDownload} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"11px 0", borderRadius:12, border:"none", fontWeight:700, fontSize:14, cursor: canDownload?"pointer":"not-allowed", background: canDownload?"linear-gradient(135deg,#7c3aed,#c026d3)":"rgba(255,255,255,0.06)", color: canDownload?"#d3d3d3":"#444", transition:"all 0.15s" }}>
          {exporting
            ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></path></svg> Exporting…</>
            : <><Download size={15} /> Export Story</>
          }
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#080810", color:"#d3d3d3", fontFamily:"'Inter',system-ui,sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{SLIDER_CSS}</style>

      {/* Header */}
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 20px", borderBottom:"1px solid rgba(255,255,255,0.05)", background:"rgba(255,255,255,0.02)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#7c3aed,#c026d3)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13 }}>S</div>
          <span style={{ fontSize:17, fontWeight:700, letterSpacing:-0.5 }}>StoryFrame</span>
          <span style={{ fontSize:10, background:"rgba(255,255,255,0.07)", padding:"2px 7px", borderRadius:20, color:"#666" }}>v1.0</span>
        </div>
        <span style={{ fontSize:11, color:"#444" }}>IG Story Photo Customizer</span>
      </header>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* Preview panel */}
        <div className="sf-preview-area" style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:24, minWidth:0 }}>
          <div
            onClick={() => { if (!bgDataUrl) bgRef.current?.click(); }}
            style={{ width:320, height:568, borderRadius:16, overflow:"hidden", position:"relative", background:"#0d0d18", boxShadow:"0 24px 80px rgba(0,0,0,0.6)", flexShrink:0, cursor: bgDataUrl?"default":"pointer", transform: mobileTab ? "translateY(-10%)" : "translateY(0)", transition:"transform 0.3s ease" }}
          >
            {/* BG Layer */}
            <div style={{ position:"absolute", inset:-10, overflow:"hidden" }}>
              {bgDataUrl ? (
                <img src={bgDataUrl} alt="" style={{ width:"calc(100% + 20px)", height:"calc(100% + 20px)", objectFit:"cover", filter:`blur(${blur*0.15}px)${bgBnw?" grayscale(1)":""}` }} />
              ) : (
                <div style={{ width:"100%", height:"100%", background:"linear-gradient(135deg,#0f0f20,#16213e,#0f3460)" }} />
              )}
            </div>

            {/* Empty state — polaroid placeholder + upload prompts */}
            {!mainDataUrl && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, pointerEvents:"none" }}>
                {/* Ghost polaroid frame */}
                <div
                  style={{ width:156, background:"rgba(255,255,255,0.05)", border:"1.5px dashed rgba(255,255,255,0.18)", borderRadius:3, padding:"12px 12px 0 12px", cursor:"pointer", pointerEvents:"all" }}
                  onClick={() => mainRef.current?.click()}
                >
                  <div style={{ width:"100%", aspectRatio:"1", border:"1px dashed rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.03)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, borderRadius:2 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                  {/* Text inside polaroid bottom strip */}
                  <div style={{ textAlign:"center", padding:"8px 0 10px", fontSize:10, color:"rgba(255,255,255,0.35)", fontWeight:600, letterSpacing:0.3 }}>
                    Tap to upload photo
                  </div>
                </div>
                {/* "upload background" below polaroid */}
                {!bgDataUrl && (
                  <div style={{ fontSize:10, color:"#d3d3d3", opacity:0.55, textAlign:"center" }}>Tap to upload background</div>
                )}
              </div>
            )}

            {/* Snap guide lines — behind photo */}
            {isDragging && Math.abs(photoPos.x) < 14 && (
              <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:0, borderLeft:"1px dashed rgba(255,255,255,0.55)", transform:"translateX(-50%)", pointerEvents:"none" }} />
            )}
            {isDragging && Math.abs(photoPos.y) < 14 && (
              <div style={{ position:"absolute", top:"50%", left:0, right:0, height:0, borderTop:"1px dashed rgba(255,255,255,0.55)", transform:"translateY(-50%)", pointerEvents:"none" }} />
            )}

            {/* Main Photo — draggable */}
            {mainDataUrl && (
              <div
                style={{ position:"absolute", inset:0, overflow:"hidden" }}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleDragEnd}
              >
                {/* drag hint */}
                {!isDragging && photoPos.x===0 && photoPos.y===0 && (
                  <div style={{ position:"absolute", bottom:28, left:0, right:0, display:"flex", justifyContent:"center", zIndex:10, pointerEvents:"none" }}>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", background:"rgba(0,0,0,0.35)", padding:"3px 8px", borderRadius:20, backdropFilter:"blur(4px)" }}>
                      Drag to reposition
                    </div>
                  </div>
                )}
                <div
                  style={{
                    ...fso,
                    position:"absolute",
                    left:"50%",
                    top:"50%",
                    transform:`translate(calc(-50% + ${photoPos.x}px), calc(-50% + ${photoPos.y}px))`,
                    cursor: isDragging ? "grabbing" : "grab",
                    userSelect:"none",
                    touchAction:"none",
                  }}
                  onMouseDown={handleDragStart}
                  onTouchStart={handleTouchStart}
                >
                  {frame==="filmstrip" && (<>
                    <div style={{position:"absolute",top:"2%",left:"5%",right:"5%",display:"flex",justifyContent:"space-between"}}>
                      {Array.from({length:7}).map((_,i)=><div key={i} style={{width:8,height:5,background:"#222",borderRadius:2}}/>)}
                    </div>
                    <div style={{position:"absolute",bottom:"2%",left:"5%",right:"5%",display:"flex",justifyContent:"space-between"}}>
                      {Array.from({length:7}).map((_,i)=><div key={i} style={{width:8,height:5,background:"#222",borderRadius:2}}/>)}
                    </div>
                  </>)}
                  <img src={mainDataUrl} alt="Main" style={{ display:"block", width:"100%", height:"auto", borderRadius: frame==="rounded"?10:0 }}
                    onLoad={(e)=>setMainNat({w:e.target.naturalWidth,h:e.target.naturalHeight})} />
                  {frame==="polaroid" && hasMeta && showMeta && (
                    <div style={{textAlign:"center",marginTop:4}}>
                      {exif.model&&<div style={{fontFamily:"'Space Mono',monospace",fontSize:6,color:"#999",letterSpacing:0.2}}>Shot on <span style={{fontWeight:700,color:"#555"}}>{exif.model}</span></div>}
                      {metaLine2  &&<div style={{fontFamily:"'Space Mono',monospace",fontSize:5.5,color:"#aaa",marginTop:1}}>{metaLine2}</div>}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div style={{ position:"absolute", bottom:6, right:10, fontSize:7.5, color:"rgba(255,255,255,0.2)", fontWeight:600, letterSpacing:0.5 }}>STORYFRAME</div>
          </div>
        </div>

        {/* Desktop sidebar with fade */}
        <div className="sf-sidebar" style={{ width:340, borderLeft:"1px solid rgba(255,255,255,0.05)", overflowY:"auto", padding:20, background:"#080810", flexShrink:0, position:"relative" }}>
          {controlsJSX}
          <div style={{ position:"sticky", bottom:0, height:40, background:"linear-gradient(to top, #080810, transparent)", pointerEvents:"none", marginTop:-40 }} />
        </div>
      </div>

      {/* ── Mobile 2-layer taskbar ── */}
      <div className="sf-mobile" style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:100, background:"transparent", borderTop:"1px solid rgba(255,255,255,0.1)" }}>

        {/* Layer 1: Submenu panel */}
        {mobileTab && (
          <div style={{ padding:"12px 16px 8px", borderBottom:"1px solid rgba(255,255,255,0.05)", overflowY:"auto", maxHeight:200, background:"rgba(12,12,24,0.15)" }}>

            {mobileTab==="bg" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {bgDataUrl && (
                  <div style={{ display:"flex", justifyContent:"flex-end" }}>
                    <button onClick={()=>{ setBgDataUrl(null); if(bgRef.current) bgRef.current.value=''; }} title="Remove background" style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, borderRadius:8, background:"transparent", border:"none", cursor:"pointer", color:"#d3d3d3", opacity:0.6 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
                <div>
                  <div style={{ fontSize:11, color:"#d3d3d3", marginBottom:5 }}>Blur — {blur}%</div>
                  <input type="range" min={0} max={100} value={blur} onChange={(e)=>setBlur(Number(e.target.value))} />
                </div>
                <button onClick={()=>setBgBnw(v=>!v)} style={{ alignSelf:"flex-start", display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", border: bgBnw?"1px solid #a78bfa":"1px solid rgba(255,255,255,0.1)", background: bgBnw?"rgba(139,92,246,0.2)":"rgba(255,255,255,0.04)", color: bgBnw?"#c4b5fd":"#d3d3d3" }}>
                  <span style={{ width:10, height:10, borderRadius:"50%", background:"linear-gradient(135deg,#fff 50%,#000 50%)", display:"inline-block", border:"1px solid rgba(255,255,255,0.2)" }}/>
                  B&amp;W {bgBnw?"ON":"OFF"}
                </button>
              </div>
            )}

            {mobileTab==="photo" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {mainDataUrl && (
                  <div style={{ display:"flex", justifyContent:"flex-end" }}>
                    <button onClick={()=>{ setMainDataUrl(null); setPhotoPos({x:0,y:0}); if(mainRef.current) mainRef.current.value=''; }} title="Remove photo" style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, borderRadius:8, background:"transparent", border:"none", cursor:"pointer", color:"#d3d3d3", opacity:0.6 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
                <div>
                  <div style={{ fontSize:11, color:"#d3d3d3", marginBottom:5 }}>Shadow — {shadow}%</div>
                  <input type="range" min={0} max={100} value={shadow} onChange={(e)=>setShadow(Number(e.target.value))} />
                </div>
              </div>
            )}

            {mobileTab==="frame" && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                {FRAMES.map((f) => {
                  const active = frame===f.id;
                  return (
                    <button key={f.id} onClick={()=>setFrame(f.id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"10px 4px", borderRadius:10, fontSize:11, fontWeight:600, cursor:"pointer", border: active?"1px solid #8b5cf6":"1px solid rgba(255,255,255,0.08)", background: active?"rgba(139,92,246,0.2)":"rgba(255,255,255,0.04)", color: active?"#c4b5fd":"#d3d3d3" }}>
                      {f.icon(active)}{f.label}
                    </button>
                  );
                })}
              </div>
            )}

            {mobileTab==="meta" && (
              frame==="polaroid" ? (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {/* Show metadata toggle */}
                  <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", userSelect:"none" }}>
                    <div onClick={()=>setShowMeta(v=>!v)} style={{ width:36, height:20, borderRadius:10, background: showMeta?"#7c3aed":"rgba(255,255,255,0.1)", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                      <div style={{ position:"absolute", top:2, left: showMeta?18:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
                    </div>
                    <span style={{ fontSize:12, color:"#d3d3d3" }}>Show metadata</span>
                  </label>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, opacity: showMeta?1:0.35, pointerEvents: showMeta?"all":"none", transition:"opacity 0.2s" }}>
                    <input type="text" value={exif.model}       onChange={(e)=>setExif(p=>({...p,model:e.target.value}))}       placeholder="Device model"  style={inp} />
                    <input type="text" value={exif.focalLength} onChange={(e)=>setExif(p=>({...p,focalLength:e.target.value}))} placeholder="Focal (mm)"    style={inp} />
                    <input type="text" value={exif.fNumber}     onChange={(e)=>setExif(p=>({...p,fNumber:e.target.value}))}     placeholder="Aperture (f/)" style={inp} />
                    <input type="text" value={exif.iso}         onChange={(e)=>setExif(p=>({...p,iso:e.target.value}))}         placeholder="ISO"           style={inp} />
                  </div>
                  {hasMeta && (
                    <div style={{ padding:"6px 10px", background:"rgba(0,0,0,0.2)", borderRadius:7 }}>
                      {exif.model && <div style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:"#d3d3d3" }}>Shot on <span style={{fontWeight:700,color:"#d3d3d3"}}>{exif.model}</span></div>}
                      {metaLine2  && <div style={{ fontFamily:"'Space Mono',monospace", fontSize:10.5, color:"#d3d3d3", marginTop:2 }}>{metaLine2}</div>}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize:12, color:"#d3d3d3", padding:"8px 0" }}>Metadata is only available with the Polaroid frame.</div>
              )
            )}

          </div>
        )}

        {/* Layer 2: Main nav bar */}
        <div style={{ display:"flex", alignItems:"center", height:58, padding:"0 8px", gap:2 }}>
          {[
            { id:"bg",    label:"Background", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>, badge: bgDataUrl },
            { id:"photo", label:"Photo",       icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>, badge: mainDataUrl },
            { id:"frame", label:"Frame",       icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="1"/><rect x="7" y="7" width="10" height="10"/></svg>, badge: false },
            { id:"meta",  label:"Metadata",    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5"/></svg>, badge: false },
          ].map(({ id, label, icon, badge }) => {
            const active = mobileTab === id;
            return (
              <button key={id} onClick={() => setMobileTab(t => t===id ? null : id)}
                style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, height:"100%", background:"transparent", border:"none", cursor:"pointer", color: active?"#a78bfa":"#d3d3d3", position:"relative", borderRadius:8 }}>
                {badge && <div style={{ position:"absolute", top:8, right:"22%", width:6, height:6, borderRadius:"50%", background:"#22c55e", border:"1.5px solid #0c0c18" }}/>}
                <div style={{ color: active?"#a78bfa":"#d3d3d3", transition:"color 0.15s" }}>{icon}</div>
                <span style={{ fontSize:10, fontWeight:600, letterSpacing:0.3 }}>{label}</span>
                {active && <div style={{ position:"absolute", bottom:0, left:"20%", right:"20%", height:2, borderRadius:1, background:"#8b5cf6" }}/>}
              </button>
            );
          })}

          {/* Export button */}
          <button onClick={doExport} disabled={!canDownload}
            style={{ flexShrink:0, display:"flex", alignItems:"center", gap:6, marginLeft:4, padding:"0 16px", height:40, borderRadius:12, border:"none", fontWeight:700, fontSize:13, cursor: canDownload?"pointer":"not-allowed", background: canDownload?"linear-gradient(135deg,#7c3aed,#c026d3)":"rgba(255,255,255,0.06)", color: canDownload?"#d3d3d3":"#333" }}>
            {exporting
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></path></svg>
              : <Download size={14}/>
            }
            Export
          </button>
        </div>
      </div>

      <style>{`
        @media(max-width:768px){.sf-sidebar{display:none!important;}}
        @media(min-width:769px){.sf-mobile{display:none!important;}}
        @media(max-width:768px){
          .sf-preview-area{
            padding-bottom: calc(58px + env(safe-area-inset-bottom)) !important;
            align-items: flex-start !important;
            padding-top: 12px !important;
          }
        }
      `}</style>

      {/* Result Modal */}
      {resultUrl && (
        <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
          onClick={(e)=>{if(e.target===e.currentTarget)setResultUrl(null);}}>
          <div style={{background:"#13131f",borderRadius:18,padding:20,maxWidth:360,width:"100%",textAlign:"center",boxShadow:"0 24px 80px rgba(0,0,0,0.7)",border:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:3}}>Your story is ready!</div>
            <div style={{fontSize:11,color:"#666",marginBottom:14}}>
              {navigator.share ? "Tap Save to Photos to save directly to your gallery." : "Click Save PNG to download."}
            </div>
            <div style={{borderRadius:10,overflow:"hidden",marginBottom:14,background:"#000",border:"1px solid rgba(255,255,255,0.06)"}}>
              <img src={resultUrl} alt="Result" style={{width:"100%",height:"auto",display:"block"}}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setResultUrl(null)} style={{flex:1,padding:"10px 0",borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"#666",fontSize:13,cursor:"pointer"}}>
                Close
              </button>
              <button onClick={()=>handleSave(resultUrl)}
                style={{flex:2,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 0",borderRadius:10,border:"none",background:"linear-gradient(135deg,#7c3aed,#c026d3)",color:"#d3d3d3",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                <Download size={14}/> {navigator.share ? "Save to Photos" : "Save PNG"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}