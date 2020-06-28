const setRafInterval = (fn, delay) => {
  const id = {};
  function tick() {
    fn();
    id.timeout = setTimeout(() => {
      id.raf = requestAnimationFrame(tick);
    }, delay);
  }
  tick();
  return id;
};

const clearRafInterval = (id) => {
  if (!id) return;
  const { timeout, raf } = id;
  clearTimeout(timeout);
  cancelAnimationFrame(raf);
};

export { setRafInterval, clearRafInterval };
