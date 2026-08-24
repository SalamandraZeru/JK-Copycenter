import React from 'react';
import type { ServiceField, FieldValue } from '@/types/service';

interface FieldProps {
  field: ServiceField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  error?: string;
}

export function NumberField({ field, value, onChange, error }: FieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onChange({
      fieldKey: field.key,
      value: isNaN(val) ? '' : val,
      label: field.label
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={field.key} className="text-sm font-semibold text-slate-800">
        {field.label} {field.isRequired && <span className="text-red-600">*</span>}
      </label>
      <input
        type="number"
        id={field.key}
        value={(value?.value as number) ?? ''}
        onChange={handleChange}
        className={`px-3.5 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm font-medium text-slate-900 ${
          error ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
        }`}
      />
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </div>
  );
}
