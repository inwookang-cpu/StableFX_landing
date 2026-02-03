'use client';

import { useState, useEffect } from 'react';

/**
 * DeferredInput - Enter 또는 blur 시에만 값을 반영하는 Input 컴포넌트
 * 
 * 사용법:
 * <DeferredInput 
 *   value={someValue}
 *   onCommit={(newValue) => setSomeValue(newValue)}
 *   className="..."
 *   placeholder="Enter value"
 *   type="text"
 * />
 */
function DeferredInput({ value, onCommit, className, placeholder, type = 'text' }) {
  const [localValue, setLocalValue] = useState(value || '');
  
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);
  
  const handleCommit = () => {
    if (localValue !== (value || '')) {
      onCommit(localValue);
    }
  };
  
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCommit();
          e.target.blur();
        }
      }}
      className={className}
    />
  );
}

export default DeferredInput;
