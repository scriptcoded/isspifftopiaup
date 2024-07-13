'use client';

import { useEffect, useState } from 'react';

export default function LoadingDots() {
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCounter((val) => (val >= 2 ? 0 : val + 1));
    }, 400);

    return () => clearInterval(interval);
  }, []);

  const getDot = (pos: number) => (
    <span className={pos <= counter ? '' : 'text-transparent'}>.</span>
  );

  return (
    <>
      {getDot(0)}
      {getDot(1)}
      {getDot(2)}
    </>
  );
}
