import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * タイプライター効果の共通フック
 * @param text 表示するテキスト
 * @param speed 文字ごとの間隔(ms) デフォルト30
 * @returns { displayText, isTyping, skipToEnd }
 */
export function useTypewriterEffect(text: string, speed: number = 30) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typeIntervalRef = useRef<number | null>(null);
  const fullTextRef = useRef(text);

  // テキストが変わるたびに最新のものを保持
  fullTextRef.current = text;

  useEffect(() => {
    if (!text) {
      setDisplayText('');
      setIsTyping(false);
      return;
    }

    setDisplayText('');
    setIsTyping(true);

    let i = 0;
    const chars = text.split('');

    typeIntervalRef.current = window.setInterval(() => {
      if (i < chars.length) {
        setDisplayText(text.substring(0, i + 1));
        i++;
      } else {
        if (typeIntervalRef.current) {
          clearInterval(typeIntervalRef.current);
          typeIntervalRef.current = null;
        }
        setIsTyping(false);
      }
    }, speed);

    return () => {
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
        typeIntervalRef.current = null;
      }
    };
  }, [text, speed]);

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
