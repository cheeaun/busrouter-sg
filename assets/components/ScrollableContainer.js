import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import useResizeObserver from 'use-resize-observer';

const shadowStyles = {
  position: 'absolute',
  width: '100%',
  height: 10,
  zIndex: 10,
  pointerEvents: 'none',
};

export default function ScrollableContainer(props) {
  const { children, ...otherProps } = props;
  const { ref, width, height } = useResizeObserver();
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

  return (
    <div {...otherProps} ref={ref} data-scroll-shadow={scrollShadow}>
      {children}
    </div>
  );
}
