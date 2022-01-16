import { ResizeObserver } from '@juggle/resize-observer';
import useResizeObserver from 'use-resize-observer';

if (!window.ResizeObserver) {
  window.ResizeObserver = ResizeObserver;
}

export default useResizeObserver;
