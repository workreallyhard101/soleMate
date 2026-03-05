import { useState, useEffect } from 'react';
import { getTimeUntilDeadline } from '../lib/deadlineUtils';

export function useCountdown() {
  const [countdown, setCountdown] = useState(getTimeUntilDeadline());

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getTimeUntilDeadline());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return countdown;
}
