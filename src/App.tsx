import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowRight, BatteryFull, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleDot, Crosshair, Grid2X2, Map, MapPin, Maximize2, Pause, Play, Scan, Settings, ShieldCheck, Signal, UserRound, Video, Waypoints, ZoomIn, ZoomOut, Route, X } from 'lucide-react'
import * as THREE from 'three'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type Mode = 'AUTO' | 'MANUAL'
type MainView = 'camera' | 'map'

function MiniMap({ onExpand }: { onExpand: () => void }) {
  return <button className="mini-map" onClick={onExpand} aria-label="Open map view">
    <div className="map-art">
      <div className="map-shape">
        <span className="room room-a"/><span className="room room-b"/><span className="room room-c"/><span className="room room-d"/>
        <span className="map-path"/>
        <span className="map-robot">✣</span>
      </div>
    </div>
    <span className="mini-expand"><Maximize2 size={12}/></span>
  </button>
}

function PointCloudCanvas({ fileUrl }: { fileUrl?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    const node = host.current
    if (!node) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#cfd0cd')
    const camera = new THREE.PerspectiveCamera(55, node.clientWidth / Math.max(1,node.clientHeight), .01, 10000)
    camera.position.set(5, 5, 8)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(node.clientWidth, node.clientHeight)
    node.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    const grid = new THREE.GridHelper(20, 40, '#969b98', '#b7bab7')
    grid.position.y = -0.03
    scene.add(grid)
    const axes = new THREE.AxesHelper(1.5); scene.add(axes)
    // Clearly marked illustrative point cloud until assignment PCD is supplied.
    const positions: number[] = []
    for (let i=0;i<3200;i++) {
      const x=(Math.random()-.5)*12, z=(Math.random()-.5)*12
      const edge=Math.abs(x)>4.6 || Math.abs(z)>4.6 || (Math.abs(x)>2 && Math.abs(z)<.3)
      if(edge || Math.random()>.91) positions.push(x, Math.random()*.45, z)
    }
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions,3))
    const cloud = new THREE.Points(geom,new THREE.PointsMaterial({color:'#26343a',size:.045}))
    scene.add(cloud)
    let active = true
    if (fileUrl) {
      new PCDLoader().load(fileUrl, pcd => {
        if (!active) { pcd.geometry.dispose(); return }
        scene.remove(cloud); cloud.geometry.dispose()
        scene.add(pcd)
        pcd.material = new THREE.PointsMaterial({color:'#29383d',size:.035})
        const box = new THREE.Box3().setFromObject(pcd)
        const center = box.getCenter(new THREE.Vector3())
        controls.target.copy(center)
        camera.position.copy(center).add(new THREE.Vector3(4,4,6))
        setErr('')
      }, undefined, () => setErr('PCD could not be loaded. Check the file path and format.'))
    }
    const resize = () => {
      if (!node.clientWidth || !node.clientHeight) return
      camera.aspect=node.clientWidth/node.clientHeight; camera.updateProjectionMatrix()
      renderer.setSize(node.clientWidth,node.clientHeight)
    }
    const observer=new ResizeObserver(resize); observer.observe(node)
    const render=()=>{ if(!active)return; controls.update(); renderer.render(scene,camera); requestAnimationFrame(render) }
    render()
    return ()=>{active=false;observer.disconnect();controls.dispose();renderer.dispose();geom.dispose();node.removeChild(renderer.domElement)}
  },[fileUrl])
  return <div className="pcd-host" ref={host}>{err && <div className="toast">{err}</div>}</div>
}

