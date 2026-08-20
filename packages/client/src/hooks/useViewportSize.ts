"use client";

import { useState, useEffect } from "react";

export function useViewportSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function update() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return {
    ...size,
    isMobile: size.width > 0 && size.width < 640,
    isTablet: size.width >= 640 && size.width < 1024,
  };
}
