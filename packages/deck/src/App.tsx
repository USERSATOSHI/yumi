import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { Canvas, useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import Yumi from './components/yumi';
import React from 'react';
import './App.css';
import BottomMenu from './components/menu/index.tsx';
import Control from './pages/Control/index.tsx';
import Reminders from './pages/Reminders/index.tsx';
import Todos from './pages/Todos/index.tsx';
import Devices from './pages/Devices/index.tsx';
import Home from './pages/Home/Home.tsx';
import { ControlProvider } from './contexts/ControlContext.tsx';
import { YumiResponseProvider } from './contexts/YumiResponseContext.tsx';
import Transcript from './components/Transcript/index.tsx';

// Menu order for direction logic
const menuOrder = [
  '/devices',
  '/control',
  '/',
  '/todos',
  '/reminders',
];

function getMenuIndex(path: string) {
  const clean = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  const idx = menuOrder.indexOf(clean);
  return idx === -1 ? menuOrder.indexOf('/') : idx;
}

/* ------------------ PAGE ANIMATION VARIANTS ------------------ */
const pageVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? '100vw' : '-100vw',
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100vw' : '100vw',
    opacity: 0,
  }),
};

function AnimatedRoutes() {
  const location = useLocation();

  const prevIdxRef = React.useRef(getMenuIndex(location.pathname));
  const currIdx = getMenuIndex(location.pathname);

  const direction =
    currIdx === prevIdxRef.current ? 0 : currIdx - prevIdxRef.current;

  React.useEffect(() => {
    prevIdxRef.current = currIdx;
  }, [currIdx]);

  return (
    <AnimatePresence initial={false} mode="wait" custom={direction}>
      <motion.div
        key={location.pathname}
        custom={direction}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
          mass: 0.5,
        }}
        style={{
          position: 'absolute',
          width: '100%',
          height: 'calc( 100% - 56px)',
        }}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/control" element={<Control />} />
          <Route path="/devices" element={<Devices />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------ 3D ROOM BACKGROUND ------------------ */
function RoomBackground() {
  const texture = useLoader(TextureLoader, '/room.webp');
  const { innerWidth: w, innerHeight: h } = window;
  const aspect = w / h;

  texture.wrapS = texture.wrapT = 1000;
  texture.center.set(0.5, 0.5);

  const imageAspect =
    texture.image ? texture.image.width / texture.image.height : 1;

  let repeatX = 1,
    repeatY = 1;

  if (aspect > imageAspect) {
    repeatY = imageAspect / aspect;
  } else {
    repeatX = aspect / imageAspect;
  }

  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;

  return <primitive attach="background" object={texture} />;
}

function App() {
  return (
    <BrowserRouter>
      <YumiResponseProvider>
      <ControlProvider>
      <main
        className="app"
        style={{ paddingBottom: 56, position: 'relative', overflow: 'hidden' }}
      >
        {/* 3D Canvas background */}
        <Canvas
          camera={{ position: [0, 1, 6], fov: 50 }}
          style={{ position: 'fixed', inset: 0, zIndex: 0 }}
        >
          <RoomBackground />
          <ambientLight intensity={1} />
          <directionalLight position={[0, 10, 10]} intensity={1} />
          <hemisphereLight
            color={0xffffff}
            groundColor={0x444444}
            intensity={0.2}
          />
          <Yumi />
        </Canvas>

        {/* Global audio element */}
        <audio id="yumi-audio" crossOrigin="anonymous" controls hidden></audio>

        {/* Transcript display */}
        <Transcript />

        {/* App pages */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
          <AnimatedRoutes />
          <BottomMenu />
        </div>
      </main>
      </ControlProvider>
      </YumiResponseProvider>
    </BrowserRouter>
  );
}

export default App;
