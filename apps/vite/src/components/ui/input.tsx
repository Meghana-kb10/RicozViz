import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      startAdornment,
      endAdornment,
      className = '',
      id,
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      placeholder,
      ...props
    },
    ref
  ) => {
    const inputId = id || props.name || Math.random().toString(36).substring(7);
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(
      Boolean(value !== undefined ? value : defaultValue)
    );

    React.useEffect(() => {
      if (value !== undefined) {
        setHasValue(Boolean(value));
      }
    }, [value]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      if (onFocus) onFocus(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(Boolean(e.target.value));
      if (onBlur) onBlur(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(Boolean(e.target.value));
      if (onChange) onChange(e);
    };

    const isFloating = isFocused || hasValue || Boolean(placeholder);

    return (
      <div className="flex flex-col w-full relative group">
        <div
          className={`relative flex items-center rounded-lg transition-all duration-200 bg-slate-900/80 ${
            error
              ? 'border-2 border-rose-500'
              : isFocused
                ? 'border-2 border-indigo-500 ring-2 ring-indigo-500/20'
                : 'border border-slate-700 hover:border-slate-500'
          }`}
        >
          {startAdornment && <div className="pl-3.5 text-slate-400">{startAdornment}</div>}

          {label && (
            <label
              htmlFor={inputId}
              className={`absolute transition-all duration-200 pointer-events-none px-1 rounded ${
                isFloating
                  ? `-top-2.5 left-2.5 text-[11px] font-medium bg-slate-900 ${
                      error ? 'text-rose-400' : isFocused ? 'text-indigo-400 font-semibold' : 'text-slate-400'
                    }`
                  : `top-2.5 left-3.5 text-sm ${error ? 'text-rose-400' : 'text-slate-400'}`
              }`}
            >
              {label}
            </label>
          )}

          <input
            ref={ref}
            id={inputId}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={isFloating ? placeholder : ''}
            className={`w-full px-3.5 py-2.5 text-sm bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none transition-colors ${
              label && !isFloating ? 'opacity-0 focus:opacity-100' : 'opacity-100'
            } ${className}`}
            {...props}
          />

          {endAdornment && <div className="pr-3.5 text-slate-400">{endAdornment}</div>}
        </div>

        {error && (
          <div className="flex items-center gap-1 mt-1.5 ml-2 text-xs text-rose-400 font-medium">
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {!error && helperText && (
          <span className="text-xs text-slate-400 mt-1.5 ml-3 font-normal">{helperText}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