export default function App() {
  const [mode,setMode]=useState<Mode>('AUTO')
  const [view,setView]=useState<MainView>('camera')
  const [paused,setPaused]=useState(false)
  const [mission,setMission]=useState<'On Mission 1234'|'Paused'|'Goal selected'>('On Mission 1234')
  const [goalMode,setGoalMode]=useState(false)
  const [notice,setNotice]=useState('')
  const [zoom,setZoom]=useState(1)
  const [videoReady,setVideoReady]=useState(false)
  const [pcdUrl,setPcdUrl]=useState('')
  const videoRef=useRef<HTMLVideoElement>(null)
  const fileRef=useRef<HTMLInputElement>(null)
  const pcdRef=useRef<HTMLInputElement>(null)

  const say=(message:string)=>{setNotice(message);window.setTimeout(()=>setNotice(''),2600)}
  const toggleView=()=>setView(v=>v==='camera'?'map':'camera')
  const emergency=()=>{setPaused(true);setMission('Paused');say('SIMULATION: Emergency stop requested. No robot is connected.')}
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setGoalMode(false);setNotice('')}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[])

  return <main className="dashboard">
    <aside className="sidebar">
      <div className="brand">ERIC<span>ROBOTICS</span></div>
      <nav aria-label="Primary navigation">
        <button className="nav-btn active" title="Dashboard" onClick={()=>say('Dashboard')}><Grid2X2/></button>
        <button className="nav-btn" title="Map" onClick={toggleView}><Map/></button>
        <button className="nav-btn" title="Goals" onClick={()=>setGoalMode(true)}><MapPin/></button>
        <button className="nav-btn" title="Zones" onClick={()=>say('Zones view is not connected yet')}><Scan/></button>
        <button className="nav-btn" title="Robot" onClick={()=>say('Robot telemetry is simulated')}><Crosshair/></button>
        <button className="nav-btn" title="Analytics" onClick={()=>say('Analytics view is not connected yet')}><Activity/></button>
      </nav>
      <button className="nav-btn profile" title="Profile" onClick={()=>say('Profile')}><UserRound/></button>
    </aside>

    <section className="workspace">
      {view==='camera' ? <div className="camera-scene">
        <video ref={videoRef} className="camera-feed" src="/assets/videos/camera-demo.mp4" muted playsInline loop poster="/assets/images/camera-poster.jpg"/>
        <div className="camera-placeholder"><Video size={34}/><b>CAMERA FEED</b><span>Add your assignment video to</span><code>public/assets/videos/camera-demo.mp4</code><button onClick={()=>fileRef.current?.click()}>Choose local video</button><input ref={fileRef} type="file" accept="video/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f&&videoRef.current){videoRef.current.src=URL.createObjectURL(f);videoRef.current.play().catch(()=>{});}}}/></div>
        <div className="camera-shade"/>
      </div> : <PointCloudCanvas fileUrl={pcdUrl||undefined}/>}
      <div className="mission-pill glass"><span className="muted">Status</span><b>{mission}</b><button className="pause-btn" title={paused?'Resume mission':'Pause mission'} onClick={()=>{setPaused(p=>!p);setMission(paused?'On Mission 1234':'Paused')}}>{paused?<Play size={13} fill="currentColor"/>:<Pause size={13} fill="currentColor"/>}</button></div>
      <button className="quick-goal glass" onClick={()=>setGoalMode(true)}>QUICK GOAL <span><ArrowRight size={16}/></span></button>
      <div className="telemetry glass">
        <span><b>100%</b><BatteryFull className="green" size={14}/></span><i/>
        <span><Signal size={13}/><b>Strong</b></span><i/>
        <span className="telemetry-label">Failsafe <b>Okay</b><span className="dot green-dot"/></span><i/>
        <span className="telemetry-label">System <b>Okay</b><span className="dot green-dot"/></span>
      </div>
      <button className="view-label" onClick={toggleView}>{view==='camera'?'Camera View':'Map View'}</button>
      <div className="toolbar-right">
        <div className="mode-switch glass"><span>MODE</span>{(['AUTO','MANUAL'] as Mode[]).map(m=><button key={m} className={mode===m?'selected':''} onClick={()=>{setMode(m);say(`${m} mode selected (simulation)`);}}>{m}</button>)}</div>
        <button className="initiate glass" onClick={()=>{setPaused(false);setMission('On Mission 1234');say('SIMULATION: Mission initiate requested. No robot is connected.')}}>INITIATE <span><ArrowRight size={16}/></span></button>
      </div>
      {view==='camera' && <div className="map-overlay"><div className="zoom-rail"><button onClick={()=>setZoom(z=>Math.min(2.8,z+.2))} aria-label="Zoom in"><ZoomIn size={13}/></button><input aria-label="Map zoom" type="range" min=".6" max="2.8" step=".1" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><button onClick={()=>setZoom(z=>Math.max(.6,z-.2))} aria-label="Zoom out"><ZoomOut size={13}/></button></div><MiniMap onExpand={toggleView}/></div>}
      {view==='map' && <div className="map-file-tools"><button onClick={()=>pcdRef.current?.click()}>Load PCD</button><input ref={pcdRef} type="file" accept=".pcd" hidden onChange={e=>{const f=e.target.files?.[0];if(f){const url=URL.createObjectURL(f);setPcdUrl(url);say('PCD selected')}}}/><span>Interactive point-cloud preview</span></div>}
      <div className="right-controls">
        <button className="emergency" onClick={emergency} aria-label="Emergency stop"><span className="emergency-word">EMERGENCY</span><span className="emergency-core"><Route size={36} strokeWidth={3}/></span><span className="stop-word">STOP</span></button>
        <div className={`joystick ${mode==='AUTO'?'auto-dim':''}`} aria-label="Robot directional controls">
          <button className="joy north" disabled={mode!=='MANUAL'} onClick={()=>say('Forward command simulated')} aria-label="Forward"><ChevronUp/></button>
          <button className="joy south" disabled={mode!=='MANUAL'} onClick={()=>say('Backward command simulated')} aria-label="Backward"><ChevronDown/></button>
          <button className="joy west" disabled={mode!=='MANUAL'} onClick={()=>say('Turn left command simulated')} aria-label="Left"><ChevronLeft/></button>
          <button className="joy east" disabled={mode!=='MANUAL'} onClick={()=>say('Turn right command simulated')} aria-label="Right"><ChevronRight/></button>
          <div className="joy-center">W<br/><small>A&nbsp;&nbsp;●&nbsp;&nbsp;D<br/>S</small></div>
        </div>
      </div>
      <div className="bottom-status"><span className="live-dot"/><span>SIMULATION MODE</span><span className="status-sep">|</span><ShieldCheck size={12}/><span>No robot connected</span></div>
      <button className="settings-btn" title="Settings" onClick={()=>say('Settings') }><Settings size={17}/></button>
      {goalMode && <div className="modal-backdrop" onClick={()=>setGoalMode(false)}><section className="goal-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setGoalMode(false)}><X size={18}/></button><h2>Quick Goal</h2><p>Select a goal point on the map to simulate navigation.</p><div className="goal-map" onClick={()=>{setMission('Goal selected');setGoalMode(false);say('Demo goal selected. No robot command sent.')}}><Waypoints/><span>Click map to select goal</span></div><button className="primary-btn" onClick={()=>{setMission('Goal selected');setGoalMode(false);say('Demo goal selected. No robot command sent.')}}>Select demo goal <ArrowRight size={16}/></button></section></div>}
      {notice && <div role="status" className="toast">{notice}</div>}
    </section>
  </main>
}