import { h } from 'preact';
import { useRef, useState, useEffect } from 'preact/hooks';
import useResizeObserver from 'use-resize-observer';

export default function ScrollableContainer(props) {
  const { children, scrollToTopKey, ...otherProps } = props;
  const ref = useRef(null);
  const { width, height } = useResizeObserver({ ref });
  const [scrollShadow, setScrollShadow] = useState('bottom');
  useEffect(() => {
    // console.log('TRIGGER');
    const { current: el } = ref;
    const { scrollHeight, offsetHeight } = el;
    const handleScroll = () => {
      // console.log('SCROLL');
      if (el.scrollTop <= 0) {
        setScrollShadow('bottom');
      } else if (el.scrollTop + el.offsetHeight >= el.scrollHeight) {
        setScrollShadow('top');
      } else {
        setScrollShadow('both');
      }
    };
    const scrollable = scrollHeight > offsetHeight + 5; // Magic threshold
    if (scrollable) {
      handleScroll();
      el.addEventListener('scroll', handleScroll);
    } else {
      setScrollShadow('');
    }
    return () => el.removeEventListener('scroll', handleScroll);
  }, [width, height]);

  // Scroll to top when `scrollToTopKey` changes
  useEffect(() => {
    ref.current.scrollTop = 0;
  }, [scrollToTopKey]);

  return (
    <div {...otherProps} ref={ref} data-scroll-shadow={scrollShadow}>
      {children}
    </div>
  );
}
