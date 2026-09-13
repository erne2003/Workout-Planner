import { useState, useMemo, useRef, useEffect } from 'react';
import { PanResponder } from 'react-native';
import * as Haptics from 'expo-haptics';

export function useChartScrubber(
  dataLength: number,
  chartWidth: number,
  padL: number,
  padR: number,
  onScrubChange?: (isScrubbing: boolean) => void
) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const innerW = chartWidth - padL - padR;

  // Callers often pass an inline onScrubChange (a new function every render).
  // Reading it through a ref -- instead of putting it in the useMemo deps
  // below -- keeps the PanResponder (and its startX/lastIndex closure state)
  // stable across a caller re-render triggered by onScrubChange(true) itself,
  // which would otherwise tear down and recreate the responder mid-gesture
  // and reset the drag's tracked start position back to 0.
  const onScrubChangeRef = useRef(onScrubChange);
  useEffect(() => {
    onScrubChangeRef.current = onScrubChange;
  }, [onScrubChange]);

  const panResponder = useMemo(() => {
    let lastIndex = -1;
    let startX = 0;

    const handlePan = (x: number) => {
      if (dataLength <= 1) {
        if (lastIndex !== 0) {
          lastIndex = 0;
          setActiveIndex(0);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        return;
      }

      const xPos = x - padL;
      let index = Math.round((xPos / innerW) * (dataLength - 1));
      
      if (index < 0) index = 0;
      if (index >= dataLength) index = dataLength - 1;

      if (index !== lastIndex) {
        lastIndex = index;
        setActiveIndex(index);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        startX = evt.nativeEvent.locationX;
        handlePan(startX);
        onScrubChangeRef.current?.(true);
      },
      onPanResponderMove: (evt, gestureState) => {
        const currentX = startX + gestureState.dx;
        handlePan(currentX);
      },
      onPanResponderRelease: () => {
        setActiveIndex(null);
        lastIndex = -1;
        onScrubChangeRef.current?.(false);
      },
      onPanResponderTerminate: () => {
        setActiveIndex(null);
        lastIndex = -1;
        onScrubChangeRef.current?.(false);
      }
    });
  }, [dataLength, padL, innerW]);

  const displayIndex = activeIndex !== null ? activeIndex : (dataLength > 0 ? dataLength - 1 : 0);
  const isScrubbing = activeIndex !== null;

  return { panHandlers: panResponder.panHandlers, activeIndex, displayIndex, isScrubbing };
}
