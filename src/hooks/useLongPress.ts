import { useCallback, useRef, useState } from 'react';

interface LongPressOptions {
  threshold?: number;
  onLongPress?: (e: any) => void;
  onClick?: (e: any) => void;
}

export default function useLongPress({
  threshold = 500,
  onLongPress,
  onClick,
}: LongPressOptions = {}) {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef(false);

  const start = useCallback(
    (e: any) => {
      isLongPressTriggered.current = false;
      timerRef.current = setTimeout(() => {
        setIsLongPressing(true);
        isLongPressTriggered.current = true;
        if (onLongPress) onLongPress(e);
      }, threshold);
    },
    [onLongPress, threshold]
  );

  const stop = useCallback(
    (e: any) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setIsLongPressing(false);
      if (!isLongPressTriggered.current && onClick) {
        onClick(e);
      }
    },
    [onClick]
  );

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
}
