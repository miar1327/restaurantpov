import { useState, useEffect } from 'react';

export const useLiveTime = (intervalMs = 30000) => {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
};
