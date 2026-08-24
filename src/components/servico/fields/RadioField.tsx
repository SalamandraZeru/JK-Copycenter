import React from 'react';
import type { ServiceField, FieldValue } from '@/types/service';

interface FieldProps {
  field: ServiceField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  error?: string;
}

export function RadioField({ field, value, onChange, error }: FieldProps) {
  const handleChange = (selectedVal: string) => {
    const option = field.options.find(o => o.value === selectedVal);
    if (!option) return;

    onChange({
      fieldKey: field.key,
      value: selectedVal,
      label: field.label,
      selectedOption: option
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-800">
        {field.label} {field.isRequired && <span className="text-red-600">*</span>}
      </label>
      <div className="flex flex-col gap-2.5">
        {field.options.map(opt => (
          <label key={opt.value} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="radio"
              name={field.key}
              value={opt.value}
              checked={value?.value === opt.value}
              onChange={() => handleChange(opt.value)}
              className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-900 flex-1">
              {opt.label}
            </span>
          </label>
        ))}
      </div>
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </div>
  );
}
