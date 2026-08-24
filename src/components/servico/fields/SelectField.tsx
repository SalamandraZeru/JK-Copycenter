import React from 'react';
import type { ServiceField, FieldValue } from '@/types/service';

interface FieldProps {
  field: ServiceField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  error?: string;
}

export function SelectField({ field, value, onChange, error }: FieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVal = e.target.value;
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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={field.key} className="text-sm font-semibold text-slate-800">
        {field.label} {field.isRequired && <span className="text-red-600">*</span>}
      </label>
      <select
        id={field.key}
        value={value?.value as string || ''}
        onChange={handleChange}
        className={`px-3.5 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm font-medium text-slate-900 ${
          error ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
        }`}
      >
        <option value="" disabled className="text-slate-500">Selecione uma opção...</option>
        {field.options.map(opt => (
          <option key={opt.value} value={opt.value} className="text-slate-900 font-medium py-1">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </div>
  );
}
