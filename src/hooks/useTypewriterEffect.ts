import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * タイプライターエフェクト共通フック
 * @param text 表示するテキスト
 * @param interval 1文字あたりの表示間隔(ms)
 * @returns { displayText, isTyping, skipToEnd }
 */
export function useTypewriterEffect(text: string | undefined, interval = 30) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typeIntervalRef = useRef<number | null>(null);
  const fullTextRef = useRef<string>('');

  useEffect(() => {
    if (!text) {
      setDisplayText('');
      setIsTyping(false);
      return;
    }

    fullTextRef.current = text;
    setDisplayText('');
    setIsTyping(true);

    let i = 0;
    const chars = text.split('');

    typeIntervalRef.current = window.setInterval(() => {
      if (i < chars.length) {
        const ch = chars[i];
        i++;
        setDisplayText(prev => prev + ch);
      } else {
        if (typeIntervalRef.current) {
          clearInterval(typeIntervalRef.current);
          typeIntervalRef.current = null;
        }
        setIsTyping(false);
      }
    }, interval);

    return () => {
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
      }
    };
  }, [text, interval]);

  const skipToEnd = useCallback(() => {
    if (typeIntervalRef.current) {
      clearInterval(typeIntervalRef.current);
      typeIntervalRef.current = null;
    }
    setDisplayText(fullTextRef.current);
    setIsTyping(false);
  }, []);

  return { displayText, isTyping, skipToEnd };
}
