import React from 'react';
import type { ServiceField, FieldValue } from '@/types/service';

interface FieldProps {
  field: ServiceField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  error?: string;
}

export function CheckboxField({ field, value, onChange, error }: FieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    // For a single checkbox, we assume options[0] is the config for when checked, if it exists
    const option = field.options[0];
    
    const newValue: FieldValue = {
      fieldKey: field.key,
      value: isChecked,
      label: field.label,
      ...(isChecked && option ? { selectedOption: option } : {}),
    };
    onChange(newValue);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={!!value?.value}
          onChange={handleChange}
          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-slate-900 flex-1">
          {field.label} {field.isRequired && <span className="text-red-600">*</span>}
        </span>
      </label>
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </div>
  );
}
